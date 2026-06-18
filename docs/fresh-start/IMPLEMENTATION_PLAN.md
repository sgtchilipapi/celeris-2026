# Fresh Start Implementation Plan

This plan implements [MVP_SPEC.md](./MVP_SPEC.md) using a vertical-slice approach and the planned stack:

- Next.js for the public web surfaces
- Express.js for the JSON API
- Postgres for persistence
- Prisma for schema and query access
- TypeScript across all packages

## Objective

Build the MVP as one clean, demoable Sui path:

1. A developer creates a brand new app in Celeris.
2. The developer provisions a sponsor wallet.
3. The developer manually publishes and initializes the Move package.
4. The developer manually registers the Sui IDs into Celeris through the documented walkthrough.
5. The developer registers paid user actions, with `say_hello` as the reference demo action.
6. A frontend app consumes the Celeris browser SDK.
7. A user signs in with real Google + zkLogin.
8. The user buys credits.
9. The user executes a sponsored registered action.
10. The app-wide transaction feed shows the result.

## Planning Rules

- Build in vertical slices, not backend-first or frontend-first layers.
- Every slice must land database changes, Express routes, SDK changes, Next.js UI changes, tests, and docs needed for a runnable demo.
- Do not build temporary duplicate flows unless they are required for a safe cutover inside the same slice.
- The reference Next.js app must consume the browser SDK through its public package API, not through private imports into API internals.
- Manual Sui package publish and registration remain part of the MVP. The repo should help the operator perform them, but should not fully automate them away.

## Scope Decisions

These decisions make the MVP concrete and keep scope controlled:

- User auth is real Google OAuth plus zkLogin.
- The developer dashboard also uses real Google OAuth plus zkLogin through the same shared auth contract.
- The dashboard is a first-party auth client that consumes the same hosted auth flow as external app consumers.
- The dashboard should authenticate through a reserved first-party client identity inside shared auth, not through a developer-created `App` record.
- Developer authorization is layered on top of shared user auth through a first-party developer profile, not a separate credential system.
- The purchase flow is a hosted mock checkout flow implemented by Celeris, backed by the real credit ledger.
- One Next.js codebase serves three public surfaces:
  - the developer dashboard origin
  - the reference demo frontend origin
  - the shared auth origin
- For the clarified MVP target, those origins are `app.celeris.pro`, `demo.celeris.pro`, and `auth.celeris.pro`.
- One Express service owns all JSON APIs and auth/session orchestration.
- One Postgres database stores all runtime state.
- The zkLogin prover is an external dependency reached by HTTP through `CELERIS_ZKLOGIN_PROVER_ORIGIN`.
- Sui package publish and `initialize_app` are manual operator steps documented in the walkthrough.

## Proposed Repo Shape

```text
apps/
  api/                  Express API
  web/                  Next.js app for developer dashboard, demo UI, and shared auth UI
packages/
  db/                   Prisma schema, migrations, generated client
  shared/               shared types, zod schemas, Sui helpers, env parsing
  sdk-browser/          browser SDK used by the frontend app
  sdk-server/           server SDK for developer provisioning scripts and examples
sui/
  hello-celeris/        Move package
docs/
  fresh-start/
    MVP_SPEC.md
    IMPLEMENTATION_PLAN.md
```

## Runtime Topology

### Public origins

- `CELERIS_DEVELOPER_APP_ORIGIN`
  - Next.js developer dashboard where the operator creates and configures apps
- `CELERIS_DEMO_FRONTEND_ORIGIN`
  - Next.js reference SDK consumer app where the user lands
- `CELERIS_HOSTED_AUTH_ORIGIN`
  - Next.js shared auth UI for the first-party dashboard client plus app-consumer Google sign-in and redirect handling
- `API_ORIGIN`
  - Express JSON API

### Runtime responsibilities

- Next.js owns:
  - developer dashboard pages
  - shared auth pages
  - demo UI
  - mock checkout UI
  - callback pages that the browser SDK uses
- Express owns:
  - developer API
  - user API
  - Google OAuth orchestration
  - zkLogin proof and session orchestration
  - sponsor signing
  - reconciliation
- Postgres owns:
  - developer profiles
  - app config
  - wallet and session state
  - credit ledger
  - pending action reservations
  - transaction records

## Recommended Technical Conventions

