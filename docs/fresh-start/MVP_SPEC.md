# Fresh Start Sui MVP Spec

Build a clean, single-path "Celeris" MVP. Assume the repo starts from only the necessary env/runtime contract plus the in-repo `hello_celeris` Move package. Everything else should be implemented only to support one canonical demo: a brand new app is created in Celeris, manually connected to a deployed Sui package through a documented walkthrough, then used by a user who signs in with real Google + zkLogin, buys credits, and executes paid `say_hello` on Sui testnet.

For the MVP, Celeris owns three public web surfaces that are split by origin but served from one Next.js codebase:

- `app.celeris.pro` for the Celeris developer dashboard
- `demo.celeris.pro` for the Celeris-owned reference SDK consumer app
- `auth.celeris.pro` for shared auth

## Product Goal

The MVP must prove this full story end to end:

1. A developer signs in to Celeris through shared Google + zkLogin auth and lands in the dashboard.
2. The developer creates a new app in Celeris.
3. Celeris provisions a sponsor wallet for that app.
4. The developer publishes the in-repo Move package, runs `initialize_app`, and manually registers the resulting Sui IDs into Celeris using a walkthrough.
5. The developer registers a paid user action, using `say_hello` as the reference demo action type.
6. The developer consumes the Celeris browser SDK in its frontend app and configures it for the new app.
7. A user signs in through hosted Google auth and gets a stable zkLogin Sui wallet.
8. The user buys credits.
9. The user executes the registered action through a sponsored transaction flow.
10. The app-wide transaction feed shows the recorded result with a Sui Explorer link.

## Scope

- One supported network: `sui:testnet`.
- One hosted auth provider: Google OAuth, resolved into zkLogin.
- One in-repo Move package with two entrypoints: `initialize_app` and `say_hello`.
- One sponsor wallet per app.
- One registered Sui package per app.
- Developer-defined managed paid actions, with `say_hello` used as the reference demo action.
- One developer dashboard surface for app setup and configuration.
- One developer authorization model layered on top of shared user auth.
- One canonical developer integration path where the frontend app consumes the Celeris browser SDK.
- One Celeris-owned reference consumer app surface that behaves like a third-party SDK integration.
- One shared auth surface used for developer sign-in and hosted user auth.
- One first-party dashboard auth client that consumes the same hosted auth contract as third-party apps.
- The dashboard auth client is a reserved first-party client identity inside shared auth, not a developer-created app record.
- One user demo UI with wallet, credits, username input, purchase flow, execute button, and app-wide feed.
- One manual walkthrough for package publish, app initialization, registration, and demo run.

## On-Chain Contract

- The Move package exposes `initialize_app(app_id)` and `say_hello(authority_cap, app_state, clock, username)`.
- `initialize_app` creates:
  - one shared `AppState`
  - one owned `AppAuthorityCap`
- `AppState` stores:
  - raw `appId`
  - `entryCount`
  - `entries`
- Each greeting entry stores:
  - `userWallet`
  - `username`
  - `message`
  - `createdTimestampMs`
- `say_hello` must:
  - derive the user wallet from `TxContext.sender()`
  - trim and normalize username before use in the client and backend path
  - accept only non-empty usernames up to 32 UTF-8 bytes
  - render the message canonically as `"<username> says Hello Celeris!"`
  - reject writes after 100 entries

## Action Registry And Sponsorship Policy

Managed actions are an app-level credit-metering registry, not a registry of blockchain functions known to Celeris.

- `actionType` is a developer-defined stable key such as `say_hello`, `mint_badge`, or `post_message`.
- Each action stores credit usage and enabled state for the app.
- The developer app remains responsible for constructing the transaction kind that should run for a given action.
- The browser SDK sends the selected `actionType` and transaction kind to Celeris for reservation and sponsorship.
- Celeris reserves and captures credits based on the registered action, then sponsor-signs only if the request satisfies the app's sponsorship policy.
- Celeris should not require a new backend route, schema, or Move-function-specific implementation for every action type.
- Celeris must still reject sponsorship for transactions outside the app's configured chain, app ownership, registered program scope, or other policy bounds.

## System Responsibilities

- The browser SDK creates zkLogin ephemeral state before hosted auth begins.
- The auth origin hosts one shared auth contract for both the first-party dashboard and app consumers.
- The developer dashboard consumes that auth contract as a first-party client, not through a separate bespoke login system.
- The dashboard uses the same auth start, callback, token, and session contract as app consumers, but under a reserved first-party client identity such as `clientKind=developer_dashboard` and `clientId=celeris-dashboard`.
- The backend resolves or creates the developer authorization record after shared auth for dashboard access.
- Hosted user auth on the auth origin uses real Google account selection.
- The backend verifies the Google identity token, resolves a stable user salt, derives the zkLogin Sui address, gets proof inputs, and issues the user session.
- The developer app builds or supplies the `TransactionKind` for the action it wants to execute.
- The browser SDK passes the developer-selected `actionType` and `TransactionKind` to Celeris.
- The backend validates that the action is registered, enabled, app-scoped, and has sufficient user credits before sponsorship.
- The backend enforces sponsorship policy before signing. At minimum, sponsorship must be bounded to the app's configured chain and registered Sui package or program metadata so the sponsor wallet cannot be used for unrelated transactions.
- The backend reserves credits, selects sponsor gas, builds transaction bytes from the supplied transaction kind, sponsor-signs them, and returns the sponsorship payload.
- The browser silently adds the zkLogin user signature and submits directly to Sui RPC.
- The browser reports `submitted` or `failed`.
- The backend verifies the digest, captures or releases credits, and records the transaction.

