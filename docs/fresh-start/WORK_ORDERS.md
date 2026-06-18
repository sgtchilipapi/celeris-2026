# Fresh Start Work Orders

Read these first:

- [MVP_SPEC.md](./MVP_SPEC.md)
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

This document turns the implementation plan into ordered work orders that an agent can execute sequentially.

## Operating Rules

- Implement in order unless a later work order explicitly says otherwise.
- Treat each work order as a vertical slice.
- Land database schema, API routes, SDK changes, frontend changes, tests, and docs needed for that slice together.
- Do not leave behind temporary alternate flows unless they are required inside the same work order.
- The reference frontend must consume the browser SDK through its public API.
- Manual Sui publish, `initialize_app`, and program registration remain part of the MVP and must be documented rather than fully automated away.

## Sequence Summary

| WO | Status | Title | Primary Outcome | Depends On |
| --- | --- | --- | --- | --- |
| `FS-00` | complete | Workspace Bootstrap | Monorepo skeleton, Express, Next.js, Prisma, shared packages, test harness | none |
| `FS-01` | complete | Developer App Setup | App creation, sponsor-wallet provisioning, program registration, action config | `FS-00` |
| `FS-01.1` | complete | Developer Surface Realignment | Shared Google + zkLogin dashboard auth, developer authorization, and dedicated app/demo/auth surfaces | `FS-00`, `FS-01` |
| `FS-02` | complete | SDK Consumer User Auth And zkLogin Identity | Reference consumer sign-in, zkLogin wallet identity, browser SDK auth flow | `FS-00`, `FS-01`, `FS-01.1` |
| `FS-02.1` | complete | Real Google OAuth And zkLogin Completion | Replace mock hosted auth with real Google OAuth, zkLogin identity derivation, and prover-backed session material | `FS-00`, `FS-01`, `FS-01.1`, `FS-02` |
| `FS-03` | complete | Credits And Mock Checkout | Catalog, balance, checkout flow, persistent credit ledger | `FS-01`, `FS-01.1`, `FS-02`, `FS-02.1` |
| `FS-04` | complete | Sponsored Say Hello And Feed | Move package finalization, reference tx builder, sponsor-sign flow, completion, app-wide feed | `FS-01`, `FS-01.1`, `FS-02`, `FS-02.1`, `FS-03` |
| `FS-04.1` | planned | Generic Metered Sponsored Actions | Replace hard-coded `say_hello` action routes with generic action registry, sponsorship, and SDK execution | `FS-01`, `FS-03`, `FS-04` |
| `FS-05` | complete | SDK Consumer Hardening And Walkthrough | Public SDK integration proof, walkthrough, regression suite, final polish | `FS-00`, `FS-01`, `FS-01.1`, `FS-02`, `FS-02.1`, `FS-03`, `FS-04`; should be revisited after `FS-04.1` |

## Dependency Map

```text
FS-00 -> FS-01
FS-00 -> FS-01.1
FS-01 -> FS-01.1
FS-00 -> FS-02

FS-01.1 -> FS-02
FS-01 -> FS-02
FS-02 -> FS-02.1
FS-01.1 -> FS-02.1
FS-01 -> FS-02.1
FS-00 -> FS-02.1

FS-02.1 -> FS-03
FS-02.1 -> FS-04
FS-02.1 -> FS-05
FS-01.1 -> FS-03
FS-01 -> FS-03
FS-01.1 -> FS-04
FS-01 -> FS-04

FS-02 -> FS-03
FS-02 -> FS-04

FS-03 -> FS-04
FS-04 -> FS-04.1
FS-03 -> FS-04.1
FS-01 -> FS-04.1

FS-01.1 -> FS-05
FS-00 -> FS-05
FS-01 -> FS-05
FS-02 -> FS-05
FS-02.1 -> FS-05
FS-03 -> FS-05
FS-04 -> FS-05
FS-04.1 -> FS-05
```

