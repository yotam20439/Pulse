import "server-only";

import type { Dictionary } from "@/lib/i18n";
import type { CampaignDay } from "@/db/schema";
import type { ContributionRow, PostRow } from "@/lib/queries/campaign";
import { indexBand } from "@/lib/indices";

/**
 * Insights are computed from the data at request time, not written by a model.
 *
 * Everything here is a deterministic rule with a stated threshold, so an
 * analyst can check any claim against the numbers on the same screen. That
 * matters more than fluency: a plausible sentence with no arithmetic behind it
 * is worse than no sentence, because it will be repeated to a client.
 *
 * A language model belongs one layer up — summarising these findings into
 * prose — not inventing the findings themselves.
 */

export type GeneratedInsight = {
  id: string;
  kind: "TREND" | "ANOMALY" | "RECOMMENDATION" | "SUMMARY";
  title: string;
  body: string;
  /** How strongly the rule fired, 0–1. Drives visual weight, not truth. */
  confidence: number;
  tone: "positive" | "neutral" | "warning" | "critical";
};

type Input = {
  dict: Dictionary;
  history: CampaignDay[];
  contribution: ContributionRow[];
  posts: PostRow[];
  totals: { reach: number; engagements: number; engagementRate: number; spend: number; clicks: number };
  kpis: { metric: string; target: number; actual: number; progress: number }[];
  currency: string;
  daysElapsed: number;
  daysTotal: number | null;
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const num = (n: number, locale: string) =>
  new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

export function generateInsights(input: Input): GeneratedInsight[] {
  const { dict, history, contribution, posts, totals, kpis } = input;
  const he = dict.locale === "he";
  const out: GeneratedInsight[] = [];
  const n = (v: number) => num(v, dict.locale);

  /* ---------------------------- momentum ---------------------------- */

  if (history.length >= 6) {
    const recent = history.slice(-3);
    const prior = history.slice(-6, -3);
    const avg = (rows: CampaignDay[], key: "reach" | "engagements") =>
      rows.reduce((s, r) => s + (r[key] ?? 0), 0) / Math.max(rows.length, 1);

    const recentReach = avg(recent, "reach");
    const priorReach = avg(prior, "reach");
    const change = priorReach > 0 ? (recentReach - priorReach) / priorReach : 0;

    if (Math.abs(change) >= 0.15) {
      const rising = change > 0;
      out.push({
        id: "momentum",
        kind: "TREND",
        confidence: Math.min(0.5 + Math.abs(change), 0.95),
        tone: rising ? "positive" : "warning",
        title: he
          ? `החשיפה ${rising ? "בעלייה" : "בירידה"} של ${pct(Math.abs(change))} בשלושת הימים האחרונים`
          : `Reach is ${rising ? "up" : "down"} ${pct(Math.abs(change))} over the last three days`,
        body: he
          ? rising
            ? `הממוצע היומי עלה מ-${n(priorReach)} ל-${n(recentReach)}. אם הקצב נשמר, כדאי לשקול הגדלת תקציב לפוסטים שמניעים את העלייה.`
            : `הממוצע היומי ירד מ-${n(priorReach)} ל-${n(recentReach)}. ירידה טבעית לאחר 48 השעות הראשונות — אך אם אין פוסטים חדשים בדרך, זו כל החשיפה שהקמפיין ייצר.`
          : rising
            ? `The daily average moved from ${n(priorReach)} to ${n(recentReach)}. If the pace holds, the posts driving it are worth more budget.`
            : `The daily average fell from ${n(priorReach)} to ${n(recentReach)}. Decay after the first 48 hours is normal — but with no new posts scheduled, this is most of the reach this campaign will produce.`,
      });
    }
  }

  /* --------------------------- index shift --------------------------- */

  const latest = history.at(-1);
  const weekAgo = history.at(-8);
  if (latest?.effectivenessIndex != null && weekAgo?.effectivenessIndex != null) {
    const delta = latest.effectivenessIndex - weekAgo.effectivenessIndex;
    if (Math.abs(delta) >= 6) {
      const band = indexBand(latest.effectivenessIndex);
      out.push({
        id: "effectiveness-shift",
        kind: delta < 0 ? "ANOMALY" : "TREND",
        confidence: 0.75,
        tone: delta < 0 ? "warning" : "positive",
        title: he
          ? `מדד האפקטיביות ${delta > 0 ? "עלה" : "ירד"} ב-${Math.abs(delta).toFixed(0)} נקודות השבוע`
          : `Effectiveness ${delta > 0 ? "rose" : "fell"} ${Math.abs(delta).toFixed(0)} points this week`,
        body: he
          ? `המדד עומד על ${latest.effectivenessIndex.toFixed(0)} מתוך 100. ${
              delta < 0
                ? "ירידה נובעת בדרך כלל מהוצאה שממשיכה לרוץ בזמן שהמעורבות דועכת — בדקו את עלות האינטראקציה בטבלת היוצרים."
                : "העלייה מגיעה מיחס טוב יותר בין מעורבות לעלות."
            }`
          : `It now sits at ${latest.effectivenessIndex.toFixed(0)} of 100. ${
              delta < 0
                ? "A drop usually means spend continuing while engagement decays — check cost per engagement in the creator table."
                : "The gain comes from a better engagement-to-cost ratio."
            }`,
      });
    }
  }

  /* ------------------------- creator spread -------------------------- */

  const active = contribution.filter((c) => c.reach > 0);
  if (active.length >= 3) {
    const sorted = [...active].sort((a, b) => b.reach - a.reach);
    const topShare = sorted[0].shareOfReach;

    if (topShare > 0.5) {
      out.push({
        id: "concentration",
        kind: "ANOMALY",
        confidence: 0.8,
        tone: "warning",
        title: he
          ? `${sorted[0].name} אחראי ל-${pct(topShare)} מהחשיפה`
          : `${sorted[0].name} is carrying ${pct(topShare)} of all reach`,
        body: he
          ? `כשיוצר יחיד נושא יותר ממחצית הקמפיין, מדד הבולטות משקף למעשה חשבון אחד ולא פריסה אמיתית. שווה לבדוק אם שאר היוצרים סיפקו את המוסכם.`
          : `When one account carries more than half the campaign, the Prominence score reflects a single creator rather than genuine spread. Worth checking whether the rest delivered what was contracted.`,
      });
    }

    // Value, not volume: the cheapest creator per weighted engagement.
    const priced = active.filter((c) => c.costPerEngagement != null && c.spend > 0);
    if (priced.length >= 2) {
      const best = priced.reduce((a, b) => (a.costPerEngagement! < b.costPerEngagement! ? a : b));
      const worst = priced.reduce((a, b) => (a.costPerEngagement! > b.costPerEngagement! ? a : b));
      const ratio = worst.costPerEngagement! / Math.max(best.costPerEngagement!, 0.01);

      if (ratio >= 2.5 && best.participantId !== worst.participantId) {
        out.push({
          id: "value-gap",
          kind: "RECOMMENDATION",
          confidence: 0.7,
          tone: "neutral",
          title: he
            ? `${best.name} מחזיר פי ${ratio.toFixed(1)} יותר לכל שקל מ-${worst.name}`
            : `${best.name} returns ${ratio.toFixed(1)}× more per unit spent than ${worst.name}`,
          body: he
            ? `עלות לאינטראקציה משוקללת: ${best.costPerEngagement!.toFixed(2)} מול ${worst.costPerEngagement!.toFixed(2)} ${input.currency}. החשיפה לבדה לא מספרת את הסיפור — שווה לשקול את חלוקת התקציב בסבב הבא.`
            : `Cost per weighted engagement is ${best.costPerEngagement!.toFixed(2)} against ${worst.costPerEngagement!.toFixed(2)} ${input.currency}. Reach alone would have ranked these differently — worth revisiting the split next round.`,
        });
      }
    }

    // Lift over the creator's own baseline, which is the fair comparison.
    const overperformers = active.filter((c) => c.lift != null && c.lift >= 1.4);
    if (overperformers.length > 0) {
      const star = overperformers.sort((a, b) => (b.lift ?? 0) - (a.lift ?? 0))[0];
      out.push({
        id: "lift",
        kind: "TREND",
        confidence: 0.65,
        tone: "positive",
        title: he
          ? `${star.name} מציג מעורבות גבוהה ב-${pct((star.lift ?? 1) - 1)} מהרגיל אצלו`
          : `${star.name} is beating their own baseline by ${pct((star.lift ?? 1) - 1)}`,
        body: he
          ? `שיעור המעורבות בקמפיין הוא ${pct(star.engagementRate)} לעומת ${pct(star.baselineEr ?? 0)} בממוצע. זה סימן להתאמה טובה בין התוכן לקהל, לא רק לגודל החשבון.`
          : `Engagement here is ${pct(star.engagementRate)} against their usual ${pct(star.baselineEr ?? 0)}. That points to genuine fit between the content and the audience, not just account size.`,
      });
    }
  }

  /* --------------------------- under-delivery ------------------------ */

  const behind = contribution.filter((c) => c.underDelivering);
  if (behind.length > 0) {
    const missing = behind.reduce((s, c) => s + (c.planned - c.published), 0);
    out.push({
      id: "delivery",
      kind: "ANOMALY",
      confidence: 0.9,
      tone: "critical",
      title: he
        ? `${missing} פוסטים חסרים מ-${behind.length} יוצרים`
        : `${missing} contracted posts are missing from ${behind.length} creators`,
      body: he
        ? `${behind.map((c) => c.name).join(", ")} טרם סיפקו את כל המוסכם. תת-אספקה מורידה את רכיב הפריסה במדד הבולטות, כך שהציון כבר משקף זאת.`
        : `${behind.map((c) => c.name).join(", ")} haven't published everything they were booked for. Under-delivery reduces the breadth component of Prominence, so the score already reflects it.`,
    });
  }

  /* ----------------------------- format mix -------------------------- */

  const byFormat = new Map<string, { reach: number; count: number }>();
  for (const post of posts) {
    const key = post.postType;
    const bucket = byFormat.get(key) ?? { reach: 0, count: 0 };
    bucket.reach += post.reach ?? 0;
    bucket.count += 1;
    byFormat.set(key, bucket);
  }
  const formats = [...byFormat.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([k, v]) => ({ format: k, avg: v.reach / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg);

  if (formats.length >= 2 && formats[0].avg > formats.at(-1)!.avg * 1.8) {
    const best = formats[0];
    const worst = formats.at(-1)!;
    out.push({
      id: "format",
      kind: "RECOMMENDATION",
      confidence: 0.6,
      tone: "neutral",
      title: he
        ? `פורמט ${best.format.toLowerCase()} מגיע לקהל גדול פי ${(best.avg / Math.max(worst.avg, 1)).toFixed(1)} מ-${worst.format.toLowerCase()}`
        : `${best.format.toLowerCase()} reaches ${(best.avg / Math.max(worst.avg, 1)).toFixed(1)}× more people than ${worst.format.toLowerCase()}`,
      body: he
        ? `ממוצע של ${n(best.avg)} חשיפות לפוסט מול ${n(worst.avg)}. מדגם קטן (${best.count} ו-${worst.count} פוסטים), אך מספיק כדי לשקול הטיה של האספקה הבאה.`
        : `Averages of ${n(best.avg)} against ${n(worst.avg)} per post. Small sample (${best.count} and ${worst.count} posts), but enough to weight the next set of deliverables.`,
    });
  }

  /* -------------------------- KPI pace ------------------------------- */

  if (input.daysTotal && input.daysElapsed > 2) {
    const elapsed = Math.min(input.daysElapsed / input.daysTotal, 1);
    for (const kpi of kpis) {
      if (kpi.progress >= 1 || elapsed < 0.25) continue;
      const pace = kpi.progress / elapsed;
      if (pace < 0.7) {
        const projected = kpi.actual / Math.max(elapsed, 0.01);
        out.push({
          id: `pace-${kpi.metric}`,
          kind: "ANOMALY",
          confidence: 0.7,
          tone: "warning",
          title: he
            ? `היעד ${kpi.metric.replace(/_/g, " ").toLowerCase()} בקצב של ${pct(pace)} מהנדרש`
            : `${kpi.metric.replace(/_/g, " ").toLowerCase()} is pacing at ${pct(pace)} of target`,
          body: he
            ? `לאחר ${pct(elapsed)} מהקמפיין הושגו ${pct(kpi.progress)} מהיעד. בקצב הנוכחי הקמפיין יסיים סביב ${n(projected)} מול יעד של ${n(kpi.target)}.`
            : `${pct(elapsed)} of the way through, ${pct(kpi.progress)} of the target is met. At this pace it finishes near ${n(projected)} against a target of ${n(kpi.target)}.`,
        });
      }
    }
  }

  /* --------------------------- collection health --------------------- */

  const broken = posts.filter((p) => p.collectionStatus === "UNAVAILABLE" || p.collectionStatus === "FAILED");
  if (broken.length > 0) {
    out.push({
      id: "collection",
      kind: "ANOMALY",
      confidence: 0.95,
      tone: "critical",
      title: he
        ? `${broken.length} פוסטים אינם נאספים`
        : `${broken.length} posts have stopped collecting`,
      body: he
        ? `המספרים שלהם קפואים מאז האיסוף האחרון, ולכן כל סכום בדף הזה נמוך מהמציאות. בדרך כלל הסיבה היא פוסט שנמחק או הפך לפרטי.`
        : `Their numbers are frozen at the last successful reading, so every total on this page is understated. Usually the post was deleted or made private.`,
    });
  }

  /* ------------------------------ summary ---------------------------- */

  if (totals.reach > 0) {
    out.unshift({
      id: "summary",
      kind: "SUMMARY",
      confidence: 1,
      tone: "neutral",
      title: he
        ? `${n(totals.reach)} חשיפה, ${pct(totals.engagementRate)} מעורבות, ${active.length} יוצרים`
        : `${n(totals.reach)} reach at ${pct(totals.engagementRate)} engagement across ${active.length} creators`,
      body: he
        ? `${n(totals.engagements)} אינטראקציות ו-${n(totals.clicks)} קליקים בעלות של ${n(totals.spend)} ${input.currency}. ${
            latest?.prominenceIndex != null
              ? `מדד הבולטות עומד על ${latest.prominenceIndex.toFixed(0)}.`
              : ""
          }`
        : `${n(totals.engagements)} engagements and ${n(totals.clicks)} clicks for ${n(totals.spend)} ${input.currency}. ${
            latest?.prominenceIndex != null
              ? `Prominence sits at ${latest.prominenceIndex.toFixed(0)}.`
              : ""
          }`,
    });
  }

  // Highest-signal first, but the summary always leads.
  const summary = out.filter((i) => i.kind === "SUMMARY");
  const rest = out
    .filter((i) => i.kind !== "SUMMARY")
    .sort((a, b) => {
      const weight = { critical: 3, warning: 2, positive: 1, neutral: 0 };
      return weight[b.tone] - weight[a.tone] || b.confidence - a.confidence;
    });

  return [...summary, ...rest].slice(0, 7);
}
