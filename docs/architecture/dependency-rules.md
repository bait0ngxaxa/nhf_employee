# Dependency rules and enforcement

Status: Phase E3 guardrails extend the Phase A baseline. These rules govern new
architecture code while unrelated legacy features remain compatible during
incremental migration.

## Direction

The intended dependency direction is:

```text
app/** -> modules/** -> shared/**
     \-> shared/**
```

Allowed dependencies:

- `app/**` may consume a module's public API and shared platform capabilities.
- `modules/**` may consume shared platform capabilities.
- Module A may consume Module B's server/application API at
  `modules/<b>/index.ts`.
- Client-facing presentation may consume Module B's explicit client-safe API
  at `modules/<b>/client.ts`.
- A module may use its own internal files.
- Shared code may depend on other genuinely shared/platform code, but not on a
  business module.

Preferred examples:

```ts
// app -> module public API
import { createRequest } from "@/modules/leave";

// app -> shared platform capability
import { requireApiSession } from "@/shared/auth";

// module -> shared capability
import { audit } from "@/shared/audit";

// module A -> module B public API
import { getItemAvailability } from "@/modules/stock";
```

## Forbidden dependency shapes

The following are architectural violations for new architecture code:

```ts
// shared -> business module
import { getStock } from "@/modules/stock";

// module A -> module B internal implementation
import { something } from "@/modules/stock/application/internal/foo";

// external consumer -> module internal implementation
import { something } from "@/modules/stock/application/create-item";

// The same violation written with a relative path
import { something } from "../../stock/infrastructure/repository";
```

Business-module application code may persist or enqueue outbox records as part
of its transaction, but any `modules/**` code must not import the global Outbox
Processor. Waking or scheduling that processor belongs to the
delivery/composition layer.

Feature internals are private by ownership even when TypeScript can resolve the
path. External consumers and other modules must use exactly one of the target
module's deliberate public entry points: `@/modules/<feature>` for
server/application usage or `@/modules/<feature>/client` for client/presentation
usage. Arbitrary subpaths remain forbidden. The client entry must not expose
server-only implementation, database adapters, or secrets.

## Client/server boundary

Client components must not import server-only implementation, database
adapters, secrets, filesystem code, or server-side application internals. A
client-facing module API must expose a safe presentation contract rather than
leaking server implementation. This rule is currently documentation-led
because the legacy repository does not yet encode one uniform server-only
marker across all existing locations; it must be applied to new modules and
enforced more strongly as each feature migrates.

## Prisma access policy

The migration target for business API routes is:

```text
route handler
    -> feature application/service layer
    -> repository/infrastructure
    -> Prisma
```

New business route handlers should not access Prisma directly. A feature's
`infrastructure/` layer may own a Prisma repository, and platform/auth
infrastructure may require direct database access when that is its actual
responsibility.

Phase A does not rewrite the existing route handlers or move their Prisma
access. The current repository contains legacy route-level database access,
including direct imports of `@/lib/db/prisma` and some `@prisma/client` type or
enum imports. A global prohibition would therefore force unrelated feature
migrations and violate Phase A scope.

Temporary exceptions must be explicit and narrow:

1. Record the exact path or smallest useful path pattern in the compatibility
   ledger below.
2. Record why the exception is platform/auth infrastructure or why the feature
   has not yet migrated, plus an owner and the intended migration phase or
   issue.
3. Keep the exception out of new feature code when a service/repository path is
   available.
4. Do not hide an exception with a blanket ESLint disable. If a lint exception
   is unavoidable, scope it to the smallest declaration and explain it next to
   the ledger entry.

### Temporary compatibility ledger

| Scope | Reason | Owner | Exit target |
| --- | --- | --- | --- |
| Existing `app/api/**` route-level Prisma access | Legacy routes must continue to function during feature-by-feature migration | Application maintainers | The relevant feature migration phase; review when touching the route |
| Existing `lib/db/**` Prisma client and transaction adapters | Current database infrastructure remains the application's platform implementation | Application maintainers | Consolidate only as part of an approved platform/module migration |

This ledger is a migration record, not permission for new unrestricted Prisma
usage. Add a narrower row when a new exceptional platform case is approved.

For the completed Leave E3 migration, Leave API route families must consume
`@/modules/leave`, while Dashboard and LIFF route composition must consume
`@/modules/leave/client`. The architecture checker rejects legacy Leave
ownership imports from `app/api/leave/**`, `app/api/line/leave/**`, and migrated
Leave presentation, including legacy services, server adapters, schemas,
upload orchestration, Leave email templates, LINE composition, Leave links,
constants, types, components, and hooks. All Leave module internals must use
local contracts instead of importing either public barrel.

## Automated enforcement

Phase A limits automation by import target rather than by importer location.
The checker scans repository source files so external consumers cannot bypass
the module boundary from a legacy directory, while imports unrelated to
`modules/**` remain outside its scope:

| Check | Scope | Behavior |
| --- | --- | --- |
| ESLint `no-restricted-imports` | `shared/**/*.{js,jsx,ts,tsx}` | Rejects imports from `modules/` so a shared capability cannot acquire a business dependency |
| `npm run architecture:check` | Repository source files, excluding dependency, build, coverage, and generated directories | Uses the installed TypeScript parser to inspect imports, re-exports, type imports, dynamic imports, and `require()` calls; allows only `@/modules/<feature>` and `@/modules/<feature>/client` as module public entries; rejects `shared -> modules`, external consumers deep-importing module internals, cross-module deep imports, including relative paths, and any business module importing the global Outbox Processor |
| Leave route ownership | `app/api/leave/**`, `app/api/line/leave/**` | Requires the server entry `@/modules/leave` and rejects legacy paths, the client entry, and deep implementation imports |
| Leave presentation ownership | `app/dashboard/leave/**`, `app/liff/leave/**`, `modules/leave/**` | Requires route composition through `@/modules/leave/client`, rejects deleted legacy presentation paths, and rejects Leave internals importing either public barrel |
| Client/server policy | Production `"use client"` dependency graphs and migrated module client entries | Walks runtime imports transitively, rejects client-reachable use of the Leave server entry, and separately rejects server-only runtime dependencies reachable from `@/modules/leave/client`; type-only imports are erased before graph traversal |
| Route-level Prisma policy | Legacy and new code | Documentation-led in Phase A for the existing route exceptions; new module infrastructure remains the intended boundary |

The check is fast and is included at the start of `npm run check`. Scanning
legacy feature directories does not migrate them: the checker only evaluates
imports that resolve into `modules/**`. Existing legacy files without such
imports remain compatible, and migrated module code is covered by the same
owner-aware rules.

## Legacy compatibility

Legacy paths such as `lib/services/*`, `lib/server/*`, `lib/validations/*`,
`components/dashboard/*`, and `app/api/*` may coexist with `modules/` and
`shared/`. Do not add new feature-specific business code to those generic
locations unless the change is a documented compatibility adapter or a
justified exception. Migrations must be incremental, reviewable, and
behavior-preserving.

The closed Leave migration record is maintained in
[leave-migration.md](./leave-migration.md). No Leave compatibility facade or
deep-import exception remains.
