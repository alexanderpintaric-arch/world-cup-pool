import { handleSignIn } from "@/app/actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl ?? "/";

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div
        className="w-full max-w-[22rem] anim-scale-in"
        style={{ animationDelay: "0.05s" }}
      >

        {/* Brand mark */}
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-baseline gap-2 group">
            <span
              className="font-serif italic text-[28px] font-medium ink leading-none"
              style={{ fontVariationSettings: '"opsz" 60' }}
            >
              WC&nbsp;Pool
            </span>
            <span className="font-mono text-[13px] font-medium tabular ink-faint group-hover:text-accent transition-colors">
              &rsquo;26
            </span>
          </a>
          <p className="mt-3 text-[13.5px] ink-soft leading-relaxed">
            The 2026 World Cup. Your picks. Your league.
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-line rounded-2xl shadow-lift overflow-hidden">

          {/* Top accent stripe */}
          <div className="h-1 w-full bg-accent" />

          <div className="p-7">
            <h1
              className="font-serif text-[22px] font-medium ink leading-tight mb-1"
              style={{ fontVariationSettings: '"opsz" 32' }}
            >
              Sign in to continue
            </h1>
            <p className="text-[13px] ink-faint mb-7 leading-relaxed">
              Pick every match. Climb your league. Settle every argument.
            </p>

            {/* Google sign-in button */}
            <form action={handleSignIn}>
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
              <button
                type="submit"
                className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-ink text-paper rounded-xl text-[14px] font-semibold hover:bg-accent transition-colors duration-200 group"
              >
                {/* Google logo */}
                <svg
                  className="h-5 w-5 flex-shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span className="flex-1 text-left">Continue with Google</span>
                <svg
                  className="h-4 w-4 opacity-40 group-hover:opacity-70 transition-opacity"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M6 3l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </form>

            {/* Divider + note */}
            <p className="mt-5 text-center text-[11.5px] ink-faint leading-relaxed">
              By signing in you agree to play fair and accept<br />
              crushing defeats with dignity.
            </p>
          </div>
        </div>

        {/* Back link */}
        <p className="text-center mt-5">
          <a
            href="/"
            className="text-[12.5px] ink-faint hover:ink-soft transition-colors editorial-underline"
          >
            ← Back to home
          </a>
        </p>

      </div>
    </div>
  );
}
