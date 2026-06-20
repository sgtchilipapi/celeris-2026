import { MockCheckoutShell } from "../../src/components/mock-checkout-shell";
import { getWebRuntimeConfig } from "../../src/env";

interface CheckoutPageProps {
  searchParams: Promise<{
    appId?: string;
    checkoutSessionId?: string;
  }>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const config = getWebRuntimeConfig();

  if (!params.appId || !params.checkoutSessionId) {
    return (
      <main className="workspace checkout-workspace">
        <section className="workspace-header">
          <p className="workspace-kicker">Mock checkout</p>
          <h1>Checkout session missing</h1>
          <p className="workspace-copy">Return to the demo app and start checkout again.</p>
        </section>
      </main>
    );
  }

  return (
    <MockCheckoutShell
      demoFrontendOrigin={config.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN}
      appId={params.appId}
      checkoutSessionId={params.checkoutSessionId}
    />
  );
}
