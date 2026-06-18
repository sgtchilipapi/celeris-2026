# celeris-2026

Fresh-start monorepo bootstrap for the Celeris MVP.

## Workspace Scripts

- `npm run dev` starts the API, Next.js app, and `cloudflared` tunnel together
- `npm run dev:all` starts local Postgres, waits for health, applies Prisma migrations, then starts the API, Next.js app, and `cloudflared` tunnel
- `npm run build` builds every workspace
- `npm run typecheck` runs TypeScript checks across the monorepo
- `npm test` runs shared, browser SDK, API, and frontend smoke tests
- `npm run prisma:generate` generates the Prisma client
- `npm run prisma:migrate` runs `prisma migrate dev` from `packages/db`

## MVP Surface Split

- Revised target public origins:
  - `https://app.celeris.pro` = Celeris dashboard/app for developers
  - `https://demo.celeris.pro` = sample third-party SDK consumer app
  - `https://auth.celeris.pro` = shared auth for developer sign-in and user login
  - `https://api.celeris.pro` = backend API
- The dashboard is intended to dogfood the same Google + zkLogin auth contract that Celeris exposes to app consumers.
- The practical shape is one shared auth protocol with a reserved first-party dashboard client identity, not a separate dashboard login system and not a developer-created app record.
- Developer authorization is layered on top of that shared auth flow; it is not intended to remain a separate credential system.
- All three web surfaces stay on one `apps/web` Next.js deployment.
- The developer setup console is anchored to the `app` surface, while the `demo` surface is reserved for the reference SDK consumer app.
- `FS-02` extends the shared auth contract to app-scoped demo consumers through the browser SDK.
- `FS-02.1` is complete: hosted auth now starts real Google OAuth, verifies Google ID tokens server-side, derives zkLogin wallet identity, and includes prover-backed zkLogin session material.

## FS-01 Developer Setup

- The repo now exposes shared-auth dashboard and app-consumer routes for login-request creation, Google OAuth start/callback, token exchange, dashboard session lookup, app creation, sponsor-wallet provisioning, program registration, and `say_hello` pricing.
- The developer dashboard now authenticates as the reserved first-party shared-auth client `developer_dashboard` / `celeris-dashboard`.
- The reference demo app authenticates as an app-scoped consumer client through `app_consumer` / `<appId>`.
- The browser SDK now implements `auth.startLogin`, `auth.handleRedirectCallback`, `auth.getSession`, and `auth.signOut` using session-scoped storage.
- Production hosted auth no longer exposes the mock email identity form. The old login-request completion helper is confined behind an explicit test-only service flag.
- API runtime config now also reads:
  - `CELERIS_APP_ENCRYPTION_KEY`
  - `CELERIS_DEVELOPER_APP_ORIGIN`
  - `CELERIS_DEMO_FRONTEND_ORIGIN`
  - `CELERIS_HOSTED_AUTH_ORIGIN`
  - `CELERIS_GOOGLE_CLIENT_ID`
  - `CELERIS_GOOGLE_CLIENT_SECRET`
  - `CELERIS_GOOGLE_REDIRECT_URI`
  - `CELERIS_GOOGLE_ISSUER`
  - `CELERIS_ZKLOGIN_SALT_SEED`
  - `CELERIS_ZKLOGIN_PROVER_ORIGIN`
  - `CELERIS_ZKLOGIN_MAX_EPOCH_WINDOW`
- Web runtime config now also reads:
  - `NEXT_PUBLIC_DEVELOPER_APP_ORIGIN`
  - `NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN`
  - `NEXT_PUBLIC_HOSTED_AUTH_ORIGIN`
- Reference consumer demo config lives in `.env.demo`:
  - `NEXT_PUBLIC_DEMO_APP_ID` for preconfiguring the reference consumer app
  - `HELLO_CELERIS_PACKAGE_ID`
  - `HELLO_CELERIS_APP_STATE_OBJECT_ID`

## Real Google + zkLogin Auth

- Hosted auth renders a Google sign-in action and redirects through `GET /v1/auth/google/start`.
- Google returns to `CELERIS_GOOGLE_REDIRECT_URI`, which should point at `GET /v1/auth/google/callback` on the API origin.
- The API verifies the Google ID token audience and issuer before resolving `UserIdentity`.
- zkLogin salt is derived from `CELERIS_ZKLOGIN_SALT_SEED`, Google issuer, and Google subject, then used to derive the stable Sui wallet address.
- Browser SDK auth creates zkLogin ephemeral key material in `sessionStorage` only and sends the nonce/public key/max epoch metadata in the login request.
- The API calls `CELERIS_ZKLOGIN_PROVER_ORIGIN` during Google callback and returns the resulting proof inputs in the issued session.
- The zkLogin prover is an external runtime dependency. This repo does not build or run it for you.
- User sign-in now fails closed if the Google OAuth or zkLogin prover env values are missing. There is no implicit in-repo runtime fallback for production-style auth.

## Local Auth Runtime

- Copy `.env.example` to `.env.local` and set the Google OAuth and zkLogin values explicitly.
- Copy `.env.demo.example` to `.env.demo` when running the reference consumer demo locally.
- `CELERIS_GOOGLE_REDIRECT_URI` must point at `GET /v1/auth/google/callback` on the API origin you are actually serving.
- `CELERIS_ZKLOGIN_PROVER_ORIGIN` must point at a reachable prover process before demo user sign-in can complete.
- Tests can still inject mock Google/prover adapters directly, but the runtime API path now requires explicit env configuration.

## Cloudflare Tunnel Dev Routing

- Current repo tunnel/dev scripts still assume these public origins:
  - `https://app.celeris.pro`
  - `https://auth.celeris.pro`
  - `https://api.celeris.pro`
- The clarified target after `FS-01.1` is:
  - `https://app.celeris.pro`
  - `https://demo.celeris.pro`
  - `https://auth.celeris.pro`
  - `https://api.celeris.pro`
- Target local mapping:
  - `app.celeris.pro` -> `http://localhost:3101`
  - `demo.celeris.pro` -> `http://localhost:3101`
  - `auth.celeris.pro` -> `http://localhost:3101`
  - `api.celeris.pro` -> `http://localhost:4100`
- `FS-01.1` expects local env values to keep those three web origins distinct even when they resolve to the same Next.js dev server.
- The repo tunnel helper uses `CLOUDFLARED_TUNNEL_TOKEN` if it is set.
- If that env var is not set, it falls back to the token embedded in the local `/etc/init.d/cloudflared` service install on this machine.

## Local Postgres For `dev:all`

- `npm run dev:all` starts a repo-local Docker Compose Postgres service:
  - host port: `5432` by default
  - db: `celeris`
  - user: `celeris`
  - password: `celeris`
- It exports a default `DATABASE_URL` of:
  - `postgresql://celeris:celeris@127.0.0.1:5432/celeris?schema=public`
- Override with:
  - `POSTGRES_PORT`
  - `POSTGRES_DB`
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `DATABASE_URL`
- By default the script stops the Postgres container when you exit. Set `KEEP_DEV_DB_RUNNING=1` to leave it running.
- Before startup, `npm run dev:all` also clears the previous local deployment by:
  - running `docker compose down` for the repo Postgres service
  - killing listeners on the API and web dev ports
  - killing the repo-started `cloudflared` tunnel process