## `FS-00` Workspace Bootstrap

### Objective

Stand up the monorepo, package boundaries, runtime bootstraps, and shared tooling so the rest of the MVP can be implemented without reworking infrastructure.

### In Scope

- workspace package structure
- TypeScript project references or equivalent workspace config
- `apps/api` Express bootstrap
- `apps/web` Next.js bootstrap
- `packages/db` Prisma bootstrap
- `packages/shared` bootstrap for env parsing and shared schemas
- `packages/sdk-browser` and `packages/sdk-server` package skeletons
- base logging, error handling, and health endpoints
- initial test harness

### Out Of Scope

- developer auth flows
- user auth flows
- checkout
- Sui execution

### Implementation Checklist

- Create the repo shape described in `IMPLEMENTATION_PLAN.md`.
- Configure workspace scripts for:
  - `dev`
  - `build`
  - `typecheck`
  - `test`
  - Prisma generation and migration
- Add Express app bootstrap with:
  - request ID middleware
  - JSON parsing
  - centralized error middleware
  - `/health`
- Add Next.js App Router shell with:
  - demo route group
  - hosted-auth route group
  - basic layout and env bootstrap
- Add initial Prisma schema and migration workflow.
- Add shared env validation in `packages/shared`.
- Add package exports for `sdk-browser` and `sdk-server`, even if methods are placeholders.
- Add test runners for unit, API integration, and frontend tests.

### Deliverables

- working monorepo layout
- generated Prisma client
- healthy API and web bootstraps
- compileable SDK packages
- passing bootstrap test suite

### Acceptance Criteria

- `npm run dev` starts both API and web apps.
- `npm run typecheck` passes.
- `prisma migrate dev` works against a local Postgres database.
- `GET /health` succeeds.
- browser and API test harnesses can run at least one smoke test each.

### Verification

- boot apps locally
- verify Prisma generate and migrate
- run smoke tests for API and web startup

## `FS-01` Developer App Setup

### Objective

Enable a developer to create a new app in Celeris, provision its sponsor wallet, register Sui package metadata, configure metered user actions, and produce the public config needed by a frontend app.

### In Scope

- app creation and fetch routes
- sponsor-wallet provisioning and retrieval
- program registration and retrieval
- action pricing/config routes
- developer setup UI in Next.js
- server SDK for provisioning

### Out Of Scope

- shared Google + zkLogin auth for the dashboard
- user login
- user credits
- on-chain execution

### Data Model

- `App`
- `ManagedAction`
- `SponsorWallet`
- `RegisteredProgram`

### Implementation Checklist

- Add Prisma models and migrations for the developer/app setup domain.
- Implement developer app routes for an authenticated developer context:
  - create app
  - list apps
  - get app
- Implement sponsor-wallet routes:
  - create or return existing sponsor wallet
  - fetch sponsor wallet
- Implement program registration routes:
  - register package and object IDs
  - fetch program registration
- Implement action config routes.
- Add Sui ID validators in `packages/shared`.
- Implement setup console pages in Next.js for:
  - app creation
  - sponsor-wallet provisioning
  - program registration
  - action configuration
- Implement matching methods in `sdk-server`.

### Deliverables

- persistent app setup state
- minimal developer setup console
- server SDK methods for setup flow

### Acceptance Criteria

- an authenticated developer can create a new app
- sponsor-wallet provisioning is idempotent
- malformed Sui package or object IDs are rejected
- action pricing persists and is returned correctly
- the setup console can drive the full developer setup flow against public APIs

### Verification

- API integration tests for each route
- UI test for developer setup flow
- manual check that a fresh database can reach "app configured and ready for user auth"

### Status Note

- `FS-01` is already implemented in the repo.
- That implementation landed with interim developer email/password auth before the dashboard shared-auth model and developer/dashboard versus reference-demo surface split were clarified.
- `FS-01.1` is the bridge slice that replaces the interim developer auth with shared Google + zkLogin auth, adds developer authorization, and aligns the existing setup flow with the revised target without pulling in user payments or execution scope.

