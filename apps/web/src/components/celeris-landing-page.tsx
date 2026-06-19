const socialLinks = [
  { href: "#", label: "GitHub" },
  { href: "#", label: "X" },
  { href: "#", label: "LinkedIn" }
];

export function CelerisLandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-header" aria-label="Celeris">
        <a className="landing-brand" href="/">
          Celeris
        </a>
        <a className="landing-text-link" href="mailto:hello@celeris.pro">
          Contact
        </a>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <p className="landing-kicker">Sui dApps</p>
        <h1 id="landing-title">Credit-based blockchain usage for Sui dApps.</h1>
        <p className="landing-lede">
          Let users perform sponsored onchain actions through credits, without wallet setup, gas funding, or crypto
          onboarding.
        </p>
        <a className="landing-button" href="mailto:hello@celeris.pro">
          Contact me
        </a>
      </section>

      <section className="landing-section" aria-labelledby="problem-title">
        <h2 id="problem-title">The problem</h2>
        <div className="landing-copy">
          <p>Blockchain apps lose users before they reach the product.</p>
          <p>Wallet setup. Gas funding. Transaction confusion.</p>
          <p>That friction should not be the first user experience.</p>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="solution-title">
        <h2 id="solution-title">Celeris</h2>
        <div className="landing-copy">
          <p>Celeris lets dApps offer credit-based onchain actions.</p>
          <p>Users log in, spend credits, and trigger approved transactions.</p>
          <p>The dApp controls the action.</p>
          <p>Celeris handles sponsorship.</p>
        </div>
      </section>

      <section className="landing-final" aria-labelledby="final-title">
        <h2 id="final-title">Building a Sui app that should not feel like crypto?</h2>
        <a className="landing-button" href="mailto:hello@celeris.pro">
          Contact me
        </a>
      </section>

      <footer className="landing-footer">
        <p>Celeris © 2026</p>
        <nav aria-label="Social links">
          {socialLinks.map((link) => (
            <a key={link.label} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </footer>
    </main>
  );
}