## Developer Flow

1. Visit `app.celeris.pro`.
2. If unauthenticated, redirect to `auth.celeris.pro` and complete shared Google + zkLogin sign-in.
3. Return to the developer dashboard with a valid Celeris user session and developer authorization.
4. Create a new Celeris app with `allowedChainId = sui:testnet` and `authProvider = zklogin`.
5. Provision the sponsor wallet through the developer API.
6. Fund the sponsor wallet with testnet SUI.
7. Publish the Move package manually.
8. Call `initialize_app` manually and record:
   - `packageId`
   - `appStateObjectId`
   - `authorityCapObjectId`
9. Register those Sui IDs against the app through the developer API.
10. Register the app's user actions and configure each action's credit usage and enabled state.
11. Consume the Celeris browser SDK in the frontend app and configure it with the app's public runtime values.
12. Launch the reference demo consumer app on the demo origin.

Unauthenticated developer visits to the app origin should redirect to the auth origin for sign-in.

The Sui registration step must not be auto-orchestrated. The repo must include a walkthrough with exact manual steps and example commands.

## User Flow

1. Open the reference demo frontend for the newly created app on the demo origin.
2. Start hosted sign-in.
3. Complete real Google auth on the Celeris auth origin.
4. Return with a valid Celeris user session tied to a stable zkLogin Sui address.
5. View wallet address, credit balance, and app transaction feed.
6. Purchase credits through the demo purchase flow.
7. Enter a username and click `Say Hello Celeris`.
8. The reference app builds the `say_hello` transaction kind, asks the browser SDK to sponsor the registered `say_hello` action, silently signs with zkLogin, and submits to Sui.
9. The UI refreshes balance and feed state after completion.

## Required Env Contract

- `CELERIS_GOOGLE_CLIENT_ID`
- `CELERIS_GOOGLE_CLIENT_SECRET`
- `CELERIS_GOOGLE_ISSUER`
- `CELERIS_SESSION_SECRET`
- `CELERIS_DEVELOPER_APP_ORIGIN`
- `CELERIS_HOSTED_AUTH_ORIGIN`
- `CELERIS_DEMO_FRONTEND_ORIGIN`
- `CELERIS_ZKLOGIN_SALT_SEED`
- `CELERIS_ZKLOGIN_PROVER_ORIGIN`
- `CELERIS_ZKLOGIN_MAX_EPOCH_WINDOW`
- `CELERIS_SUI_RPC_ORIGIN`

The repo should fail closed when required auth, session, prover, or RPC env values are missing.

## Core Backend Models

- `DeveloperProfile`
  - `developerProfileId`, `userIdentityId`, timestamps
- `App`
  - `appId`, `developerProfileId`, `name`, `allowedChainId`, `authProvider`, timestamps
- `RegisteredProgram`
  - `appId`, `chainFamily`, `network`, `packageId`, `appStateObjectId`, `authorityCapObjectId`, timestamps
- `SponsorWallet`
  - `appId`, `chainFamily`, `network`, `address`, timestamps
- `SponsorWalletSecret`
  - stored privately and never returned from APIs
- `UserIdentity`
  - `userIdentityId`, `issuer`, `subject`, `salt`, `walletAddress`, timestamps
- `AuthLoginRequest`
  - `loginRequestId`, `clientKind`, `clientId`, `redirectUri`, auth metadata, zkLogin ephemeral metadata, expiry, status
  - reserves a first-party dashboard client identity separately from app-scoped consumer clients
- `userSession`
  - `userId`, `walletAddress`, `chainId`, `clientKind`, `clientId`, auth/session metadata, zkLogin session material needed by the browser
- `CreditLedgerEntry`
  - purchase, reserve, capture, release events
- `ManagedAction`
  - `actionId`, `appId`, developer-defined `actionType`, optional display name, `creditUsage`, enabled state, timestamps
- `PendingActionReservation`
  - `reservationId`, `appId`, `actionType`, `walletAddress`, sponsor gas data, tx bytes, sponsor signature, expiry, status, optional action metadata
- `TransactionRecord`
  - `transactionId`, `appId`, `actionType`, `walletAddress`, optional action metadata, `digest`, `explorerUrl`, `status`, timestamps

## API Contract

