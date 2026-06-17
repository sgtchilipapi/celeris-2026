interface HomeShellProps {
  mode: "developer-app" | "demo" | "hosted-auth";
  config: {
    apiOrigin: string;
    hostedAuthOrigin: string;
    developerAppOrigin: string;
    demoFrontendOrigin: string;
  };
}

export function HomeShell({ mode, config }: HomeShellProps) {
  const content = {
    "developer-app": {
      title: "Developer Dashboard Surface",
      lede: "This origin hosts the Celeris dashboard and the developer setup console after shared auth completes.",
      links: [
        { href: "/", label: "Dashboard home" },
        { href: "/setup", label: "Setup console" },
        { href: config.hostedAuthOrigin, label: "Shared auth origin" }
      ]
    },
    demo: {
      title: "Hello Celeris Demo",
      lede: "This origin is reserved for the SDK consumer app and no longer doubles as the developer setup surface.",
      links: [
        { href: config.demoFrontendOrigin, label: "Demo home" },
        { href: config.developerAppOrigin, label: "Developer dashboard" },
        { href: config.hostedAuthOrigin, label: "Shared auth origin" }
      ]
    },
    "hosted-auth": {
      title: "Shared Auth Surface",
      lede: "This origin hosts the shared sign-in contract used by the first-party dashboard now and app consumers in the next slice.",
      links: [
        { href: "/sign-in", label: "Developer sign-in" },
        { href: config.developerAppOrigin, label: "Developer dashboard" },
        { href: config.demoFrontendOrigin, label: "Demo home" }
      ]
    }
  }[mode];

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Celeris Fresh Start</p>
        <h1>{content.title}</h1>
        <p className="lede">{content.lede}</p>
      </section>

      <section className="panel">
        <h2>Runtime</h2>
        <dl>
          <div>
            <dt>API Origin</dt>
            <dd>{config.apiOrigin}</dd>
          </div>
          <div>
            <dt>Auth Origin</dt>
            <dd>{config.hostedAuthOrigin}</dd>
          </div>
          <div>
            <dt>Dashboard Origin</dt>
            <dd>{config.developerAppOrigin}</dd>
          </div>
          <div>
            <dt>Demo Origin</dt>
            <dd>{config.demoFrontendOrigin}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>Surface Links</h2>
        <ul>
          {content.links.map((link) => (
            <li key={link.label}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
