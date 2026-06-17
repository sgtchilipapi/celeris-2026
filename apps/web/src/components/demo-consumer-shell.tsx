"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createCelerisBrowserClient } from "@celeris/sdk-browser";
import type { AuthSession } from "@celeris/shared";

const demoAppIdStorageKey = "celeris.demo.appId";

interface DemoConsumerShellProps {
  apiOrigin: string;
  hostedAuthOrigin: string;
  demoFrontendOrigin: string;
  initialAppId?: string;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

export function DemoConsumerShell({
  apiOrigin,
  hostedAuthOrigin,
  demoFrontendOrigin,
  initialAppId = ""
}: DemoConsumerShellProps) {
  const [appId, setAppId] = useState(initialAppId);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready for demo sign-in.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const client = useMemo(
    () =>
      appId
        ? createCelerisBrowserClient({
            appId,
            apiOrigin,
            hostedAuthOrigin,
            redirectUri: new URL("/auth/callback", demoFrontendOrigin).toString()
          })
        : null,
    [apiOrigin, appId, demoFrontendOrigin, hostedAuthOrigin]
  );

  useEffect(() => {
    const storedAppId = window.sessionStorage.getItem(demoAppIdStorageKey);

    if (!initialAppId && storedAppId) {
      setAppId(storedAppId);
    }
  }, [initialAppId]);

  useEffect(() => {
    if (!client) {
      return;
    }

    void (async () => {
      try {
        const currentSession = await client.auth.getSession();
        setSession(currentSession);
        setStatusMessage(currentSession ? "Signed in to the demo app." : "Ready for demo sign-in.");
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      }
    })();
  }, [client]);

  async function handleAppConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!appId.trim()) {
      setErrorMessage("App ID is required.");
      return;
    }

    window.sessionStorage.setItem(demoAppIdStorageKey, appId.trim());
    setAppId(appId.trim());
    setStatusMessage("Demo app config saved.");
    setErrorMessage(null);
  }

  async function handleSignIn() {
    if (!client || !appId) {
      setErrorMessage("Configure an app ID before signing in.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      window.sessionStorage.setItem(demoAppIdStorageKey, appId);
      await client.auth.startLogin();
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
      setIsBusy(false);
    }
  }

  async function handleSignOut() {
    if (!client) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      await client.auth.signOut();
      setSession(null);
      setStatusMessage("Signed out.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="workspace demo-workspace">
      <section className="workspace-header">
        <div>
          <p className="workspace-kicker">Hello Celeris Demo</p>
          <h1>Reference consumer app</h1>
          <p className="workspace-copy">
            This demo surface uses the public browser SDK against the shared hosted auth contract.
          </p>
        </div>
        <dl className="runtime-grid">
          <div>
            <dt>Demo origin</dt>
            <dd>{demoFrontendOrigin}</dd>
          </div>
          <div>
            <dt>Auth origin</dt>
            <dd>{hostedAuthOrigin}</dd>
          </div>
          <div>
            <dt>API origin</dt>
            <dd>{apiOrigin}</dd>
          </div>
        </dl>
      </section>

      <section className="workspace-grid demo-grid">
        <section className="workspace-band">
          <h2>App config</h2>
          <form className="form-grid" onSubmit={handleAppConfig}>
            <label>
              <span>App ID</span>
              <input onChange={(event) => setAppId(event.target.value)} type="text" value={appId} />
            </label>
            <button className="button" type="submit">
              Use app
            </button>
          </form>
        </section>

        <section className="workspace-band">
          <div className="band-header">
            <div>
              <h2>User session</h2>
              <p>{statusMessage}</p>
            </div>
            {session ? (
              <button className="button secondary" disabled={isBusy} onClick={handleSignOut} type="button">
                Sign out
              </button>
            ) : (
              <button className="button" disabled={isBusy || !appId} onClick={handleSignIn} type="button">
                Sign in
              </button>
            )}
          </div>

          <dl className="runtime-grid">
            <div>
              <dt>Email</dt>
              <dd>{session?.user.email ?? "Not signed in"}</dd>
            </div>
            <div>
              <dt>Wallet</dt>
              <dd>{session?.user.walletAddress ?? "Not signed in"}</dd>
            </div>
            <div>
              <dt>Audience</dt>
              <dd>{session ? `${session.clientKind}:${session.clientId}` : "Not signed in"}</dd>
            </div>
          </dl>
        </section>
      </section>

      {errorMessage ? (
        <section className="status-band error">
          <p>{errorMessage}</p>
        </section>
      ) : null}
    </main>
  );
}
