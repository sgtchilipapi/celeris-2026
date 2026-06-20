"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useCelerisBrowserClient } from "@celeris/sdk-browser/react";
import {
  CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
  type AppBalance,
  type AppCatalog,
  type AppTransactionRecord,
  type AuthSession
} from "@celeris/shared";
import { Button } from "./ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const HELLO_CELERIS_APP_STATE_OBJECT_ID = "0xda981bd16f6692d4884c6b682c6ef51851b4f2beae6e3f6992e79135fbd72180";

const DEMO_SUI_RPC_ORIGIN = "https://fullnode.testnet.sui.io:443";
const HELLO_CELERIS_PACKAGE_ID = "0x35b7d650cb0f5f45fcc651e65dc903ae9342e6d3c49a09ab4a6ed27861a8439f";

const demoAppIdStorageKey = "celeris.demo.appId";

interface DemoConsumerShellProps {
  appId: string;
  demoOrigin: string;
  suiRpcOrigin?: string;
}

function toSuiScanTestnetTxUrl(digest: string) {
  return `https://suiscan.xyz/testnet/tx/${encodeURIComponent(digest)}`;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

export function DemoConsumerShell({ appId, demoOrigin, suiRpcOrigin = DEMO_SUI_RPC_ORIGIN }: DemoConsumerShellProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [catalog, setCatalog] = useState<AppCatalog | null>(null);
  const [balance, setBalance] = useState<AppBalance | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready for demo sign-in.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isCreditsDialogOpen, setIsCreditsDialogOpen] = useState(false);
  const [checkoutUsdAmount, setCheckoutUsdAmount] = useState(5);
  const [username, setUsername] = useState("");
  const [transactions, setTransactions] = useState<AppTransactionRecord[]>([]);

  const client = useCelerisBrowserClient({
    appId,
    suiRpcOrigin,
    redirectUri: new URL("/auth/callback", demoOrigin).toString()
  });

  useEffect(() => {
    window.sessionStorage.setItem(demoAppIdStorageKey, appId);
  }, [appId]);

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
  const enabledActions = catalog?.actions ?? [];

  async function handleSignIn() {
    if (!client) {
      setErrorMessage("Demo app ID is required.");
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
        usdAmount: checkoutUsdAmount,
        successRedirectUrl: new URL("/?checkout=success", demoOrigin).toString(),
        cancelRedirectUrl: new URL("/?checkout=canceled", demoOrigin).toString()
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

    if (!HELLO_CELERIS_APP_STATE_OBJECT_ID.trim()) {
      setErrorMessage("HELLO_CELERIS_APP_STATE_OBJECT_ID is required.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const result = await client.actions.sayHello({ appStateObjectId: HELLO_CELERIS_APP_STATE_OBJECT_ID, username });
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
      <Card className="workspace-header demo-hero">
        <div>
          <p className="workspace-kicker">DEMO APP USING CELERIS BROWSER-SDK</p>
          <h1>Hello Celeris!</h1>
          <p className="workspace-copy">Sign in, buy a few credits, and send one bright hello.</p>
        </div>
      </Card>
{/* 
      <div className="demo-sunfield" aria-hidden="true">
        <div className="demo-sun" />
        <div className="demo-cloud demo-cloud-one" />
        <div className="demo-cloud demo-cloud-two" />
        <div className="demo-hill demo-hill-back" />
        <div className="demo-hill demo-hill-front" />
        <div className="demo-flower demo-flower-one" />
        <div className="demo-flower demo-flower-two" />
        <div className="demo-flower demo-flower-three" />
      </div> */}

      <section className="workspace-grid demo-grid">
        {/* <Card className="workspace-band demo-panel">
          <h2>App config</h2>
          <dl className="runtime-grid">
            <div>
              <dt>App ID</dt>
              <dd>{appId}</dd>
            </div>
            <div>
              <dt>Package</dt>
              <dd>{HELLO_CELERIS_PACKAGE_ID}</dd>
            </div>
            <div>
              <dt>App state</dt>
              <dd>{HELLO_CELERIS_APP_STATE_OBJECT_ID}</dd>
            </div>
          </dl>
        </Card> */}

        <Card className="workspace-band demo-panel">
          <CardHeader>
            <div>
              <CardTitle>Hello there!</CardTitle>
              {/* <CardDescription>{statusMessage}</CardDescription> */}
            </div>
            {session ? (
              <Button variant="secondary" disabled={isBusy} onClick={handleSignOut} type="button">
                Sign out
              </Button>
            ) : (
              <Button disabled={isBusy || !appId} onClick={handleSignIn} type="button">
                Sign in
              </Button>
            )}
          </CardHeader>

          <dl className="runtime-grid">
            <div>
              <dt>Email</dt>
              <dd>{session?.user.email ?? "Not signed in"}</dd>
            </div>
            <div className="demo-balance-row">
              <div>
                <dt>Credits balance</dt>
                <dd>{balance ? `${balance.availableCredits} credits` : session ? "Loading" : "Sign in required"}</dd>
              </div>
              <button
                aria-label="Buy credits"
                className="demo-credit-add-button"
                disabled={!session}
                onClick={() => setIsCreditsDialogOpen(true)}
                type="button"
              >
                +
              </button>
            </div>
            {/* <div>
              <dt>Wallet</dt>
              <dd>{session?.user.walletAddress ?? "Not signed in"}</dd>
            </div> */}
            {/* <div>
              <dt>Audience</dt>
              <dd>{session ? `${session.clientKind}:${session.clientId}` : "Not signed in"}</dd>
            </div> */}
          </dl>
        </Card>

        <Card className="workspace-band demo-panel demo-action-panel">
          <CardHeader>
            <div>
              <CardTitle>Say Hello</CardTitle>
              {/* <CardDescription>A short name, one sponsored Sui action.</CardDescription> */}
            </div>
          </CardHeader>
          <form className="form-grid compact" onSubmit={handleSayHello}>
            <Label>
              <span>What's your name?</span>
              <Input
                maxLength={32}
                onChange={(event) => setUsername(event.target.value)}
                type="text"
                value={username}
              />
            </Label>
            <Button disabled={isBusy || !session || !sayHelloAction || !HELLO_CELERIS_APP_STATE_OBJECT_ID.trim()} type="submit">
              Say Hello Celeris
            </Button>
          </form>
        </Card>

        <Card className="workspace-band demo-panel">
          <CardHeader>
            <div>
              <CardTitle>Feed</CardTitle>
              <CardDescription>Fresh hellos land here.</CardDescription>
            </div>
          </CardHeader>
          <div className="list-stack">
            {transactions.length > 0 ? (
              transactions.map((transaction) => (
                <a
                  className="list-row"
                  href={toSuiScanTestnetTxUrl(transaction.digest)}
                  key={transaction.transactionId}
                  rel="noreferrer"
                  target="_blank"
                >
                  <strong>{transaction.message ?? transaction.actionType}</strong>
                  <small>{transaction.digest}</small>
                  <small>{transaction.walletAddress}</small>
                </a>
              ))
            ) : (
              <p className="empty-state">No transactions recorded yet.</p>
            )}
          </div>
        </Card>
      </section>

      {errorMessage ? (
        <Card className="status-band error demo-status">
          <p>{errorMessage}</p>
        </Card>
      ) : null}

      {isCreditsDialogOpen ? (
        <div className="demo-dialog-backdrop" role="presentation" onMouseDown={() => setIsCreditsDialogOpen(false)}>
          <Card
            aria-modal="true"
            className="workspace-band demo-panel demo-credits-dialog"
            role="dialog"
            aria-labelledby="demo-credits-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <CardHeader>
              <div>
                <CardTitle id="demo-credits-title">Credits</CardTitle>
                <CardDescription>Pick a small bundle and keep going.</CardDescription>
              </div>
              <button
                aria-label="Close credits dialog"
                className="demo-dialog-close"
                onClick={() => setIsCreditsDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </CardHeader>
            <dl className="runtime-grid">
              <div>
                <dt>Balance</dt>
                <dd>{balance ? `${balance.availableCredits} credits` : session ? "Loading" : "Sign in required"}</dd>
              </div>
              <div>
                <dt>Credit rate</dt>
                <dd>{catalog ? `${catalog.creditsPricing.creditsPerUsd} credits per $1` : "Loading"}</dd>
              </div>
              {/* <div>
                <dt>Say hello price</dt>
                <dd>{sayHelloAction ? `${sayHelloAction.priceCredits} credits` : "Not configured"}</dd>
              </div>
              <div>
                <dt>Configured actions</dt>
                <dd>{enabledActions.length > 0 ? enabledActions.map((action) => action.actionType).join(", ") : "None"}</dd>
              </div> */}
            </dl>
            <form className="form-grid compact checkout-form" onSubmit={handleCheckout}>
              <Label>
                <span>USD amount</span>
                <Input
                  min="1"
                  onChange={(event) => setCheckoutUsdAmount(Number(event.target.value))}
                  type="number"
                  value={checkoutUsdAmount}
                />
              </Label>
              <p className="text-sm text-[#55635d]">
                {catalog ? `${checkoutUsdAmount * catalog.creditsPricing.creditsPerUsd} credits` : "Credits calculate after catalog loads."}
              </p>
              <Button disabled={isBusy || !session} type="submit">
                Buy credits
              </Button>
            </form>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
