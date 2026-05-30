# celeris-2026

Fresh-start monorepo bootstrap for the Celeris MVP.

## Workspace Scripts

- `npm run dev` starts the API and Next.js app together
- `npm run build` builds every workspace
- `npm run typecheck` runs TypeScript checks across the monorepo
- `npm test` runs shared, API, and frontend smoke tests
- `npm run prisma:generate` generates the Prisma client
- `npm run prisma:migrate` runs `prisma migrate dev` from `packages/db`
