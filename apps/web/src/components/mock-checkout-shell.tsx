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

  const shortSessionId =
    checkoutSessionId.length > 18
      ? `${checkoutSessionId.slice(0, 10)}...${checkoutSessionId.slice(-6)}`
      : checkoutSessionId;

  return (
    <main className="workspace checkout-workspace">
      <section className="checkout-shell" aria-labelledby="checkout-title">
        <div className="checkout-main">
          <div className="checkout-merchant">
            <div className="checkout-logo" aria-hidden="true">
              C
            </div>
            <div>
              <p className="checkout-eyebrow">Celeris hosted checkout</p>
              <h1 id="checkout-title">Complete your credit purchase</h1>
            </div>
            <span className="checkout-mode">Demo mode</span>
          </div>

          <section className="checkout-card" aria-labelledby="payment-title">
            <div className="checkout-card-header">
              <div>
                <p className="checkout-step">Payment</p>
                <h2 id="payment-title">Confirm purchase</h2>
              </div>
              <span className="checkout-secure-badge">Secure session</span>
            </div>

            <div className="payment-method">
              <div className="payment-card-art" aria-hidden="true">
                <span />
                <strong>**** 4242</strong>
              </div>
              <div>
                <p>Demo card</p>
                <span>No real charge is created for this MVP checkout.</span>
              </div>
            </div>

            <div className="checkout-form-grid" aria-label="Payment details">
              <label>
                <span>Name on card</span>
                <input readOnly value="Celeris Demo User" />
              </label>
              <label>
                <span>Card number</span>
                <input readOnly value="4242 4242 4242 4242" />
              </label>
              <label>
                <span>Expiry</span>
                <input readOnly value="12 / 30" />
              </label>
              <label>
                <span>CVC</span>
                <input readOnly value="123" />
              </label>
            </div>

            {errorMessage ? <p className="error-text checkout-error">{errorMessage}</p> : null}

            <div className="checkout-actions">
              <button className="button checkout-pay-button" disabled={isCompleting} onClick={handleCompleteCheckout} type="button">
                {isCompleting ? "Processing..." : "Complete purchase"}
              </button>
              <button className="button secondary" disabled={isCompleting} onClick={handleCancelCheckout} type="button">
                Cancel
              </button>
            </div>

            <p className="checkout-disclaimer">
              Completing this page records a purchase in the Celeris credit ledger and returns you to the demo app.
            </p>
          </section>
        </div>

        <aside className="checkout-summary" aria-label="Order summary">
          <div className="checkout-summary-header">
            <p>Order summary</p>
            <span>Credits</span>
          </div>
          <div className="checkout-line-item">
            <div>
              <strong>Demo credit pack</strong>
              <span>Credits are added to this app balance after confirmation.</span>
            </div>
            <b>Pending</b>
          </div>
          <dl className="checkout-details">
            <div>
              <dt>Application</dt>
              <dd>{appId}</dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd title={checkoutSessionId}>{shortSessionId}</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>Sui testnet demo</dd>
            </div>
          </dl>
          <div className="checkout-total-row">
            <span>Total due today</span>
            <strong>Demo checkout</strong>
          </div>
        </aside>
      </section>
    </main>
  );
}
