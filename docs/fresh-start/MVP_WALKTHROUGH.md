# Fresh Start MVP Walkthrough

This walkthrough starts from an empty database and ends with a user buying credits and executing sponsored `say_hello` on Sui testnet.

## 1. Required Environment

Create API and web environment files with these values:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/celeris
API_ORIGIN=http://localhost:4100
CELERIS_APP_ENCRYPTION_KEY=replace-with-at-least-16-characters
CELERIS_AUTH_TOKEN_SECRET=replace-with-a-token-secret
CELERIS_DEVELOPER_APP_ORIGIN=http://localhost:3102
CELERIS_DEMO_FRONTEND_ORIGIN=http://localhost:3103
CELERIS_HOSTED_AUTH_ORIGIN=http://localhost:3101
CELERIS_GOOGLE_CLIENT_ID=<google-oauth-client-id>
CELERIS_GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
CELERIS_GOOGLE_REDIRECT_URI=http://localhost:4100/v1/auth/google/callback
CELERIS_GOOGLE_ISSUER=https://accounts.google.com
CELERIS_ZKLOGIN_SALT_SEED=replace-with-a-stable-private-salt-seed
CELERIS_ZKLOGIN_PROVER_ORIGIN=http://localhost:9000
CELERIS_ZKLOGIN_MAX_EPOCH_WINDOW=2
CELERIS_SUI_RPC_ORIGIN=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_API_ORIGIN=http://localhost:4100
NEXT_PUBLIC_DEVELOPER_APP_ORIGIN=http://localhost:3102
NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN=http://localhost:3103
NEXT_PUBLIC_HOSTED_AUTH_ORIGIN=http://localhost:3101
NEXT_PUBLIC_SUI_RPC_ORIGIN=https://fullnode.testnet.sui.io:443
```

For tunneled domains, use `https://app.celeris.pro`, `https://demo.celeris.pro`, `https://auth.celeris.pro`, and the matching public API origin.

## 2. Google OAuth Setup

Create a Google OAuth web client and add this authorized redirect URI:

```text
http://localhost:4100/v1/auth/google/callback
```

For the tunneled run, also add the public API callback URI used by `CELERIS_GOOGLE_REDIRECT_URI`.

## 3. Database Bootstrap

Run Prisma generation and migrations:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

## 4. Start Runtime Dependencies

Start the zkLogin prover if you use the bundled compose target:

```bash
npm run zklogin:prover
```

In another terminal, start API and web:

```bash
npm run dev
```

Check liveness and dependency diagnostics:

```bash
curl http://localhost:4100/health
curl http://localhost:4100/health/diagnostics
```

## 5. Create And Configure The Celeris App

Open the developer dashboard:

```text
http://localhost:3102
```

Sign in with Google through the hosted auth surface. In the setup console:

1. Create a new app with `allowedChainId=sui:testnet` and `authProvider=zklogin`.
2. Provision the sponsor wallet.
3. Copy the sponsor wallet address.

Fund the sponsor wallet with Sui testnet SUI:

```bash
sui client faucet --address <sponsor-wallet-address>
```

## 6. Publish The Move Package

Publish the in-repo Move package manually:

```bash
cd sui/hello_celeris
sui client publish --gas-budget 100000000
```

Record the published `packageId`.

## 7. Run `initialize_app`

Call the initializer with the Celeris app ID from the dashboard:

```bash
sui client call \
  --package <packageId> \
  --module hello_celeris \
  --function initialize_app \
  --args <celeris-app-id> \
  --gas-budget 50000000
```

Record the created shared `AppState` object ID and owned `AppAuthorityCap` object ID from the command output.

## 8. Register Program Metadata

Back in the developer dashboard, register:

```text
packageId=<packageId>
appStateObjectId=<AppState object ID>
authorityCapObjectId=<AppAuthorityCap object ID>
```

Then configure one or more metered actions in the dashboard. For the reference demo, create or update the `say_hello` action with a price such as `5` credits and leave it enabled.

## 9. Configure The Reference Demo App

Open the demo surface:

```text
http://localhost:3103
```

Paste the Celeris app ID into the App ID field and save it. The reference frontend builds the `say_hello` Sui transaction, then uses the public browser SDK generic action execution API described in [the Next.js SDK example](../examples/nextjs-sdk-consumer.md).

## 10. User Sign-In, Purchase, And Execute

On the demo surface:

1. Click **Sign in** and complete Google auth.
2. Confirm the wallet address is shown.
3. Buy credits through the hosted mock checkout.
4. Enter a username up to 32 UTF-8 bytes.
5. Click **Say Hello Celeris**.
6. Confirm the transaction feed shows the message, wallet, digest, status, timestamp, and Sui Explorer link.

## 11. Regression And Smoke Checks

Run the automated suite:

```bash
npm run typecheck
npm test
```

Manual smoke coverage should include:

```text
developer Google sign-in
app creation
sponsor-wallet funding
Move publish
initialize_app
program registration
action pricing
demo Google sign-in
credit purchase
say_hello execution
feed retrieval
```