## `FS-01.1` Developer Surface Realignment

### Objective

Align the implemented developer setup flow with the clarified MVP surface model:

- `app.celeris.pro` = Celeris dashboard/app for developers
- `demo.celeris.pro` = sample third-party SDK consumer app
- `auth.celeris.pro` = shared Google + zkLogin auth for developer sign-in and user login
- `api.celeris.pro` = backend API

All web surfaces remain served by the existing `apps/web` Next.js codebase.

### In Scope

- dedicated developer-dashboard surface on the app origin
- dedicated reference consumer-app surface on the demo origin
- shared-auth surface kept on the auth origin
- dashboard sign-in through the same hosted auth contract used by app consumers
- reserved first-party dashboard auth client identity within the shared auth contract
- developer authorization layered on top of shared auth
- host-aware or equivalent surface-aware routing inside `apps/web`
- moving the setup console off the implicit demo surface
- redirecting unauthenticated app-origin visits to auth
- runtime-config naming alignment for developer app origin versus demo frontend origin
- developer-facing config output and docs alignment
- local dev and tunnel routing documentation updates
- tests covering the surface split

### Out Of Scope

- browser-SDK user auth orchestration for third-party consumers
- user credits
- on-chain execution

### Data Model

- `DeveloperProfile`
- `AuthLoginRequest`
- `UserIdentity`
- `UserSession`
- deprecation or migration path for interim developer credential/session tables
- reserved dashboard `clientKind` and `clientId` convention in shared auth

### Implementation Checklist

- Add explicit origin vocabulary for developer dashboard, demo frontend, shared auth, and API surfaces.
- Implement the dashboard as a first-party auth client that consumes the same hosted auth contract as third-party consumers.
- Reserve the dashboard auth audience as a first-party `clientKind` and `clientId`, separate from developer-created app consumers.
- Add shared Google OAuth start, callback, token exchange, and session validation for dashboard sign-in.
- Add developer authorization bootstrap through `DeveloperProfile`.
- Replace interim developer sign-up and sign-in routes with shared-auth-backed developer access.
- Update shared env parsing and runtime-config handling so the developer app origin is distinct from the demo frontend origin.
- Update `apps/web` routing so the same Next.js deployment resolves:
  - the developer dashboard on the app origin
  - auth redirect from the app origin when no developer session exists
  - the Hello Celeris home on the demo origin
  - developer sign-in on the auth origin
- Remove the current ambiguity where the developer setup console is exposed as part of the demo surface.
- Keep the developer setup flow behavior intact against the public developer APIs.
- Update developer-facing sample config or setup output so the upcoming user-flow work targets the demo origin, not the developer dashboard origin.
- Update local dev and Cloudflare tunnel documentation to include `demo.celeris.pro`.
- Add frontend and runtime tests for surface resolution and setup-console placement.

### Deliverables

- explicit app/demo/auth/api surface model in the codebase
- developer setup console anchored to the app origin
- reference consumer shell anchored to the demo origin
- developer sign-in anchored to the auth origin
- shared Google + zkLogin auth backing the dashboard
- reserved first-party dashboard auth client identity in the shared auth contract
- developer authorization through `DeveloperProfile`
- aligned runtime-config and setup documentation

### Acceptance Criteria

- the developer setup console is reachable from the app origin
- `app.celeris.pro/` shows the developer dashboard for authenticated developers and redirects to auth otherwise
- `demo.celeris.pro/` shows the Hello Celeris app home
- the demo origin no longer acts as the default home for developer setup
- the auth origin serves developer sign-in now and user auth later through the same shared hosted contract
- authenticated dashboard users resolve to developer profiles without a separate credential system
- shared auth distinguishes the reserved dashboard client from app-scoped consumer apps
- one `apps/web` deployment serves all three web surfaces
- the existing `FS-01` setup flow still works against the public APIs after the surface split
- the clarified surface model is sufficient input for `FS-02`