- Use Next.js App Router.
- Use Express 5 with async handlers and centralized error middleware.
- Use Zod at all API boundaries.
- Use Prisma migrations only; do not hand-edit schema state in production.
- Store wallet addresses and object IDs in normalized lowercase form.
- Store credit amounts as integers.
- Store Sui digests, object versions, gas prices, and epochs as strings where lossless integer handling matters.
- Encrypt sponsor wallet secret material before persisting it.
- Keep user session tokens and zkLogin ephemeral material out of `localStorage`.
- Use `sessionStorage` for browser-side ephemeral zkLogin material and short-lived user auth state.

## Additional Runtime Config

`MVP_SPEC.md` already defines the core env contract. This implementation plan adds a few runtime values that will be required by the chosen stack:

- `DATABASE_URL`
- `CELERIS_APP_ENCRYPTION_KEY`
- `CELERIS_AUTH_TOKEN_SECRET`
- `CELERIS_CHECKOUT_SUCCESS_URL`
- `CELERIS_CHECKOUT_CANCEL_URL`

These additions do not change product scope. They exist so the runtime can persist data safely and issue bearer tokens cleanly.

## Data Model Plan

### Developer and app setup

- `DeveloperProfile`
  - `id`, `userIdentityId`, `email`, `displayName`, timestamps
- `App`
  - `id`, `developerProfileId`, `name`, `slug`, `allowedChainId`, `authProvider`, timestamps
- `ManagedAction`
  - `id`, `appId`, developer-defined `actionType`, optional `displayName`, `creditUsage`, `isEnabled`, timestamps
- `SponsorWallet`
  - `id`, `appId`, `chainFamily`, `network`, `address`, `encryptedSecret`, timestamps
- `RegisteredProgram`
  - `id`, `appId`, `chainFamily`, `network`, `packageId`, `appStateObjectId`, `authorityCapObjectId`, timestamps

### User auth and identity

- `AuthLoginRequest`
  - `id`, `clientKind`, `clientId`, `appId`, `nonce`, `state`, `redirectUri`, `extendedEphemeralPublicKey`, `maxEpoch`, `status`, `expiresAt`, timestamps
- `UserIdentity`
  - `id`, `issuer`, `subject`, `salt`, `walletAddress`, timestamps
- `UserSession`
  - `id`, `userIdentityId`, `clientKind`, `clientId`, `appId`, `walletAddress`, `chainId`, `tokenHash`, `expiresAt`, timestamps

Reserved first-party auth client:

- the dashboard uses shared auth as `clientKind=developer_dashboard`
- the dashboard uses a reserved `clientId` such as `celeris-dashboard`
- dashboard auth must not depend on a developer-created `App` record existing first

### Credits and purchase flow

- `CheckoutSession`
  - `id`, `appId`, `walletAddress`, `credits`, `status`, `successRedirectUrl`, `cancelRedirectUrl`, timestamps
- `CreditLedgerEntry`
  - `id`, `appId`, `walletAddress`, `chainId`, `deltaCredits`, `reason`, `referenceType`, `referenceId`, timestamps

### Sponsored action flow

- `PendingActionReservation`
  - `id`, `appId`, `walletAddress`, `chainId`, `actionType`, `status`, optional `metadataJson`, `creditsReserved`, `transactionBytes`, `sponsorSignature`, `sponsorAddress`, `expiresAt`, `submittedDigest`, timestamps
- `SponsorGasCoinLock`
  - `id`, `appId`, `reservationId`, `objectId`, `version`, `digest`, `status`, `expiresAt`, timestamps
- `TransactionRecord`
  - `id`, `appId`, `walletAddress`, `chainId`, `actionType`, optional `metadataJson`, `digest`, `explorerUrl`, `status`, `confirmedAt`, timestamps

## Public API Plan

### Developer API

- `GET /v1/developer/me`
- `POST /v1/developer/profile`
- `POST /v1/developer/apps`
- `GET /v1/developer/apps`
- `GET /v1/developer/apps/:appId`
- `POST /v1/developer/apps/:appId/sponsor-wallet`
- `GET /v1/developer/apps/:appId/sponsor-wallet`
- `PUT /v1/developer/apps/:appId/program`
- `GET /v1/developer/apps/:appId/program`
- `GET /v1/developer/apps/:appId/actions`
- `PUT /v1/developer/apps/:appId/actions/:actionType`

### User auth API