- Developer API:
  - `GET /v1/developer/me`
  - `POST /v1/developer/profile`
  - `POST /v1/developer/apps`
  - `GET /v1/developer/apps/:appId`
  - `POST /v1/developer/apps/:appId/sponsor-wallet`
  - `GET /v1/developer/apps/:appId/sponsor-wallet`
  - `PUT /v1/developer/apps/:appId/program`
  - `GET /v1/developer/apps/:appId/program`
  - `GET /v1/developer/apps/:appId/actions`
  - `PUT /v1/developer/apps/:appId/actions/:actionType`
- Auth and user API:
  - hosted login start route
  - Google callback route on the auth origin
  - auth code exchange route returning user session plus zkLogin session material
  - `GET /v1/apps/:appId/catalog`
  - `GET /v1/apps/:appId/balance`
  - `GET /v1/apps/:appId/transactions`
  - purchase and checkout start and completion routes
  - `POST /v1/apps/:appId/actions/:actionType/execute`
  - `POST /v1/apps/:appId/actions/:actionType/complete`

`execute` input should include `{ transactionKind, metadata? }`. The reference `say_hello` demo may include `{ username }` metadata for feed rendering, but sponsorship and credit accounting must key off the registered `actionType`, not a hard-coded Move function.

`execute` output should include `reservationId`, `transactionBytes`, `sponsorSignature`, `sponsorAddress`, `expiresAt`, `actionType`, and optional normalized metadata.

`complete` input should include `reservationId`, `outcome`, and `digest` when submitted.

## Browser SDK Contract

- Be consumable by a developer-owned frontend app through a minimal initialization contract.
- Support public runtime configuration for at least `appId`, `apiOrigin`, `hostedAuthOrigin`, `redirectUri`, and optional `suiRpcOrigin`.
- Generate and store zkLogin ephemeral key material in `sessionStorage` only.
- Accept a developer-supplied action type and transaction kind for sponsorship.
- Request sponsorship from Celeris for the registered action type.
- Add zkLogin user signature silently.
- Submit directly to `CELERIS_SUI_RPC_ORIGIN`.
- Report completion back to Celeris.
- Expose simple user methods for auth, catalog, balance, feed, purchase, and generic sponsored action execution.
- The reference app may provide a `say_hello` helper, but that helper must be layered over the generic action sponsorship API.

## Walkthrough Requirement

The repo must include one clear manual walkthrough covering:

1. Required env setup.
2. Starting the API and the Next.js public surfaces.
3. Creating a new app.
4. Provisioning and funding the sponsor wallet.
5. Publishing the Move package.
6. Running `initialize_app`.
7. Registering package and object IDs in Celeris.
8. Registering action types and configuring action credit usage.
9. Consuming and configuring the Celeris browser SDK in the frontend app.
10. Starting the frontend.
11. Signing in, purchasing credits, and executing the registered `say_hello` reference action.

## Acceptance Criteria

- A developer can sign in through shared Google + zkLogin auth and reach the dashboard.
- A new app can be created in Celeris and fully configured for the demo.
- The developer dashboard is served on the app origin, the reference consumer app is served on the demo origin, and shared auth is served on the auth origin through one Next.js codebase.
- Unauthenticated developer visits to `app.celeris.pro/` redirect to auth, while `demo.celeris.pro/` opens the Hello Celeris home.
- The dashboard consumes the same hosted auth contract as app consumers, while developer authorization remains a first-party concern and the dashboard remains a reserved first-party auth client rather than a developer-created app.
- Sponsor wallet creation is idempotent and returns a stable public address.
- The Move package publishes successfully and `initialize_app` produces the required objects.
- Manual registration of the Sui package into Celeris succeeds through the documented flow.
- A developer frontend app can consume the Celeris browser SDK with the documented public runtime config and complete the canonical flow.
- A developer can register arbitrary app action types for credit metering without Celeris requiring a hard-coded Move function per action.
- Real Google login produces a stable zkLogin Sui address for repeat logins by the same user.
- The user can purchase credits and see the balance update.
- The user can execute the registered paid `say_hello` reference action without a separate signing popup.
- Sponsorship is denied for unregistered or disabled actions and for transaction kinds that violate the app's sponsorship policy.
- The backend verifies the submitted digest and reconciles credits correctly.
- The transaction feed shows the resulting entry with digest, status, timestamp, wallet, username, message, and Explorer link.

## Implementation Order

1. Add the Move package and shared Sui transaction helpers.
2. Implement developer app creation, sponsor-wallet provisioning, and program registration.
3. Realign the `app`, `demo`, and `auth` web surfaces and make the dashboard consume shared Google + zkLogin auth as a first-party client.
4. Extend the shared auth flow to the reference consumer app and browser SDK.
5. Implement credits and purchase flow.
6. Implement generic sponsored action execution, completion, and reconciliation, with `say_hello` as the reference demo action.
7. Implement the browser SDK flow for silent zkLogin signing and submission.
8. Implement the reference consumer app that consumes the browser SDK.
9. Write the manual walkthrough and end-to-end verification steps.
