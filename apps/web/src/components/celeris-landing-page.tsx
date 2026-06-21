const socialLinks = [
  { href: "https://github.com/sgtchilipapi/celeris-2026", label: "GitHub" },
  { href: "https://x.com/sgtchilipapi", label: "X" }
];

const contactHref = "https://x.com/CelerisPro";
const demoHref = "https://demo.celeris.pro";

export function CelerisLandingPage() {
  return (
    <main className="landing-page">
      <div className="landing-orbit" aria-hidden="true" />
      <header className="landing-header" aria-label="Celeris">
        <a className="landing-brand" href="/">
          Celeris
        </a>
        <nav className="landing-nav" aria-label="Primary">
          <a className="landing-text-link" href={demoHref}>
            Demo
          </a>
          <a className="landing-text-link" href={contactHref}>
            Contact
          </a>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <p className="landing-kicker">Credit infrastructure for Sui dApps</p>
        <h1 id="landing-title">Credit-based blockchain usage for Sui dApps.</h1>
        <p className="landing-lede">
          Let users perform sponsored onchain actions through credits, without wallet setup, gas funding, or crypto onboarding.
        </p>
        <div className="landing-actions">
          <a className="landing-button" href={demoHref}>
            Try the demo
          </a>
          <a className="landing-quiet-link" href={contactHref}>
            Contact me
          </a>
        </div>
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
          <p>The dApp controls the action. Celeris handles sponsorship.</p>
        </div>
      </section>

      <section className="landing-section landing-benefits" aria-labelledby="benefits-title">
        <h2 id="benefits-title">How it works</h2>
        <div className="landing-benefit-grid">
          <article className="landing-card">
            <span>01</span>
            <h3>Configure actions</h3>
            <p>Register approved app actions and credit prices in the Celeris dashboard.</p>
          </article>
          <article className="landing-card">
            <span>02</span>
            <h3>Sponsor usage</h3>
            <p>Use the browser SDK to request sponsorship for user-built Sui transactions.</p>
          </article>
          <article className="landing-card">
            <span>03</span>
            <h3>Track outcomes</h3>
            <p>Capture credits, reconcile transactions, and show a clean user-facing feed.</p>
          </article>
        </div>
      </section>

      <section className="landing-final" aria-labelledby="final-title">
        <h2 id="final-title">Building a Sui app that should not feel like crypto?</h2>
        <a className="landing-button" href={contactHref}>
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
