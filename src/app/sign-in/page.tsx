import { authWithGithub } from "@/actions/auth";
import { MagicLinkForm } from "@/components/magic-link-form";

export default function ResourcePage() {
  return (
    <main className="px-4 sm:px-6 py-6 max-w-md">
      <h1 className="font-display text-2xl sm:text-3xl text-ink">Sign In</h1>
      <div className="mt-5">
        <form action={authWithGithub}>
          <button
            type="submit"
            className="text-sm text-accent underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            Sign in with GitHub
          </button>
        </form>
        <span>or</span>
        <MagicLinkForm />
      </div>
    </main>
  );
}
