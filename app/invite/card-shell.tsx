/** Centred invitation card: 375px-first (16px side margins), 440px max on desktop, safe-area aware. */
export function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="invite-backdrop flex min-h-dvh items-center justify-center"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <div className="paper-card w-full max-w-[440px] px-7 py-12 text-center text-ink sm:px-10 sm:py-14">
        {children}
      </div>
    </main>
  );
}

export function GoldRule({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`foil-rule mx-auto w-24 ${className}`} />;
}

/** Ampersand for the Pinyon Script names: EB Garamond italic, slightly smaller, gold foil by default. */
export function Amp({ className = "foil-text" }: { className?: string }) {
  return (
    <span className={`mx-[0.04em] align-[0.04em] font-serif text-[0.78em] italic ${className}`}>
      &amp;
    </span>
  );
}
