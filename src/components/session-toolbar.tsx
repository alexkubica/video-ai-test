import { auth, signOut } from "@/auth";

export async function SessionToolbar() {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[var(--border)] bg-white/88 px-4 py-2 shadow-[0_12px_36px_rgba(17,24,39,0.12)] backdrop-blur">
        <span className="max-w-[14rem] truncate text-sm text-[var(--muted-strong)] sm:max-w-none">
          {session.user.email}
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        >
          <button
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