### Verification

- frontend tests for host-aware or surface-aware routing
- auth redirect and return tests for the dashboard flow
- auth audience tests for reserved dashboard client versus app-scoped consumer clients
- developer profile bootstrap tests
- manual checks for app-origin setup, demo-origin shell, and auth-origin shell
- documentation review proving the dev routing and runtime-origin guidance are internally consistent

## `FS-02` SDK Consumer User Auth And zkLogin Identity

### Objective

Enable the reference consumer app to use the existing shared auth system, derive a stable zkLogin wallet address, issue a user session, and make the browser SDK own the auth flow for the demo origin.

### In Scope

- app-scoped login-request creation
- shared auth consumer flow for the demo app
- browser SDK orchestration on top of the shared auth foundation
- browser SDK auth flow
- signed-in frontend state

### Out Of Scope

- dashboard auth bootstrap
- credits
- checkout
- sponsored transactions

### Data Model

- no new core auth persistence models expected
- reuse the shared auth foundation introduced in `FS-01.1`

### Implementation Checklist

- Extend `POST /v1/auth/login-requests` for the demo app and browser-SDK consumers.
- Enforce login-request expiry, redirect URI validation, and app-scoped auth audience validation for consumer apps.
- Reuse the shared Google verifier, zkLogin derivation, prover adapter, and session issuance from `FS-01.1`.
- Reuse `POST /v1/auth/token` and `GET /v1/me` for app consumers.
- Add callback handling page on the demo origin.
- Implement browser SDK methods for:
  - start login
  - handle callback
  - exchange auth code
  - get current session
  - sign out
- Store zkLogin ephemeral material in `sessionStorage` only.

### Deliverables

- working shared auth flow for the reference consumer app
- stable wallet identity
- user session support
- browser SDK auth integration

### Acceptance Criteria

- a user can sign in with real Google auth
- the same Google subject resolves to the same zkLogin wallet address on repeat sign-ins
- invalid or expired login requests are rejected
- invalid auth audiences for consumer apps are rejected
- browser auth state does not use `localStorage` for sensitive zkLogin material
- the Next.js app shows the authenticated wallet address after sign-in

### Verification

- API tests for login-request, callback, and token exchange
- browser SDK tests for auth orchestration
- manual sign-in test with the current hosted-auth implementation in a configured environment

### Status Note

- `FS-02` is complete for app-scoped auth audiences, browser SDK auth orchestration, callback exchange, session persistence, and demo signed-in state.
- Before `FS-02.1`, the implementation still used mock hosted-auth identity entry and deterministic placeholder wallet derivation.
- `FS-02.1` completes real Google OAuth, zkLogin proof inputs, prover integration, and real zkLogin-derived wallet/session material.

## `FS-02.1` Real Google OAuth And zkLogin Completion

### Objective

Replace the mock hosted-auth identity flow with real Google OAuth plus zkLogin-backed identity/session material for both first-party dashboard auth and app-scoped consumer auth.

This work order exists because `FS-01.1` and `FS-02` established the shared auth contract and surface/SDK wiring, but did not complete the real provider and zkLogin implementation promised by the MVP spec.

### In Scope

- Google OAuth start and callback routes on the API
- hosted-auth UI that starts real Google sign-in instead of collecting email directly
- Google ID token verification
- stable `UserIdentity` resolution from verified Google issuer/subject
- zkLogin salt handling and wallet derivation
- zkLogin prover adapter through `CELERIS_ZKLOGIN_PROVER_ORIGIN`
- session issuance containing the zkLogin session material needed by the browser SDK
- dashboard auth through the reserved first-party client
- demo app-consumer auth through the app-scoped client
- correction of app-origin auth redirects so public origins do not degrade to `localhost`
- tests and docs proving the mock flow is removed or confined to explicit test-only code

