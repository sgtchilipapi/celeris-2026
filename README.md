# celeris-2026

Fresh-start monorepo bootstrap for the Celeris MVP.

## Workspace Scripts

- `npm run dev` starts the API, Next.js app, and `cloudflared` tunnel together
- `npm run dev:all` starts local Postgres, waits for health, applies Prisma migrations, then starts the API, Next.js app, and `cloudflared` tunnel
- `npm run build` builds every workspace
- `npm run typecheck` runs TypeScript checks across the monorepo
- `npm test` runs shared, API, and frontend smoke tests
- `npm run prisma:generate` generates the Prisma client
- `npm run prisma:migrate` runs `prisma migrate dev` from `packages/db`

## FS-01 Developer Setup

- The developer setup console lives at `/setup` in `apps/web`.
- The API now exposes the `FS-01` developer routes for sign-up, sign-in, app creation, sponsor-wallet provisioning, program registration, and `say_hello` pricing.
- API runtime config now also reads:
  - `CELERIS_APP_ENCRYPTION_KEY`
  - `CELERIS_HOSTED_AUTH_ORIGIN`

## Cloudflare Tunnel Dev Routing

- `npm run dev` assumes these public origins:
  - `https://app.celeris.pro`
  - `https://auth.celeris.pro`
  - `https://api.celeris.pro`
- Those map to local services like this:
  - `app.celeris.pro` -> `http://localhost:3101`
  - `auth.celeris.pro` -> `http://localhost:3101`
  - `api.celeris.pro` -> `http://localhost:4100`
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
