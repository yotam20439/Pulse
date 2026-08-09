import { signIn } from "@/auth";

export const metadata = { title: "Sign in" };

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="tnum text-sm font-semibold tracking-tight">PULSE</p>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Use the work account your administrator added. Accounts are created by admins, not
          by signing up.
        </p>

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="h-10 w-full rounded-md bg-ink px-4 text-sm font-medium text-white"
          >
            Continue with Google
          </button>
        </form>

        <ErrorNote searchParams={searchParams} />
      </div>
    </div>
  );
}

async function ErrorNote({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p className="mt-4 rounded-md border border-line bg-surface p-3 text-sm text-critical">
      That account can&apos;t sign in. Ask an admin to add it, or check that it hasn&apos;t
      been deactivated.
    </p>
  );
}