### Out Of Scope

- credits
- checkout
- sponsored transaction execution
- Sui package publish automation
- replacing the already-landed app/demo/auth surface split

### Data Model

- reuse `AuthLoginRequest`, `UserIdentity`, `UserSession`, and `DeveloperProfile`
- add fields only if required for Google OAuth state, zkLogin nonce/public key/max epoch, proof inputs, or session material
- preserve dashboard as `clientKind=developer_dashboard` and `clientId=celeris-dashboard`
- preserve app consumers as `clientKind=app_consumer` and `clientId=<appId>`

### Implementation Checklist

- Add env parsing for Google OAuth and zkLogin runtime values, including:
  - `CELERIS_GOOGLE_CLIENT_ID`
  - `CELERIS_GOOGLE_CLIENT_SECRET`
  - `CELERIS_GOOGLE_REDIRECT_URI`
  - `CELERIS_ZKLOGIN_PROVER_ORIGIN`
  - any required salt or JWT/audience configuration
- Replace mock `/v1/auth/login-requests/:loginRequestId/complete` usage in production UI with real Google OAuth start/callback.
- Keep test-only helpers isolated so production hosted auth cannot bypass Google verification.
- Persist or validate OAuth state against `AuthLoginRequest`.
- Verify Google ID tokens server-side before resolving identity.
- Resolve repeat Google sign-ins to the same `UserIdentity` and wallet address.
- Generate or accept SDK-created zkLogin ephemeral material as part of login-request creation.
- Request prover inputs from the configured zkLogin prover.
- Issue sessions with only the zkLogin material the browser needs and without storing sensitive browser material in `localStorage`.
- Update dashboard callback handling to continue bootstrapping `DeveloperProfile`.
- Update demo callback handling to continue using browser SDK public APIs.
- Fix middleware/auth redirect URI construction to use configured public origins rather than `request.nextUrl.origin` when serving tunneled domains.
- Update README and fresh-start docs to distinguish real auth from test mocks.

### Deliverables

- real Google OAuth hosted sign-in for dashboard and demo users
- verified Google identity token handling
- stable zkLogin wallet identity for repeat sign-ins
- prover-backed zkLogin session material in API session responses
- production UI without mock email identity entry
- tests covering dashboard and app-consumer real-auth control flow with mocked Google/prover adapters

### Acceptance Criteria

- `app.celeris.pro/` redirects unauthenticated developers to `auth.celeris.pro` with a public `app.celeris.pro/auth/callback` return URI.
- hosted auth displays a Google sign-in action, not an email/display-name mock form, in production paths.
- Google callback rejects invalid state, invalid audience, invalid ID token, and expired login requests.
- the same verified Google issuer/subject resolves to the same wallet address across dashboard and demo sign-ins.
- dashboard sign-in still creates or resolves a `DeveloperProfile`.
- app-consumer sign-in remains scoped to a known `App` and does not create a developer profile.
- browser SDK auth state and zkLogin ephemeral material remain in `sessionStorage`, not `localStorage`.
- mock identity completion cannot be reached from production hosted-auth UI.

### Verification

- API tests for Google OAuth start, callback, token exchange, invalid state, invalid token, expired login request, and audience validation
- unit tests for Google verifier and zkLogin prover adapters using mocked upstream responses
- browser SDK tests for ephemeral material, callback exchange, and session persistence
- frontend tests for hosted auth rendering Google sign-in and for public-origin redirect URI construction
- manual sign-in test with real Google OAuth in a configured environment
- manual repeat sign-in test proving stable wallet identity

## `FS-03` Credits And Mock Checkout

### Objective

Enable a signed-in user to view the app catalog, purchase credits through a hosted mock checkout flow, and see the updated persistent balance.

### In Scope

