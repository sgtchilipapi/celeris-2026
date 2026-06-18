# Public NPM Publish Plan

This document tracks the decisions and execution plan required to publish the Celeris SDK as a public npm package.

## Objective

Make the Celeris browser SDK installable by external app developers with a normal npm workflow:

```bash
npm install @celeris/sdk-browser
```

The package must work outside this monorepo, expose only intentional public APIs, ship compiled JavaScript and TypeScript declarations, and have enough documentation for a developer-owned frontend to integrate Celeris auth, credits, checkout, and sponsored actions.

## Current State

- `@celeris/sdk-browser` is a private npm workspace package.
- The demo app imports `@celeris/sdk-browser`, but npm resolves it as a local workspace symlink.
- The package manifest points to `src/index.ts`, not compiled `dist` output.
- A dry-run pack currently includes source, tests, and config files, but not `dist`.
- The browser SDK depends on `@celeris/shared`, which is also private and source-exported.

## Decision Log

### D1: Package Shape

Status: Decided

Question: Should public developers install one package or multiple Celeris packages?

Options:

- Single public browser SDK package: publish `@celeris/sdk-browser` and keep `@celeris/shared` internal by bundling or moving browser-needed shared code into the SDK.
- Multiple public packages: publish both `@celeris/sdk-browser` and `@celeris/shared`.
- Rename to a single primary package: publish a package like `@celeris/sdk` and treat browser/server entrypoints as subpaths later.

Decision: Publish a single public browser SDK package, `@celeris/sdk-browser`.

Rationale:

- External developers get one package to install.
- The public install path matches the demo app's intended public import, `@celeris/sdk-browser`.
- Internal schemas, env helpers, and server-adjacent utilities stay out of the public contract.
- A future `@celeris/sdk-server` can follow the same pattern without requiring developers to install `@celeris/shared`.

### D2: Public API Surface

Status: Decided

Question: Which exports should be supported as public API for the first npm release?

Options:

- Minimal client API: export only the client factory, config/options types, and SDK error classes. Consumers rely on inferred return types or define local UI types.
- Client API plus consumer domain types: export the client factory, config/options types, SDK error classes, and the response/domain types that app developers naturally store in UI state.
- Broad internal API: export schemas, transaction builders, constants, and other helpers from the current shared package.

Decision: Use "client API plus consumer domain types" for the first public release.

Proposed public exports:

- `createCelerisBrowserClient`
- `CelerisBrowserSdkError`
- `CelerisAuthError`
- `CelerisInsufficientCreditsError`
- `CelerisSponsorshipError`
- `CelerisTransactionVerificationError`
- `CelerisBrowserClientConfig`
- `StartLoginOptions`
- `StartCheckoutOptions`
- `AuthSession`
- `AppCatalog`
- `AppBalance`
- `AppTransactionRecord`
- `CheckoutSession`

Proposed private/internal APIs:

- Zod schemas
- storage key names
- API route construction helpers
- `buildHelloCelerisSayHelloTransaction`
- Move/Sui implementation constants like `CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO`
- shared env parsing helpers

Rationale: App developers need stable client methods and enough types to model UI state. They should not need to import Celeris validation schemas, storage internals, or transaction construction internals for the first managed-action SDK.

### D3: Shared Code Strategy

Status: Decided

Question: How should `@celeris/sdk-browser` handle its current dependency on `@celeris/shared`?

Decision: Bundle the browser-needed `@celeris/shared` code into `@celeris/sdk-browser` for the first public release. Do not require external developers to install `@celeris/shared`.

Rationale:

- `npm install @celeris/sdk-browser` should be enough for a Hello Celeris app.
- `@celeris/shared` remains an internal code-sharing package, not a public compatibility promise.
- A future `@celeris/sdk-server` can also bundle the internal shared code it needs.
- The SDK package can continue using shared code internally during monorepo development, while the published artifact is self-contained from a Celeris-package perspective.

### D4: Build and Module Format

Status: Decided

Question: Should the package ship ESM only, CommonJS only, or dual ESM/CommonJS?

Decision: Ship ESM only plus `.d.ts` declarations for the first browser SDK release.

Target output:

```text
dist/index.js
dist/index.d.ts
```