- `POST /v1/auth/login-requests`
- `GET /v1/auth/google/start`
- `GET /v1/auth/google/callback`
- `POST /v1/auth/token`
- `POST /v1/auth/logout`
- `GET /v1/me`

### User app API

- `GET /v1/apps/:appId/catalog`
- `GET /v1/apps/:appId/balance`
- `GET /v1/apps/:appId/transactions`
- `POST /v1/apps/:appId/checkout-sessions`
- `POST /v1/apps/:appId/checkout-sessions/:checkoutSessionId/complete`
- `POST /v1/apps/:appId/actions/:actionType/execute`
- `POST /v1/apps/:appId/actions/:actionType/complete`

## SDK Plan

### Browser SDK

The browser SDK is the main integration surface that the developer frontend app consumes.

Target API shape:

- `createCelerisBrowserClient(config)`
- `client.auth.startLogin()`
- `client.auth.handleRedirectCallback()`
- `client.auth.getSession()`
- `client.auth.signOut()`
- `client.apps.getCatalog()`
- `client.credits.getBalance()`
- `client.credits.startCheckout()`
- `client.actions.execute({ actionType, transaction, metadata? })`
- optional reference helper: `client.actions.sayHello({ username })`
- `client.transactions.list()`

The SDK must own:

- login-request creation
- zkLogin ephemeral state generation
- auth-code exchange
- user bearer token storage in session-scoped storage
- accepting developer-built Sui `Transaction` objects for registered actions
- serializing transactions to transaction-kind bytes for sponsorship API calls
- sponsored transaction submission
- completion reporting

### Server SDK

The server SDK is smaller and exists mainly to support developer provisioning examples and scripts.

Target API shape:

- `createCelerisServerClient(config)`
- `developers.getMe()`
- `developers.ensureProfile()`
- `apps.create()`
- `apps.get()`
- `apps.provisionSponsorWallet()`
- `apps.registerProgram()`
- `apps.configureAction()`
- optional reference helper: `apps.configureSayHello()`

## Vertical Slice Plan

## Slice 0: Workspace Bootstrap

### Goal

Stand up the repo structure and shared runtime skeleton so later slices do not fight build tooling.

### Deliverables

- `apps/api` Express bootstrap
- `apps/web` Next.js bootstrap
- `packages/db` Prisma bootstrap
- `packages/shared` with env validation and shared schema helpers
- `packages/sdk-browser` and `packages/sdk-server` package skeletons
- base TypeScript configuration and workspace scripts

### Tasks

- Set up workspace package boundaries and TS project references.
- Create Express bootstrapping with:
  - request ID middleware
  - structured logger
  - centralized error handler
  - `/health`
- Create Next.js bootstrapping with:
  - App Router
  - auth UI route group
  - demo UI route group
- Add Prisma schema, migrations folder, and generated client workflow.
- Add test harness for:
  - unit tests
  - API integration tests
  - Next.js component or route tests

### Exit criteria

- `npm run dev` boots both apps.
- `prisma migrate dev` works.
- the SDK packages compile.
- health checks are green.

## Slice 1: Developer App Setup

### Goal

A developer can create a new app, provision its sponsor wallet, register Sui program metadata, configure metered user actions, and point a Next.js frontend app at that app's public config.

### Database work

- Add `App`
- Add `ManagedAction`
- Add `SponsorWallet`
- Add `RegisteredProgram`

### Express work

- Implement developer app routes behind an authenticated developer context.
- Implement app creation and fetch routes.
- Implement sponsor-wallet provisioning and read routes.
- Implement program registration and read routes.
- Implement generic action configuration routes.
- Add Sui ID validation helpers in `packages/shared`.

### Next.js work

- Add a minimal setup console for the developer app domain.
- Allow a developer to:
  - create an app
  - provision a sponsor wallet
  - enter `packageId`, `appStateObjectId`, and `authorityCapObjectId`
  - configure action credit usage and enabled state
- Add a simple frontend app config module that uses:
  - `appId`
  - `apiOrigin`
  - `hostedAuthOrigin`
  - `redirectUri`
  - optional `suiRpcOrigin`

### SDK work

- Implement server SDK methods for developer provisioning.
- Do not bypass the public developer API from the setup console.

### Test plan

- app creation
- sponsor-wallet provisioning is idempotent
- malformed Sui IDs are rejected
- action config is persisted correctly

### Exit criteria

- A blank database can reach the state "brand new app created and configured in Celeris."
- The frontend app has enough public config to proceed to user auth in the next slice.

