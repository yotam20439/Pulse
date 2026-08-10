import type { PlatformName } from "@/db/schema";

/**
 * The two custom indices.
 *
 *  • Prominence  (מדד בולטות)     — how loud the campaign was.
 *  • Effectiveness (מדד אפקטיביות) — how much that noise was worth.
 *
 * Both return 0–100 and are deliberately *saturating*, not linear: doubling
 * impressions on an already-huge campaign should not double the score, or a
 * single viral post would flatten every comparison in the dashboard.
 *
 * Every constant below is a business assumption, so it lives here in one file
 * rather than scattered through queries. Changing a weight changes history —
 * bump INDEX_VERSION and re-run the rollup so old scores stay comparable.
 */

export const INDEX_VERSION = "1.0.0";

/**
 * Not all impressions are equal. A 24h story impression is worth less than a
 * YouTube view someone chose to click. Tune against your own post-campaign
 * brand-lift studies.
 */
export const VISIBILITY_WEIGHT: Record<PlatformName, number> = {
  YOUTUBE: 1.3,
  INSTAGRAM: 1.0,
  TIKTOK: 1.0,
  FACEBOOK: 0.8,
  X: 0.7,
  LINKEDIN: 0.9,
  TELEGRAM: 0.6,
};

/** Depth of intent per action. A comment costs more effort than a like. */
export const ENGAGEMENT_WEIGHT = {
  likes: 1,
  comments: 4,
  shares: 6,
  saves: 5,
  clicks: 8,
} as const;

/**
 * Counts straight off a metrics row. Values are `number | null | undefined`
 * because every metric column is nullable — a platform that doesn't report
 * saves gives null, which is meaningfully different from a reported zero.
 * Every read below coalesces to 0, so nulls are safe here.
 */
export type EngagementCounts = Partial<
  Record<keyof typeof ENGAGEMENT_WEIGHT, number | null | undefined>
>;

/* -------------------------------------------------------------------------- */
/*  Primitives                                                                 */
/* -------------------------------------------------------------------------- */

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/**
 * Diminishing-returns curve on [0, ∞) → [0, 1).
 * Returns exactly 0.5 when `value === halfPoint`, so the half-point is the
 * "this is a normal, on-target result" anchor.
 */
export function saturate(value: number, halfPoint: number): number {
  if (halfPoint <= 0 || !Number.isFinite(value) || value <= 0) return 0;
  return value / (value + halfPoint);
}

export const weightedEngagements = (e: EngagementCounts) =>
  (Object.keys(ENGAGEMENT_WEIGHT) as (keyof typeof ENGAGEMENT_WEIGHT)[]).reduce(
    (sum, k) => sum + (e[k] ?? 0) * ENGAGEMENT_WEIGHT[k],
    0,
  );

export const rawEngagements = (e: EngagementCounts) =>
  (e.likes ?? 0) + (e.comments ?? 0) + (e.shares ?? 0) + (e.saves ?? 0);

/* -------------------------------------------------------------------------- */
/*  Prominence — מדד בולטות                                                    */
/* -------------------------------------------------------------------------- */

export type ProminenceInput = {
  /** Per-platform impressions (fall back to reach, then views). */
  impressionsByPlatform: Partial<Record<PlatformName, number>>;
  /** Brand's normal monthly impression volume — the "is this loud?" yardstick. */
  baselineMonthlyImpressions: number;
  /** Distinct creators who actually published. */
  activeCreators: number;
  /** Creators contracted. Under-delivery should cost prominence. */
  plannedCreators: number;
  /** Distinct platforms with at least one live post. */
  platformsCovered: number;
  /** Organic amplification: shares + saves across the campaign. */
  amplifications: number;
  totalReach: number;
};

export const PROMINENCE_WEIGHTS = { volume: 0.55, breadth: 0.25, amplification: 0.2 } as const;

/** Share of shares+saves per reach that counts as strong amplification. */
const AMPLIFICATION_HALF_POINT = 0.015;