Target package shape:

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./package.json": "./package.json"
  }
}
```

Rationale: The SDK is browser-first, and likely consumers are modern TypeScript apps using Next.js, Vite, or similar bundlers. ESM-only output keeps the package simpler and avoids dual-package export complexity until there is a concrete CommonJS requirement.

### D5: Package Metadata and Published Files

Status: Decided

Question: What metadata and file allowlist should the package publish?

Decision: Publish only compiled output and package documentation, with MIT licensing and public scoped package metadata.

Package file allowlist:

```json
{
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

Required metadata:

```json
{
  "description": "Browser SDK for Celeris auth, credits, checkout, and sponsored actions.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<org>/<repo>.git",
    "directory": "packages/sdk-browser"
  },
  "bugs": {
    "url": "https://github.com/<org>/<repo>/issues"
  },
  "homepage": "https://github.com/<org>/<repo>#readme",
  "keywords": [
    "celeris",
    "sdk",
    "browser",
    "sui",
    "zklogin",
    "sponsored-transactions"
  ]
}
```

Do not publish:

- `src`
- `test`
- `tsconfig.json`
- `vitest.config.ts`
- `tsconfig.tsbuildinfo`

Rationale: Public consumers should receive compiled JavaScript, TypeScript declarations, and documentation only. Source, tests, and internal build config are useful in the repository but should not be part of the public package contract.

### D6: Release Versioning

Status: Decided

Question: What version should the first public package use?

Decision: Publish the first public browser SDK as `0.1.0`.

Versioning rules:

- Patch releases fix bugs, docs, and packaging issues.
- Minor releases add backward-compatible client methods, options, or exported types.
- Major releases are reserved for breaking public SDK API changes, likely after the SDK contract is mature enough for a `1.0.0` release.

Rationale: `0.1.0` communicates that the SDK is intended for public use but that the API may still evolve before a stable `1.0.0`.

### D7: Validation Gates

Status: Decided

Question: What checks must pass before publishing?

Decision: Require typecheck, tests, build, dry-run pack inspection, and install-from-tarball smoke testing in a clean fixture app.

Required pre-publish commands:

```bash
npm run typecheck --workspace @celeris/sdk-browser
npm run test --workspace @celeris/sdk-browser
npm run build --workspace @celeris/sdk-browser
npm pack --dry-run --workspace @celeris/sdk-browser
```

Required tarball smoke test:

```bash
npm pack --workspace @celeris/sdk-browser
mkdir /tmp/celeris-sdk-browser-smoke
cd /tmp/celeris-sdk-browser-smoke
npm init -y
npm install /workspaces/celeris-2026/celeris-sdk-browser-0.1.0.tgz
```

The smoke test must verify:

- TypeScript resolves exported SDK types.
- A minimal browser app can import `@celeris/sdk-browser`.
- The app bundles without monorepo aliases or Next.js `transpilePackages`.
- The installed package does not require `@celeris/shared`.
- The tarball contains only the intended publish files.

Rationale: The package must be proven outside the workspace before publication. Dry-run pack inspection catches accidental files, while tarball install testing catches hidden monorepo coupling.

## Execution Plan

The selected release strategy is:

- Publish one public package: `@celeris/sdk-browser`.
- Keep `@celeris/shared` internal.
- Bundle browser-needed shared code into the browser SDK artifact.
- Export the client factory, SDK errors, config/options types, and consumer-facing response/domain types.
- Publish ESM-only compiled JavaScript and `.d.ts` declarations.
- License the package as MIT.
- Start public versioning at `0.1.0`.
- Require typecheck, tests, build, dry-run pack inspection, and tarball smoke testing before publishing.

Implementation steps:

1. Add an SDK bundling build, likely with `tsup`, that emits ESM and declarations to `packages/sdk-browser/dist`.
2. Configure the bundler to inline internal `@celeris/shared` code used by the browser SDK.
3. Keep real third-party runtime dependencies external unless bundling them is intentionally chosen.
4. Update `packages/sdk-browser/package.json`:
   - remove `private`
   - set `version` to `0.1.0`
   - set `type` to `module`
   - point `main`, `types`, and `exports` at `dist`
   - add `files`, `publishConfig`, `description`, `license`, repository metadata, bugs URL, homepage, and keywords
5. Add `packages/sdk-browser/README.md` with install, configuration, auth callback, checkout, and Hello Celeris usage.
6. Add an MIT `LICENSE` file where npm will include it in the SDK package.
7. Update SDK exports to match the D2 public API decision.
8. Ensure the published declaration files do not expose private `@celeris/shared` imports.
9. Add or update package scripts for clean, build, prepack, and pack inspection.
10. Run the required pre-publish commands.
11. Run the tarball smoke test from `/tmp`.
12. Publish with:

```bash
npm publish --access public --workspace @celeris/sdk-browser
```

13. Verify the published package with:

```bash
npm view @celeris/sdk-browser
npm install @celeris/sdk-browser
```

14. Update integration docs to assume public installation instead of workspace resolution.