Follow-up note:

- Slice 1 landed the developer app domain before the public surface split and shared-auth model were clarified.
- Slice 1.1 closes that gap by making the dashboard consume shared Google + zkLogin auth, adding developer authorization, and separating the `app` and `demo` surfaces without pulling later payments or execution flows forward.

## Slice 1.1: Developer Surface Realignment

### Goal

Align the implemented developer setup flow with the clarified MVP surface model:

- `app.celeris.pro` = Celeris developer dashboard
- `demo.celeris.pro` = reference SDK consumer app
- `auth.celeris.pro` = shared Google + zkLogin auth for developer sign-in and user login

All three web surfaces remain served by the same Next.js codebase.

### Database work

- Add `DeveloperProfile`.
- Add `AuthLoginRequest`.
- Add `UserIdentity`.
- Add `UserSession`.
- Replace the interim developer credential/session model with shared-auth-backed developer authorization.
- Reserve a first-party dashboard auth client identity inside shared auth instead of treating the dashboard as a developer-created app consumer.

### Express work

- Implement shared auth routes that the first-party dashboard consumes through the same hosted contract as external apps.
- Reserve and validate the dashboard auth audience separately from app-scoped consumer audiences.
- Implement Google OAuth start and callback endpoints for the dashboard auth client.
- Implement token exchange and `GET /v1/me` for shared auth sessions.
- Implement developer profile resolution or creation for authenticated dashboard users.
- Implement `GET /v1/developer/me`.
- Implement `POST /v1/developer/profile`.
- Switch developer API auth from interim developer bearer sessions to shared user sessions plus developer authorization.
- Distinguish developer-dashboard origin config from demo-frontend origin config where runtime values are exposed.
- Ensure developer setup responses and provisioning guidance unambiguously point to the reference demo origin for user-facing SDK usage.

### Next.js work

- Add host-aware routing or equivalent surface segmentation inside `apps/web`.
- Move the developer setup console onto the developer dashboard surface.
- Make `app.celeris.pro/` show the developer dashboard when a valid shared-auth developer session exists, or redirect to auth when it does not.
- Make `demo.celeris.pro/` show the Hello Celeris app home.
- Preserve a separate demo surface as the reference SDK consumer shell without exposing developer setup as the primary user-facing entrypoint.
- Add auth pages on `auth.celeris.pro` for the dashboard sign-in flow.

### Shared and SDK work

- Add explicit runtime config naming for developer app origin versus demo frontend origin.
- Model the dashboard as a first-party auth client that uses the same hosted auth contract as third-party consumers.
- Keep the dashboard on the same auth protocol while giving it a reserved first-party client identity.
- Keep the public browser SDK config contract focused on the developer-owned frontend integration path.
- Update any setup-console guidance or sample config generation so it remains clear which values belong to the developer dashboard, the reference demo app, and shared auth.

### Test plan

- host-based or surface-aware routing resolves the correct page for `app`, `demo`, and `auth`
- dashboard auth redirects and returns correctly through the shared auth origin
- shared auth distinguishes the reserved dashboard client from app-scoped consumer clients
- developer profile bootstrap works for an authenticated dashboard user
- the developer setup flow still works end to end on the developer dashboard surface
- the demo surface no longer acts as the implicit home for developer setup
- local dev routing docs and runtime config examples are consistent

### Exit criteria

- The developer setup console is clearly assigned to the app origin.
- The demo origin is reserved for the reference SDK consumer app.
- The auth origin is used for developer sign-in and future user auth through one shared Google + zkLogin contract.
- `app.celeris.pro/` resolves to the dashboard or redirects to auth when unauthenticated.
- `demo.celeris.pro/` resolves to the Hello Celeris home.
- Authenticated dashboard users resolve to developer profiles without a separate credential system.
- The shared auth contract treats the dashboard as a reserved first-party client identity, not as a developer-created app.
- The public origin model and shared auth base are explicit enough for Slice 2 SDK-consumer auth work and later user flows.

## Slice 2: SDK Consumer User Auth and zkLogin Wallet Identity

### Goal

A user can sign in from the reference demo app through the shared auth origin, return via the public browser SDK flow, and see a stable zkLogin wallet address.

### Database work

- No new core auth persistence model is expected.
- Reuse the shared auth foundation from Slice 1.1.

### Express work

