# Celeris

Celeris is an authentication service for credit-based Sui dApps. It lets users sign in with Google + zkLogin, buy app credits, and execute approved onchain actions without managing a wallet or gas.

The reference demo proves one path end to end: a developer creates a Celeris app, configures a Sui testnet program, registers a paid `say_hello` action, and a user spends credits to submit a sponsored transaction.

## What Is Included

- `apps/web` - Next.js surfaces for the landing page, developer dashboard, hosted auth, checkout, and demo app.
- `apps/api` - Express API for auth, developer setup, app config, credits, sponsorship, and transaction records.
- `packages/sdk-browser` - Browser SDK used by app frontends to authenticate users and request sponsored actions.
- `packages/sdk-server` - Server SDK placeholder package.
- `packages/shared` - Shared schemas, env parsing, constants, and Sui helpers.
- `packages/db` - Prisma schema, migrations, and database client.
- `sui/hello-celeris` - Move package with the reference `initialize_app` and `say_hello` flow.
- `docs/fresh-start` - MVP spec, walkthroughs, and implementation notes.

## Demo Flow

1. Developer signs in through hosted Google + zkLogin auth.
2. Developer creates an app and provisions a sponsor wallet.
3. Developer publishes/registers the Sui testnet package.
4. Developer configures a metered action, such as `say_hello`.
5. User signs into the demo app through Celeris.
6. User buys credits and executes the sponsored action.
7. Celeris records the transaction and links to Sui Explorer.

## Run Locally

```sh
npm install
cp .env.example .env.local
cp .env.demo.example .env.demo
npm run dev:all
```

`dev:all` starts local Postgres, applies Prisma migrations, then runs the API, web app, and Cloudflare tunnel helper.

For only the app stack:

```sh
npm run dev
```

The local defaults are:

- Web: `http://localhost:3101`
- API: `http://localhost:4100`
- Postgres: `postgresql://celeris:celeris@127.0.0.1:5432/celeris?schema=public`

Google OAuth and zkLogin prover env vars must be set for real hosted auth. The prover can be started with:

```sh
npm run zklogin:prover
```

## Scripts

- `npm run build` - build all workspaces.
- `npm run typecheck` - run TypeScript checks.
- `npm test` - run shared, SDK, API, and web tests.
- `npm run prisma:generate` - generate Prisma client.
- `npm run prisma:migrate` - run Prisma migrations.
- `npm run sui:move:build` - build the Move package.
- `npm run sui:move:test` - test the Move package.

## Notes

- Target chain: `sui:testnet`.
- Hosted auth: Google OAuth + zkLogin.
- Public surfaces: `app.celeris.pro`, `demo.celeris.pro`, `auth.celeris.pro`, `api.celeris.pro`.
- Manual demo guide: `docs/fresh-start/DEMO_WALKTHROUGH.md`.
- Full MVP spec: `docs/fresh-start/MVP_SPEC.md`.
