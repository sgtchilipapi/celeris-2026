# Celeris

Celeris is an authentication service for credit-based Sui dApps. It lets users sign in with Google + zkLogin, buy app credits, and execute approved onchain actions without managing a wallet or gas.

## Features

- Google + zkLogin sign-in for stable Sui wallet identity without wallet onboarding.
- Credit-based app usage, including hosted checkout and user balance APIs.
- Sponsored Sui transactions for registered app actions.
- Generic metered action execution: your app builds the Sui `Transaction`, Celeris meters by `actionType`, sponsors approved transactions, and reconciles credits.
- Browser SDK for auth, credits, checkout, action execution, and transaction feed retrieval.

## Usage

### Installation

```bash
npm install @celeris/sdk-browser @mysten/sui
```

The browser SDK is intended for frontend apps running in the browser. It stores the user session and zkLogin ephemeral material in `sessionStorage`.

### Browser SDK sample snippet (React)

This is a sample of how a consumer app would use Celeris:

```tsx
"use client";

// Import from mysten/sui and celeris
import { Transaction } from "@mysten/sui/transactions";
import { useCelerisBrowserClient } from "@celeris/sdk-browser/react";

// Set the celeris APP_ID reference generated from the Celeris Developer Dashboard
const APP_ID="..."
const PACKAGE_ID = "0x...";
const APP_STATE_OBJECT_ID = "0x...";

// Instantiate the celeris client
const client = useCelerisBrowserClient({
    appId: process.env.NEXT_PUBLIC_CELERIS_APP_ID!,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_ORIGIN}/auth/callback`,
    suiRpcOrigin: "https://fullnode.testnet.sui.io:443"
});

// User sign-in
async function signIn() {
    await client?.auth.startLogin();
}

// Get user credits balance
const balance = await client.credits.getBalance();

// Build transaction with mysten/sui
const transaction = new Transaction();
    transaction.moveCall({
        target: `${PACKAGE_ID}::hello_celeris::say_hello`,
        arguments: [
            transaction.object(APP_STATE_OBJECT_ID),
            transaction.object("0x6"),
            transaction.pure.string(username)
        ]
    });

//Execute the transaction with the celeris client
const result = await client.actions.execute({
    actionType: "say_hello", //The action name defined in the developer dashboard
    transaction,
    metadata: { username }
});

```

For an auth callback route, call `client.auth.handleRedirectCallback(window.location.href)` and then redirect the user back to your app page.

Celeris action execution has three responsibilities:

- Your app registers an action type and credit price in Celeris.
- Your frontend builds a Sui `Transaction` for that action with `@mysten/sui`.
- The Celeris SDK serializes the transaction kind, requests sponsorship, submits the sponsored transaction, and updates the credit reservation.

## Disclaimers

- Celeris currently targets Sui testnet and Google + zkLogin for the MVP path.
- Sponsorship is policy-bound to registered app actions and program metadata; Celeris should not be used as an unrestricted sponsor signer.
- Keep browser auth state session-scoped. Do not copy SDK session or zkLogin material into `localStorage`.

## License (MIT)

MIT