- catalog endpoint
- balance endpoint
- checkout session creation
- checkout completion
- append-only credit ledger
- Next.js checkout flow
- browser SDK balance and checkout helpers

### Out Of Scope

- sponsored `say_hello`
- transaction feed

### Data Model

- `CheckoutSession`
- `CreditLedgerEntry`

### Implementation Checklist

- Add Prisma models and migrations for checkout sessions and the credit ledger.
- Implement user app routes:
  - `GET /v1/apps/:appId/catalog`
  - `GET /v1/apps/:appId/balance`
  - `POST /v1/apps/:appId/checkout-sessions`
  - `POST /v1/apps/:appId/checkout-sessions/:checkoutSessionId/complete`
- Implement ledger writes for purchase events.
- Ensure balance is derived from ledger state, not duplicated mutable counters.
- Add hosted mock checkout pages in Next.js.
- Add user balance and action price display to the frontend.
- Implement browser SDK methods for:
  - get catalog
  - get balance
  - start checkout
  - complete or refresh after checkout

### Deliverables

- persistent purchase flow
- user balance UI
- browser SDK support for catalog and checkout

### Acceptance Criteria

- a signed-in user can start checkout
- completing checkout creates the correct credit ledger entries
- user balance updates after checkout completion
- repeated completion calls do not duplicate credits
- action price is displayed from the catalog response

### Verification

- API integration tests for checkout creation and completion
- frontend tests for checkout redirect and balance refresh
- manual test proving a signed-in user can buy credits end to end

## `FS-04` Sponsored Say Hello And Feed

### Objective

Enable a user with credits to execute the reference sponsored `say_hello` action on Sui testnet and see the resulting transaction in the app-wide feed.

### Status Clarification

- `FS-04` is complete as implemented, but it hard-codes `say_hello` as the action route, SDK helper, transaction validator, and execution pipeline.
- The clarified product target is a generic action registry where Celeris meters credits by developer-defined `actionType`, while the developer app supplies a Sui `Transaction` and the Celeris SDK serializes it for sponsorship.
- `FS-04.1` is the required bridge work order to align the implementation with that target.

### In Scope

- Move package finalization
- shared Sui helpers
- reference transaction-kind builder and sponsorship-policy validator
- execute and complete routes
- sponsor gas coin locking
- credit reserve, capture, release logic
- digest verification against Sui RPC
- reconciliation loop for pending submissions
- app-wide transaction feed
- browser SDK sponsored action flow
- frontend execution UI and feed

### Out Of Scope

- final walkthrough and regression hardening

### Data Model

- `PendingActionReservation`
- `SponsorGasCoinLock`
- `TransactionRecord`

### Implementation Checklist

- Finalize the Move package for `initialize_app` and `say_hello`.
- Add shared Sui helpers for:
  - package and object ID parsing
  - username normalization
  - canonical `say_hello` transaction construction
  - exact-match transaction validation
- Implement `POST /v1/apps/:appId/actions/say_hello/execute` for the reference path.
- Implement `POST /v1/apps/:appId/actions/say_hello/complete` for the reference path.
- Implement `GET /v1/apps/:appId/transactions`.
- Implement sponsor gas coin discovery, selection, and lock persistence.
- Reserve credits on execute.
- Sponsor-sign transaction bytes and return sponsorship payload.
- Verify digest through Sui RPC on completion.
- Capture or release credits based on final result.
- Add lightweight reconciliation for `submitted` records not yet final.
- Add frontend UI for:
  - username entry
  - execute action
  - pending and error states
  - app-wide transaction feed
- Implement browser SDK methods for sponsored `say_hello`.

### Deliverables

- real Move package behavior
- sponsored transaction pipeline
- app-wide transaction feed
- browser SDK action execution flow

### Acceptance Criteria

- transactions that violate the reference sponsorship policy are rejected
- credits are reserved before sponsor signing
- failed submissions release credits
- successful submissions capture credits and record digest plus explorer URL
- the feed returns newest-first managed transactions
- the user can execute `say_hello` end to end from the Next.js app