- Extend `POST /v1/auth/login-requests` for the reference demo app and external browser-SDK consumers.
- Enforce app-scoped login-request validation, redirect URI validation, and auth audience checks for SDK consumers.
- Ensure auth-code exchange returns:
  - user bearer token
  - wallet identity
  - zkLogin proof material needed for silent signing
- Reuse `GET /v1/me`, logout, and shared session validation for app consumers.

### Next.js work

- Add redirect/callback handling page on the demo origin.
- Add signed-in header state showing wallet address.
- Add logout flow.

### SDK work

- Generate zkLogin ephemeral keypair and randomness.
- Store ephemeral secret material in `sessionStorage`.
- Start hosted login.
- Handle callback completion.
- Exchange auth code for user session.
- Store the user bearer token in session-scoped storage.

### Test plan

- same Google subject returns same wallet address across repeat logins
- login-request expiry is enforced
- redirect URI validation is enforced
- app-scoped auth audience validation is enforced
- browser storage does not persist sensitive material to `localStorage`
- `/v1/me` reflects the authenticated user session

### Exit criteria

- A user can sign in through the Next.js app and see the stable Sui wallet address.
- The browser SDK owns the full login flow.

## Slice 3: Credits and Purchase Flow

### Goal

A signed-in user can buy credits through a hosted mock checkout flow and see the updated balance in the frontend app.

### Database work

- Add `CheckoutSession`
- Add `CreditLedgerEntry`

### Express work

- Implement `GET /v1/apps/:appId/catalog`.
- Implement `GET /v1/apps/:appId/balance`.
- Implement `POST /v1/apps/:appId/checkout-sessions`.
- Implement `POST /v1/apps/:appId/checkout-sessions/:checkoutSessionId/complete`.
- Implement append-only credit ledger writes for:
  - purchase
  - future reserve
  - future capture
  - future release

### Next.js work

- Add a hosted mock checkout page.
- Redirect the user from the demo app to checkout and back.
- Refresh balance after checkout success.
- Show action pricing from the catalog response.

### SDK work

- Implement catalog fetch.
- Implement balance fetch.
- Implement checkout session creation and redirect helpers.

### Test plan

- checkout session creation
- checkout completion creates the right credit ledger entries
- balance query reflects ledger state
- repeat completion calls are idempotent

### Exit criteria

- A signed-in user can buy credits and see the new balance without manual database changes.

## Slice 4: Sponsored `say_hello` and Transaction Feed

### Goal

A user with credits can execute the reference `say_hello` action on Sui testnet through the sponsored transaction flow and see the result in the app-wide feed.

Status clarification:
- The implemented slice currently binds the action route, SDK helper, and transaction validation directly to `say_hello`.
- The desired product contract is generic metered action sponsorship. Celeris should meter and sponsor a registered `actionType` supplied by the app, while the developer app supplies a Sui `Transaction` and the Celeris SDK serializes it for sponsorship.
- Slice 4.1 bridges this gap.

### Database work

- Add `PendingActionReservation`
- Add `SponsorGasCoinLock`
- Add `TransactionRecord`

### Sui and shared package work

- Finalize the Move package for:
  - `initialize_app`
  - `say_hello`
- Add shared TS helpers for:
  - address and object ID validation
  - username normalization
  - reference `say_hello` transaction construction
  - sponsorship-policy validation

### Express work

- Implement `POST /v1/apps/:appId/actions/:actionType/execute`.
- Implement `POST /v1/apps/:appId/actions/:actionType/complete`.
- Implement `GET /v1/apps/:appId/transactions`.
- Implement sponsor gas coin selection and locking.
- Implement credit reserve on `execute`.
- Implement sponsor signing.
- Implement credit capture or release on completion.
- Implement digest verification against Sui RPC.
- Implement a lightweight reconciliation loop for `submitted` records that are not final yet.

### Next.js work

- Add username entry form.
- Add execute button and pending state.
- Add app-wide transaction feed with:
  - wallet address
  - username
  - rendered message
  - status
  - timestamp
  - Explorer link

### SDK work

- Build the reference `say_hello` `Transaction` in the demo app, then submit it through the generic action execution SDK API.
- Call execute route.
- Add zkLogin user signature.
- Submit directly to Sui RPC.
- Call completion route.
- Refresh balance and feed after execution.

### Test plan

