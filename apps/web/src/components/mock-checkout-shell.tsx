"use client";

import { useEffect, useMemo, useState } from "react";
import { createCelerisBrowserClient } from "@celeris/sdk-browser";

interface MockCheckoutShellProps {
  apiOrigin: string;
  hostedAuthOrigin: string;
  demoFrontendOrigin: string;
  appId: string;
  checkoutSessionId: string;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Checkout failed";
}

export function MockCheckoutShell({
  apiOrigin,
  hostedAuthOrigin,
  demoFrontendOrigin,
  appId,
  checkoutSessionId
}: MockCheckoutShellProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const client = useMemo(
    () =>
      createCelerisBrowserClient({
        appId,
        apiOrigin,
        hostedAuthOrigin,
        redirectUri: new URL("/auth/callback", demoFrontendOrigin).toString()
      }),
    [apiOrigin, appId, demoFrontendOrigin, hostedAuthOrigin]
  );

  useEffect(() => {
    window.sessionStorage.setItem("celeris.demo.appId", appId);
  }, [appId]);

  async function handleCompleteCheckout() {
    setIsCompleting(true);
    setErrorMessage(null);

    try {
      const result = await client.credits.completeCheckout(checkoutSessionId);
      window.location.href = result.checkoutSession.successRedirectUrl;
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
      setIsCompleting(false);
    }
  }

  function handleCancelCheckout() {
    window.location.href = new URL("/?checkout=canceled", demoFrontendOrigin).toString();
  }

  return (
    <main className="workspace checkout-workspace">
      <section className="workspace-header">
        <div>
          <p className="workspace-kicker">Mock checkout</p>
          <h1>Complete credit purchase</h1>
          <p className="workspace-copy">This hosted checkout records a purchase in the Celeris credit ledger.</p>
        </div>
        <dl className="runtime-grid">
          <div>
            <dt>App ID</dt>
            <dd>{appId}</dd>
          </div>
          <div>
            <dt>Checkout session</dt>
            <dd>{checkoutSessionId}</dd>
          </div>
        </dl>
      </section>

      <section className="workspace-band">
        <div className="checkout-actions">
          <button className="button" disabled={isCompleting} onClick={handleCompleteCheckout} type="button">
            Complete purchase
          </button>
          <button className="button secondary" disabled={isCompleting} onClick={handleCancelCheckout} type="button">
            Cancel
          </button>
        </div>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </section>
    </main>
  );
}
