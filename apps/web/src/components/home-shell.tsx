interface HomeShellProps {
  mode: "demo" | "hosted-auth";
  config: {
    apiOrigin: string;
    hostedAuthOrigin: string;
  };
}

export function HomeShell({ mode, config }: HomeShellProps) {
  const isHostedAuth = mode === "hosted-auth";

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Celeris Fresh Start</p>
        <h1>{isHostedAuth ? "Hosted Auth Shell" : "Demo App Shell"}</h1>
        <p className="lede">
          FS-00 bootstraps the public surfaces for the demo UI and hosted auth UI without pulling later-slice
          product flows forward.
        </p>
      </section>

      <section className="panel">
        <h2>Runtime</h2>
        <dl>
          <div>
            <dt>API Origin</dt>
            <dd>{config.apiOrigin}</dd>
          </div>
          <div>
            <dt>Hosted Auth Origin</dt>
            <dd>{config.hostedAuthOrigin}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>Route Groups</h2>
        <ul>
          <li>{isHostedAuth ? "This surface hosts Google auth flows in later slices." : "This surface hosts the player-facing demo app."}</li>
          <li>
            <a href="/">Demo shell</a>
          </li>
          <li>
            <a href="/hosted-auth">Hosted auth shell</a>
          </li>
          <li>
            <a href="/setup">Developer setup console</a>
          </li>
        </ul>
      </section>
    </main>
  );
}
