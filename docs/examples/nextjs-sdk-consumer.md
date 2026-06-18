# Developer-Owned Next.js SDK Consumer Example

This is the minimal public browser SDK contract for a frontend that behaves like the reference demo app.

```tsx
"use client";

import { createCelerisBrowserClient } from "@celeris/sdk-browser";

const celeris = createCelerisBrowserClient({
  appId: process.env.NEXT_PUBLIC_CELERIS_APP_ID!,
  apiOrigin: process.env.NEXT_PUBLIC_CELERIS_API_ORIGIN!,
  hostedAuthOrigin: process.env.NEXT_PUBLIC_CELERIS_HOSTED_AUTH_ORIGIN!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_ORIGIN}/auth/callback`,
  suiRpcOrigin: process.env.NEXT_PUBLIC_CELERIS_SUI_RPC_ORIGIN
});

export async function signIn() {
  await celeris.auth.startLogin();
}

export async function handleAuthCallback(callbackUrl: string) {
  return celeris.auth.handleRedirectCallback(callbackUrl);
}

export async function loadDemoState() {
  const [session, catalog, transactions] = await Promise.all([
    celeris.auth.getSession(),
    celeris.apps.getCatalog(),
    celeris.transactions.list()
  ]);
  const balance = session ? await celeris.credits.getBalance() : null;

  return {
    session,
    catalog,
    balance,
    transactions
  };
}

export async function buyCredits(credits: number) {
  return celeris.credits.startCheckout({ credits });
}

export async function sayHello(username: string) {
  return celeris.actions.sayHello({ username });
}
```

For custom actions, build a Sui `Transaction` in the app and call `celeris.actions.execute({ actionType, transaction, metadata })`. Celeris meters by the registered `actionType`; the SDK serializes the transaction-kind bytes for sponsorship.

The SDK stores bearer sessions and zkLogin ephemeral material in `sessionStorage`. Do not mirror these values into `localStorage`.