- transaction kinds that violate the app sponsorship policy are rejected
- credits are reserved before sponsor signing
- failed submission releases credits
- successful submission records digest and explorer URL
- feed order is newest first
- 101st greeting is rejected by the Move package

### Exit criteria

- A user can execute paid `say_hello` end to end.
- The resulting transaction appears in the app-wide feed.

## Slice 4.1: Generic Metered Sponsored Actions

### Goal

Replace the hard-coded `say_hello` action contract with a generic registry of developer-defined action types used for credit reservation, sponsorship, completion, and feed records.

The reference demo still uses `say_hello`, but `say_hello` should be one configured action among many possible app action types, not a backend-special route or schema.

### Database work

- Update `ManagedAction` so `actionType` is developer-defined per app.
- Store `creditUsage` and `isEnabled` for each action.
- Add optional action display metadata if needed for dashboard/catalog UX.
- Update reservations and transaction records to store generic action metadata instead of `username`/`message` fields as required columns.

### Express work

- Add developer action list and upsert routes:
  - `GET /v1/developer/apps/:appId/actions`
  - `PUT /v1/developer/apps/:appId/actions/:actionType`
- Replace hard-coded user execution routes with:
  - `POST /v1/apps/:appId/actions/:actionType/execute`
  - `POST /v1/apps/:appId/actions/:actionType/complete`
- On API execute:
  - require the action to exist and be enabled
  - reserve `creditUsage`
  - accept serialized transaction-kind bytes produced by the browser SDK
  - enforce app sponsorship policy before sponsor signing
- Sponsorship policy must at minimum bind transactions to the app's configured chain and registered Sui package or program metadata.
- Reject unregistered actions, disabled actions, insufficient credits, wrong-chain transactions, and transactions outside the sponsorship policy.
- Keep credit capture/release and reconciliation idempotent.

### SDK work

- Add generic browser SDK execution:
  - `client.actions.execute({ actionType, transaction, metadata? })`
- The SDK should use `@mysten/sui` to build transaction-kind bytes from the supplied `Transaction` for the API call.
- Keep `client.actions.sayHello({ username })` only as a reference helper layered on top of the generic execute method.
- Ensure the reference app builds the `say_hello` `Transaction` outside the backend-special action path.

### Next.js work

- Make the developer action card create/update arbitrary action types with credit usage and enabled state.
- Show the full configured action list.
- Show catalog action pricing from the generic action list.
- Keep the reference demo button mapped to the configured `say_hello` action.

### Docs work

- Update the walkthrough so action registration describes generic app actions.
- Explain that Celeris meters and sponsors registered actions, while the developer app owns Sui `Transaction` construction and the Celeris SDK handles transaction-kind serialization for sponsorship.
- Document the sponsorship policy caveat so the sponsor wallet cannot sign unrelated arbitrary transactions.

### Test plan

- action type validation and uniqueness per app
- developer action list and upsert API tests
- catalog includes all enabled configured actions
- execute rejects unknown and disabled action types
- execute reserves the configured `creditUsage`
- sponsorship policy rejects transactions outside the app's registered program scope
- completion captures or releases credits for arbitrary action types
- feed records preserve action type and metadata

### Exit criteria

- The developer dashboard can create and list arbitrary app action types.
- The browser SDK can request sponsorship for any registered enabled action type.
- The backend no longer requires a backend-special route or Move-function binding for each metered action.
- The reference `say_hello` demo still works through the generic action execution path.

## Slice 5: SDK Consumer Hardening, Walkthrough, and Regression

### Goal

Turn the reference implementation into a real developer-integration demo and finish the operational surface needed to run the MVP from scratch.

### Deliverables

- The Next.js app consumes only public browser SDK APIs for user flows.
- The setup console and walkthrough support the end-to-end demo path.
- Regression coverage exists for each major slice.
- The manual Sui registration flow is documented step by step.

### Express work

- Tighten DTO schemas and response contracts.
- Add structured audit logging around:
  - developer sign-in
  - sponsor-wallet provisioning
  - program registration
  - checkout completion
  - transaction execution
- Add admin-safe health diagnostics for auth, prover, and Sui RPC connectivity.

### Next.js work

- Remove any remaining direct API plumbing from demo pages that bypasses the SDK.
- Finalize UX for:
  - developer setup
  - user sign-in
  - purchase
  - `say_hello`
  - transaction feed

### SDK work

- Freeze the minimal public config contract.
- Add integration examples for a developer-owned Next.js frontend.
- Add browser SDK error classes for:
  - auth failures
  - insufficient credits
  - sponsorship failures
  - transaction verification failures

