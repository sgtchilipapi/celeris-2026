"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createCelerisBrowserClient } from "@celeris/sdk-browser";
import {
  CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
  type AppBalance,
  type AppCatalog,
  type AppTransactionRecord,
  type AuthSession
} from "@celeris/shared";

const demoAppIdStorageKey = "celeris.demo.appId";

interface DemoConsumerShellProps {
  apiOrigin: string;
  hostedAuthOrigin: string;
  demoFrontendOrigin: string;
  suiRpcOrigin: string;
  initialAppId?: string;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

export function DemoConsumerShell({
  apiOrigin,
  hostedAuthOrigin,
  demoFrontendOrigin,
  suiRpcOrigin,
  initialAppId = ""
}: DemoConsumerShellProps) {
  const [appId, setAppId] = useState(initialAppId);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [catalog, setCatalog] = useState<AppCatalog | null>(null);
  const [balance, setBalance] = useState<AppBalance | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready for demo sign-in.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [checkoutCredits, setCheckoutCredits] = useState(100);
  const [username, setUsername] = useState("");
  const [transactions, setTransactions] = useState<AppTransactionRecord[]>([]);

  const client = useMemo(
    () =>
      appId
        ? createCelerisBrowserClient({
            appId,
            apiOrigin,
            hostedAuthOrigin,
            suiRpcOrigin,
            redirectUri: new URL("/auth/callback", demoFrontendOrigin).toString()
          })
        : null,
    [apiOrigin, appId, demoFrontendOrigin, hostedAuthOrigin, suiRpcOrigin]
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
        const [currentSession, currentCatalog, currentTransactions] = await Promise.all([
          client.auth.getSession(),
          client.apps.getCatalog(),
          client.transactions.list()
        ]);
        setSession(currentSession);
        setCatalog(currentCatalog);
        setTransactions(currentTransactions);
        setStatusMessage(currentSession ? "Signed in to the demo app." : "Ready for demo sign-in.");
        if (currentSession) {
          setBalance(await client.credits.getBalance());
        } else {
          setBalance(null);
        }
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      }
    })();
  }, [client]);

  const sayHelloAction = catalog?.actions.find((action) => action.actionType === CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO) ?? null;

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
      setBalance(null);
      setTransactions(await client.transactions.list());
      setStatusMessage("Signed out.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!client || !session) {
      setErrorMessage("Sign in before buying credits.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      await client.credits.startCheckout({
        credits: checkoutCredits,
        successRedirectUrl: new URL("/?checkout=success", demoFrontendOrigin).toString(),
        cancelRedirectUrl: new URL("/?checkout=canceled", demoFrontendOrigin).toString()
      });
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
      setIsBusy(false);
    }
  }

  async function handleSayHello(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!client || !session) {
      setErrorMessage("Sign in before executing say_hello.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const result = await client.actions.sayHello({ username });
      setBalance(result.balance);
      setTransactions(await client.transactions.list());
      setStatusMessage(`Submitted ${result.message}`);
      setUsername("");
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

        <section className="workspace-band">
          <div className="band-header">
            <div>
              <h2>Credits</h2>
              <p>Buy demo credits through hosted mock checkout.</p>
            </div>
          </div>
          <dl className="runtime-grid">
            <div>
              <dt>Balance</dt>
              <dd>{balance ? `${balance.availableCredits} credits` : session ? "Loading" : "Sign in required"}</dd>
            </div>
            <div>
              <dt>Say hello price</dt>
              <dd>{sayHelloAction ? `${sayHelloAction.priceCredits} credits` : "Not configured"}</dd>
            </div>
          </dl>
          <form className="form-grid compact checkout-form" onSubmit={handleCheckout}>
            <label>
              <span>Credits</span>
              <input
                min="1"
                onChange={(event) => setCheckoutCredits(Number(event.target.value))}
                type="number"
                value={checkoutCredits}
              />
            </label>
            <button className="button" disabled={isBusy || !session} type="submit">
              Buy credits
            </button>
          </form>
        </section>

        <section className="workspace-band">
          <div className="band-header">
            <div>
              <h2>Say Hello</h2>
              <p>Execute the configured sponsored action with demo credits.</p>
            </div>
          </div>
          <form className="form-grid compact" onSubmit={handleSayHello}>
            <label>
              <span>Username</span>
              <input
                maxLength={32}
                onChange={(event) => setUsername(event.target.value)}
                type="text"
                value={username}
              />
            </label>
            <button className="button" disabled={isBusy || !session || !sayHelloAction} type="submit">
              Say Hello Celeris
            </button>
          </form>
        </section>

        <section className="workspace-band">
          <div className="band-header">
            <div>
              <h2>Feed</h2>
              <p>Newest managed transactions for this app.</p>
            </div>
          </div>
          <div className="list-stack">
            {transactions.length > 0 ? (
              transactions.map((transaction) => (
                <a className="list-row" href={transaction.explorerUrl} key={transaction.transactionId}>
                  <strong>{transaction.message}</strong>
                  <small>{transaction.digest}</small>
                  <small>{transaction.walletAddress}</small>
                </a>
              ))
            ) : (
              <p className="empty-state">No transactions recorded yet.</p>
            )}
          </div>
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
