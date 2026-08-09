import Link from "next/link";

/**
 * Rendered by forbidden() in requireBrandAccess(). It names the constraint and
 * the way out — a 403 that just says "Forbidden" sends people to Slack.
 */
export default function Forbidden() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="eyebrow">403</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">No access to this brand</h1>
      <p className="mt-2 text-sm text-muted">
        Your account isn&apos;t assigned to the brand this page belongs to. An administrator can
        grant access from Settings → People.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-9 items-center rounded-md border border-line px-4 text-sm hover:bg-sunken"
      >
        Back to overview
      </Link>
    </div>
  );
}
