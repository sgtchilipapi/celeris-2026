"use client";

import { useEffect, useState } from "react";
import { createCelerisBrowserClient } from "@celeris/sdk-browser";
import { authSessionResponseSchema } from "@celeris/shared";
import { getWebRuntimeConfig } from "../../../src/env";

const developerTokenStorageKey = "celeris.fs011.dashboard.token";

export default function AuthCallbackPage() {
  const config = getWebRuntimeConfig();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const clientKind = params.get("clientKind");
    const appId = params.get("appId");

    if (!code || !state) {
      setErrorMessage("Missing auth callback parameters.");
      return;
    }

    void (async () => {
      try {
        if (clientKind === "app_consumer") {
          if (!appId) {
            throw new Error("Missing app consumer callback appId.");
          }

          const client = createCelerisBrowserClient({
            appId,
            redirectUri: new URL("/auth/callback", config.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN).toString()
          });

          await client.auth.handleRedirectCallback(window.location.href);
          window.sessionStorage.setItem("celeris.demo.appId", appId);
          window.location.href = new URL("/", config.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN).toString();
          return;
        }

        const response = await fetch(new URL("/v1/auth/token", config.NEXT_PUBLIC_API_ORIGIN), {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            code,
            state
          })
        });
        const payload = authSessionResponseSchema.parse(await response.json());
        window.sessionStorage.setItem(developerTokenStorageKey, payload.session.token);
        document.cookie = `celeris_dashboard_session=${payload.session.token}; Path=/; SameSite=Lax`;
        window.location.href = new URL("/", config.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN).toString();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Token exchange failed");
      }
    })();
  }, [
    config.NEXT_PUBLIC_API_ORIGIN,
    config.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN,
    config.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN
  ]);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Developer Dashboard</p>
        <h1>Completing sign-in</h1>
        <p className="lede">Exchanging the shared auth code for a dashboard session.</p>
      </section>
      {errorMessage ? (
        <section className="panel">
          <h2>Auth error</h2>
          <p className="error-text">{errorMessage}</p>
        </section>
      ) : null}
    </main>
  );
}