export function prominenceIndex(input: ProminenceInput) {
  const weightedImpressions = (
    Object.entries(input.impressionsByPlatform) as [PlatformName, number][]
  ).reduce((sum, [p, v]) => sum + (v ?? 0) * (VISIBILITY_WEIGHT[p] ?? 1), 0);

  // Volume: hitting the brand's usual monthly impressions scores 0.5.
  const volume = saturate(weightedImpressions, Math.max(input.baselineMonthlyImpressions, 1));

  // Breadth: delivering the full roster across ≥2 platforms scores ~1.
  const rosterFill = clamp(input.activeCreators / Math.max(input.plannedCreators, 1));
  const spread = clamp(input.platformsCovered / 3);
  const breadth = 0.7 * rosterFill + 0.3 * spread;

  // Amplification: the audience doing the distribution for you.
  const amplificationRate = input.totalReach > 0 ? input.amplifications / input.totalReach : 0;
  const amplification = saturate(amplificationRate, AMPLIFICATION_HALF_POINT);

  const score =
    PROMINENCE_WEIGHTS.volume * volume +
    PROMINENCE_WEIGHTS.breadth * breadth +
    PROMINENCE_WEIGHTS.amplification * amplification;

  return {
    score: Math.round(clamp(score) * 1000) / 10, // 0–100, one decimal
    components: { volume, breadth, amplification },
    inputs: { weightedImpressions, amplificationRate, version: INDEX_VERSION },
  };
}

/* -------------------------------------------------------------------------- */
/*  Effectiveness — מדד אפקטיביות                                              */
/* -------------------------------------------------------------------------- */

export type EffectivenessInput = {
  engagements: EngagementCounts;
  reach: number;
  /** Cash fees + in-kind value, in the campaign currency. */
  spend: number;
  /**
   * Blended engagement rate the same creators produce organically, 0–1.
   * Beating a creator's own baseline is the real signal — a 6% ER is
   * excellent for a macro account and mediocre for a nano one.
   */
  baselineEngagementRate: number;
  /** Cost per weighted engagement the brand considers "on plan". */
  targetCpe?: number;
  /** Optional explicit KPI attainment, 0–1.2 (see kpiAttainment()). */
  kpiAttainment?: number;
};

export const EFFECTIVENESS_WEIGHTS = { quality: 0.35, efficiency: 0.35, attainment: 0.3 } as const;

const DEFAULT_TARGET_CPE = 2.5;

export function effectivenessIndex(input: EffectivenessInput) {
  const wEng = weightedEngagements(input.engagements);
  const engagementRate = input.reach > 0 ? rawEngagements(input.engagements) / input.reach : 0;

  // Quality: lift over the creators' own baseline. Parity = 0.5.
  const lift = engagementRate / Math.max(input.baselineEngagementRate, 0.001);
  const liftScore = saturate(lift, 1);
  // Depth: how much of the engagement was comments/shares rather than taps.
  const depth = wEng > 0 ? clamp(1 - (input.engagements.likes ?? 0) / wEng) : 0;
  const quality = 0.7 * liftScore + 0.3 * depth;

  // Efficiency: cheaper than target CPE scores above 0.5.
  const cpe = wEng > 0 ? input.spend / wEng : Infinity;
  const target = input.targetCpe ?? DEFAULT_TARGET_CPE;
  const efficiency = Number.isFinite(cpe) ? clamp(saturate(target / Math.max(cpe, 1e-6), 1)) : 0;

  const attainment = clamp(input.kpiAttainment ?? 0.5, 0, 1.2) / 1.2;

  const score =
    EFFECTIVENESS_WEIGHTS.quality * quality +
    EFFECTIVENESS_WEIGHTS.efficiency * efficiency +
    EFFECTIVENESS_WEIGHTS.attainment * attainment;

  return {
    score: Math.round(clamp(score) * 1000) / 10,
    components: { quality, efficiency, attainment },
    inputs: { weightedEngagements: wEng, engagementRate, cpe, version: INDEX_VERSION },
  };
}

/**
 * Weighted attainment across the campaign's declared KPIs.
 * Over-delivery is credited but capped at 120% so one runaway metric can't
 * paper over three missed ones.
 */
export function kpiAttainment(
  kpis: { metric: string; target: number; actual: number; weight: number }[],
) {
  if (kpis.length === 0) return 0.5; // no KPIs declared → neutral
  const totalWeight = kpis.reduce((s, k) => s + k.weight, 0) || 1;
  const sum = kpis.reduce((s, k) => {
    const ratio = k.target > 0 ? k.actual / k.target : 0;
    return s + k.weight * Math.min(ratio, 1.2);
  }, 0);
  return sum / totalWeight;
}

/** Shared vocabulary for the UI so a score means the same thing everywhere. */
export function indexBand(score: number) {
  if (score >= 75) return { label: "Strong", tone: "positive" as const };
  if (score >= 55) return { label: "On plan", tone: "neutral" as const };
  if (score >= 35) return { label: "Soft", tone: "warning" as const };
  return { label: "Underperforming", tone: "critical" as const };
}