### Verification

- unit tests for shared Sui helpers
- API tests for execute and complete flows
- integration tests for credit reservation and reconciliation
- manual test on Sui testnet showing a successful `say_hello`

## `FS-04.1` Generic Metered Sponsored Actions

### Objective

Bridge the gap between the current hard-coded `say_hello` implementation and the desired Celeris action model:

- actions are developer-defined credit-metered app actions
- Celeris does not need to know the concrete blockchain function for each action
- the developer app supplies a Sui `Transaction`
- the Celeris browser SDK serializes that transaction to transaction-kind bytes for the backend API
- Celeris reserves/captures credits and sponsor-signs only when the action and transaction satisfy policy

### In Scope

- generic developer action registry API
- developer dashboard action creation/listing for arbitrary action types
- generic app catalog action list
- generic sponsored action execute/complete routes keyed by `:actionType`
- browser SDK generic action execution method
- reference `say_hello` helper migrated onto the generic API
- sponsorship policy validation for app-scoped Sui transactions
- reservation, completion, reconciliation, and feed records for arbitrary action types
- tests and docs for the clarified action model

### Out Of Scope

- automating Move package publish or `initialize_app`
- adding non-Sui chain support
- building an unlimited policy language
- removing the reference `say_hello` demo

### Data Model

- `ManagedAction`
  - developer-defined `actionType`
  - optional display name
  - `creditUsage`
  - enabled state
  - unique per app
- `PendingActionReservation`
  - generic `actionType`
  - optional metadata JSON for UI/feed context
  - no required `username` or `message` fields for non-`say_hello` actions
- `TransactionRecord`
  - generic `actionType`
  - optional metadata JSON
  - digest, Explorer URL, status, and timestamps

### Implementation Checklist

- Add or update shared schemas for:
  - action type validation
  - action upsert input
  - action list response
  - SDK execute input `{ transaction, metadata? }`
  - API execute input `{ transactionKindBytes, metadata? }`
  - generic completion input
- Replace the `say_hello`-only developer action route with:
  - `GET /v1/developer/apps/:appId/actions`
  - `PUT /v1/developer/apps/:appId/actions/:actionType`
- Replace or wrap the `say_hello`-only app routes with:
  - `POST /v1/apps/:appId/actions/:actionType/execute`
  - `POST /v1/apps/:appId/actions/:actionType/complete`
- On API execute:
  - require a known app
  - require a registered enabled action
  - reserve the action's configured credit usage
  - accept serialized transaction-kind bytes produced by the browser SDK
  - reject transactions outside the sponsorship policy
  - sponsor-sign and return the transaction bytes and sponsor signature
- Sponsorship policy must at minimum bind sponsorship to:
  - the app's configured chain
  - the app's sponsor wallet
  - the app's registered Sui package or program metadata
  - transaction bounds that prevent unrelated sponsor-wallet spending
- Update the browser SDK with:
  - `client.actions.execute({ actionType, transaction, metadata? })`
  - `client.actions.sayHello({ username })` as a reference helper over generic execute
- Use `@mysten/sui` inside the SDK to serialize the supplied `Transaction` to transaction-kind bytes for the API call.
- Update the reference demo so its `say_hello` `Transaction` is supplied through the generic action SDK API.
- Update the developer setup console card with ID `user-actions-configuration` so it can create, update, enable/disable, and list arbitrary action types.
- Update catalog, balance/action display, transaction feed, and walkthrough docs for generic action terminology.

### Deliverables

- generic metered action registry
- generic sponsored action execution API
- generic browser SDK action execution
- dashboard action configuration UI for arbitrary action types
- `say_hello` reference demo running on top of the generic path
- updated docs describing developer-owned transaction construction and Celeris sponsorship policy

### Acceptance Criteria

