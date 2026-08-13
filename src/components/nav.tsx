import { signOut } from "@/actions/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const Nav = async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-rule px-4 sm:px-6 py-4 flex items-center justify-between">
      <span className="font-display text-xl text-ink">noclash</span>
      {user ? (
        <form action={signOut} className="flex items-center gap-3">
          <span className="text-sm text-ink-muted">{user.email}</span>
          <button
            type="submit"
            className="text-sm text-accent underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            Sign out
          </button>
        </form>
      ) : (
        <Link
          href="/sign-in"
          className="text-sm text-accent underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          Sign in
        </Link>
      )}
    </header>
  );
};
