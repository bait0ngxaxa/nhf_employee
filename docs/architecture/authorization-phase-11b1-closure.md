# Authorization Phase 11B.1 Closure — Routine Browser Boundary

Status: CLOSED  
Phase: 11B.1 — Routine Browser Boundary & Client-Graph Enforcement  
Baseline commit: `7a0600bfd95f9d343ecd5dede2cb11d3375218c6`  
Repository: `bait0ngxaxa/nhf_employee`  
Date: 2026-09-15

## Scope

Phase 11B.1 hardens the already-established Routine module boundary. Phase
11A recorded `LEGACY_AUTHORIZATION_BYPASS = 0`; this slice does not introduce,
activate, migrate, or reinterpret authorization policy. Phase 11B.2 was not
started.

## Evidence and current graph

The browser public entry is `modules/routine/client.ts`. Its runtime exports
are the Dashboard and LIFF presentation surfaces. The entry also exposes
`RoutinePresentationCapabilities` as a type-only contract.

The production runtime graph was traced transitively from that entry. It
contains 130 reachable source files, including the Routine Dashboard/LIFF
presentation code, browser transport and UI dependencies, Routine schemas,
the pure domain helpers used by the presentation, and the following
intentionally retained pure helper:

`modules/routine/application/imports/sheet-config.ts`

The helper is under `application/` for ownership/history reasons, but its
current runtime implementation is constants and pure workbook-sheet
validation. It has no database, authentication, provider, filesystem, or
server runtime dependency and remains accepted explicitly rather than being
classified by directory name alone.

The graph also legitimately reaches browser-safe public entries such as
`@/modules/employee/client` and `@/modules/line/client`, shared browser/UI
helpers, and client HTTP contracts. Type-only imports, including Prisma and
Routine application contracts, are erased by the checker's transpilation step
and are not runtime graph edges.

## Enforced invariant

The following invariant is now checked by `npm run architecture:check`:

> Runtime dependencies reachable from `@/modules/routine/client` must remain
> browser-safe. Routine Dashboard and LIFF presentation routes must consume
> presentation through `@/modules/routine/client`; Routine internals must use
> local contracts instead of re-entering either public Routine entry.

The checker follows runtime imports transitively and preserves the distinction
between runtime and type-only imports.

## Rejected Routine browser dependencies

The Routine graph rejects:

- the Routine server root/index (`@/modules/routine`);
- Routine application code except the explicit pure `sheet-config.ts` helper;
- `modules/routine/infrastructure/**` and `modules/routine/server/**`;
- `lib/db/**`, `lib/server/**`, `lib/email/**`, `lib/line/**`,
  `lib/services/outbox/**`, `lib/network/public-url`,
  `lib/network/trusted-client-ip`, and `lib/ssot/http`;
- `lib/auth/{api,context,csrf,hybrid/**,rate-limit,server,workforce,
  workforce-transaction}` server/workforce helpers;
- runtime `@prisma/client`, `bcrypt`, `bcryptjs`, `nodemailer`,
  `@line/bot-sdk`, `server-only`, `next/server`, `next/headers`, and
  `next/cache` dependencies;
- Node built-ins.

The guard intentionally uses the current Routine ownership boundaries and
runtime package evidence. It does not ban every package used by server-side
workbook parsing by package name; those paths are protected through their
Routine application/infrastructure ownership boundary.

The route guard covers `app/dashboard/routine/**` and `app/liff/routine/**`.
The current entry/loading files are required to compose through the client
entry, and direct server/deep Routine imports are rejected. No production
Routine import correction was required: the existing Dashboard and LIFF pages
already use `@/modules/routine/client`.

## Tests

Focused architecture regression coverage proves:

1. the current production Routine graph passes;
2. a valid Routine presentation graph preserves pure helpers and type-only
   contracts;
3. direct and transitive Routine server-entry reachability fails;
4. direct Prisma and transitive Prisma/persistence reachability fails;
5. transitive server authentication/workforce reachability fails;
6. Node built-ins and Next/server-only runtime dependencies fail;
7. Dashboard and LIFF route server/deep imports fail;
8. valid route client-entry composition remains allowed;
9. routes without the client composition fail;
10. type-only Prisma/Routine contracts do not produce runtime violations; and
11. Routine internals cannot import `@/modules/routine` or
    `@/modules/routine/client` as their own public barrel.

## Production behavior proof

No production import correction was made. The changes are limited to the
architecture checker, architecture regression tests, and architecture
documentation. Capability registry semantics, grant resolution, compatibility
floors, role/ADMIN behavior, Routine creator/assignee rules, and all other
authorization/business policy remain unchanged.

## Verification

The following checks passed after the change:

- `npm.cmd run architecture:check`
- `npm.cmd run lint:strict`
- `npm.cmd run typecheck`
- `npm.cmd run test:run`
- `npm.cmd run test:run -- __tests__/architecture/check-architecture.test.ts`
- `git diff --check`

The focused architecture test completed with 251 passing tests. On Windows,
`npm.cmd` was used because the PowerShell `npm.ps1` shim is blocked by the
machine execution-policy configuration.

The full suite completed with 2,740 passing tests across 313 test files. The
repository-wide architecture check scanned 1,118 source files successfully.

## Phase 11B.2 handoff

Phase 11B.2 remains deferred and was not implemented. Its scope is limited to:

- trusted actor provenance;
- rejection of request/client-supplied authorization identity;
- central-authorization-before-protected-query regression; and
- intentional role, bootstrap, and compatibility semantic regression tests.

Do not infer any of those changes from this browser-graph closure.
