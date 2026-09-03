# Dependency rules and enforcement

Status: Phase A baseline. These rules govern new architecture code while
legacy code remains compatible during incremental migration.

## Direction

The intended dependency direction is:

```text
app/** -> modules/** -> shared/**
     \-> shared/**
```

Allowed dependencies:

- `app/**` may consume a module's public API and shared platform capabilities.
- `modules/**` may consume shared platform capabilities.
- Module A may consume Module B's public API at `modules/<b>/index.ts`.
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

// The same violation written with a relative path
import { something } from "../../stock/infrastructure/repository";
```

Feature internals are private by ownership even when TypeScript can resolve the
path. Use the target module root public entry point instead.

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

## Automated enforcement

Phase A intentionally limits automation to the new roots:

| Check | Scope | Behavior |
| --- | --- | --- |
| ESLint `no-restricted-imports` | `shared/**/*.{js,jsx,ts,tsx}` | Rejects imports from `modules/` so a shared capability cannot acquire a business dependency |
| `npm run architecture:check` | Source files under `modules/` and `shared/` | Uses the installed TypeScript parser to inspect imports, re-exports, type imports, dynamic imports, and `require()` calls; rejects `shared -> modules` and cross-module deep imports, including relative paths |
| Client/server policy | Legacy and new code | Documentation-led in Phase A; no broad rule is added that would require unrelated migration |
| Route-level Prisma policy | Legacy and new code | Documentation-led in Phase A for the existing route exceptions; new module infrastructure remains the intended boundary |

The check is fast and is included at the start of `npm run check`. It does not
scan legacy feature directories for the target violations, because doing so
would turn Phase A into an implicit Stock, Routine, Leave, Employee, or API
migration. Once a feature is migrated, its new module code is covered by the
new-root checks.

## Legacy compatibility

Legacy paths such as `lib/services/*`, `lib/server/*`, `lib/validations/*`,
`components/dashboard/*`, and `app/api/*` may coexist with `modules/` and
`shared/`. Do not add new feature-specific business code to those generic
locations unless the change is a documented compatibility adapter or a
justified exception. Migrations must be incremental, reviewable, and
behavior-preserving.