### Docs work

- Add the manual walkthrough required by `MVP_SPEC.md`.
- Include exact steps for:
  - env setup
  - database bootstrap
  - Google OAuth setup
  - prover startup
  - app creation
  - sponsor wallet funding
  - Move package publish
  - `initialize_app`
  - manual program registration
  - action configuration
  - frontend startup
  - sign-in, purchase, and `say_hello`

### Test plan

- API integration tests against a real Postgres test database
- Playwright end-to-end tests for the Next.js setup and user flows
- mocked automated tests for Google verifier, prover, and Sui RPC adapters
- manual smoke test against real Google auth and Sui testnet

### Exit criteria

- The walkthrough works from an empty database.
- The reference frontend app proves real SDK consumption.
- The regression suite covers the full MVP path.

## Cross-Cutting Implementation Details

## Authentication model

- The dashboard and app consumers share one Google + zkLogin auth contract on the auth origin.
- The dashboard is a first-party auth client that uses the same hosted auth flow shape as external consumers.
- The dashboard uses a reserved first-party client identity, while consumer apps use app-scoped client identities.
- Developer authorization is layered on top of shared auth through `DeveloperProfile`.
- User identity is stable by `issuer + subject + salt -> walletAddress`.

## Session model

- Shared auth sessions are bearer tokens stored server-side as hashes.
- Sessions are scoped by client kind and client ID, plus app ID where relevant.
- Dashboard sessions use the reserved dashboard client scope; consumer sessions use app-scoped client scopes.
- Browser-side user tokens are held in memory plus `sessionStorage`, never `localStorage`.

## Secret handling

- Sponsor wallet secrets are encrypted at rest.
- Google client secret stays server-side only.
- Raw Google ID tokens should not be persisted after verification.
- zkLogin ephemeral private keys stay in browser session storage only.

## Reconciliation model

- `execute` writes reservation state and reserves credits.
- `complete` moves a reservation to `submitted` or `failed`.
- If `submitted` cannot be finalized immediately, a reconciliation worker polls Sui RPC and settles:
  - `confirmed`
  - `failed`
- Credit ledger effects must be idempotent and reference-based.

## Testing Strategy

### Automated tests

- unit tests for validators, helpers, and services
- integration tests for Express + Prisma + Postgres
- browser and route tests for Next.js
- end-to-end tests for setup, login, purchase, and `say_hello`

### External dependency strategy

Automated tests should use adapters and test doubles for:

- Google JWKS verification
- zkLogin prover
- Sui RPC

Manual smoke tests should cover:

- real Google login
- real prover integration
- real Sui testnet execution

## Key Risks and Mitigations

### zkLogin flow complexity

Risk:
- shared auth, prover inputs, and browser callback handling can drift if the browser SDK and API are built separately

Mitigation:
- ship Slice 2 as one slice owned by both API and SDK changes
- keep one canonical login-request schema in `packages/shared`

### Sponsor gas coin locking

Risk:
- double-use of the same gas coin across concurrent requests

Mitigation:
- persist coin locks in Postgres
- always lock by reservation ID with TTL
- release locks in completion and reconciliation paths

### Real Google auth in local development

Risk:
- callback URI and multi-origin auth setup is fragile

Mitigation:
- use one Next.js codebase with three local origins
- document exact localhost ports and Google callback URIs
- keep callback handling in one place

### SDK drift from reference app

Risk:
- the internal app starts depending on private modules instead of the public SDK

Mitigation:
- enforce package boundaries
- make Slice 5 explicitly remove private integration shortcuts

## Final Definition of Done

The implementation is complete only when all of the following are true:

- all eight slices are complete, including Slice 4.1
- the Move package is published and can be manually initialized
- a brand new app can be created in Celeris from the setup console or developer API
- the developer dashboard lives on the app origin while the reference consumer app lives on the demo origin
- the sponsor wallet can be provisioned and funded
- the Sui program can be manually registered against that app
- the Next.js frontend app consumes the browser SDK for user flows
- a user can sign in with real Google + zkLogin
- a user can buy credits
- a user can execute the registered paid `say_hello` reference action through the generic action path
- the transaction feed renders the resulting entry with Explorer link
- `npm run typecheck` passes
- `npm test` passes
- the manual walkthrough has been executed successfully from a clean database
