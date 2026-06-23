import { signIn } from "@/auth";
import { getAuthorizedEmail } from "@/lib/auth-helpers";

type SignInPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "AccessDenied":
      return "That Google account is not allowed to use this app.";
    case "Configuration":
      return "Authentication is not configured correctly yet.";
    default:
      return "";
  }
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const callbackUrl = resolvedSearchParams?.callbackUrl || "/";
  const errorMessage = getErrorMessage(resolvedSearchParams?.error);
  const authorizedEmail = getAuthorizedEmail();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-8 sm:px-6">
      <section className="w-full overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)] backdrop-blur sm:p-8">
        <div className="space-y-6 rounded-[1.8rem] border border-[var(--border)] bg-[var(--panel-strong)] p-6 sm:p-8">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-[var(--border-strong)] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-strong)]">
              Frameflow
            </span>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] sm:text-5xl">
                Sign in with Google
              </h1>
              <p className="max-w-xl text-base leading-7 text-[var(--muted)]">
                This app uses the configured server OpenRouter key and is restricted
                to one approved Google account.
              </p>
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-[var(--border)] bg-white/72 p-4">
            <p className="text-sm text-[var(--muted)]">Allowed account</p>
            <p className="mt-2 text-lg font-semibold">
              {authorizedEmail || "Missing AUTHORIZED_EMAIL"}
            </p>
          </div>

          {errorMessage ? (
            <p className="rounded-[1.2rem] bg-rose-100 px-4 py-3 text-sm text-rose-800">
              {errorMessage}
            </p>
          ) : null}

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
          >
            <button
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-4 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
              type="submit"
            >
              Continue with Google
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