- a developer can create multiple action types for one app
- action types are unique per app
- each action has configurable credit usage and enabled state
- app catalog returns configured action pricing generically
- execute rejects unknown, disabled, or insufficient-credit action requests
- SDK execute accepts a developer-supplied Sui `Transaction` for a registered action
- API execute accepts transaction-kind bytes serialized by the SDK
- execute rejects transaction kinds outside the app sponsorship policy
- completion captures or releases credits for arbitrary action types
- transaction feed records and returns the generic action type and metadata
- the reference `say_hello` demo still completes end to end through the generic API

### Verification

- shared schema tests for action type and payload validation
- API tests for action create/list/update
- API tests for generic execute/complete success and failure paths
- policy tests rejecting wrong-chain or out-of-program transaction kinds
- SDK tests for generic action execution and `say_hello` helper delegation
- frontend tests for the action registry card and catalog/feed rendering
- manual Sui testnet smoke test with the reference `say_hello` action

## `FS-05` SDK Consumer Hardening And Walkthrough

### Objective

Turn the reference implementation into a clean developer-integration demo, lock the browser SDK as the public frontend contract, add the manual walkthrough, and finish regression coverage.

### In Scope

- SDK public API hardening
- removal of private integration shortcuts in the reference frontend
- walkthrough documentation
- health diagnostics for auth, prover, and Sui RPC
- structured audit logging
- end-to-end regression coverage

### Out Of Scope

- net-new product features beyond the MVP

### Implementation Checklist

- Remove any remaining direct API calls from the reference frontend that bypass the browser SDK for user flows.
- Freeze the minimal browser SDK config contract:
  - `appId`
  - `apiOrigin`
  - `hostedAuthOrigin`
  - `redirectUri`
  - optional `suiRpcOrigin`
- Add browser SDK error classes for:
  - auth failure
  - insufficient credits
  - sponsorship failure
  - transaction verification failure
- Add integration examples for a developer-owned frontend app.
- Tighten DTO schemas and API response contracts.
- Add structured audit logging for key setup and execution events.
- Add health diagnostics for:
  - Google auth configuration
  - prover availability
  - Sui RPC availability
- Write the manual walkthrough required by `MVP_SPEC.md`.
- Add end-to-end and regression coverage across all slices.

### Deliverables

- public browser SDK integration proof
- finalized walkthrough
- hardened API contracts
- regression suite for the full MVP path

### Acceptance Criteria

- the reference frontend consumes only the public browser SDK for user flows
- the walkthrough can take an operator from empty database to successful `say_hello`
- the browser SDK public config contract is documented and stable
- the regression suite covers setup, sign-in, purchase, execution, and feed retrieval
- the full MVP path is reproducible without undocumented manual steps

### Verification

- Playwright end-to-end tests for the main flow
- API integration tests against Postgres
- manual smoke test from a clean database and fresh app setup

### Status Note

- `FS-05` is implemented in the repo.
- The manual operator path is documented in [MVP_WALKTHROUGH.md](./MVP_WALKTHROUGH.md).
- A developer-owned Next.js consumer example is documented in [../examples/nextjs-sdk-consumer.md](../examples/nextjs-sdk-consumer.md).

## Global Definition Of Done

The full fresh-start implementation is complete only when:

- all eight work orders are complete, including `FS-04.1`
- a brand new app can be created in Celeris
- the developer dashboard lives on the app origin while the reference consumer app lives on the demo origin
- the developer dashboard signs in through shared auth as a reserved first-party client identity
- the sponsor wallet can be provisioned and funded
- the Sui program can be manually published, initialized, and registered
- a frontend app consumes the browser SDK for user flows
- a user can sign in with real Google + zkLogin
- a user can buy credits
- a user can execute the registered paid `say_hello` reference action through the generic action path
- the app-wide transaction feed shows the result with an Explorer link
- `npm run typecheck` passes
- `npm test` passes
- the manual walkthrough has been executed successfully from a clean database
