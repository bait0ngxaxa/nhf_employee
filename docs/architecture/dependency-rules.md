# Dependency rules and enforcement

Status: Phase G2 guardrails extend the Phase A baseline. These rules govern
new architecture code while unrelated legacy features remain compatible during
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

Employee/Leave is a deliberate one-way exception within the general
cross-module rule: Leave may consume the public Employee hierarchy contract
because Employee owns `managerId`. Employee lifecycle code must not import
`@/modules/leave` or `@/modules/leave/**`, even through a facade. Employee
defines `EmployeeOffboardingDependencyProvider` as a structural port instead;
the outer application composition imports both public APIs and passes Leave's
blocker implementation into Employee. That provider must use the exact
`Prisma.TransactionClient` supplied by the Employee serializable lifecycle
transaction.

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
path. External consumers and other modules must use the target module's
deliberate public entry points: `@/modules/<feature>` for server/application
usage or, when the target owns client presentation, `@/modules/<feature>/client`
for client/presentation usage. Arbitrary subpaths remain forbidden. A
server-only module intentionally has no client entry, and a client entry must
not expose server-only implementation, database adapters, or secrets.

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

For Employee F3, Employee API routes must consume `@/modules/employee` and
Employee Dashboard routes must consume `@/modules/employee/client`; neither
may use deleted legacy ownership paths or deep imports. Employee internals may
not self-import the root or client public interface. Production Client
Component graphs may not reach the Employee server interface, and the Employee
client graph may not reach Prisma, database/session/secret code, server-only
Next.js modules, or Employee application/infrastructure code. Active Employee
CSV browser parsing is owned by `modules/employee/presentation/import/csv.ts`.
The checker also rejects deleted Employee compatibility paths, including
relative forms, static/dynamic imports, re-exports, `require()`, and test/mock
imports.

## Department ownership (G1)

`modules/department/index.ts` is the supported server entry for the independent
NHF-wide Department capability. `app/api/departments/route.ts` must consume
`@/modules/department` for `listDepartments()`, and Employee import must consume
the same public entry for `listDepartmentReferences()`. Department application
code must use local contracts and Department infrastructure owns all production
`prisma.department` access.

The architecture checker adds narrow guardrails for this boundary: Department
API routes cannot use Department deep imports or the client entry, production
code outside `modules/department/infrastructure/**` cannot directly access
`prisma.department`, and Department cannot depend on Employee. Tests and Prisma
support code remain legitimate exceptions. The generic public-entry rule also
rejects Department deep imports from other external consumers or modules.

NHF Employee is permanently single-NHF-organization. No Organization domain,
tenant IDs, tenant middleware, organization membership/switching, tenant-scoped
queries, RLS isolation, or organization-scoped uniqueness belongs in this
architecture.

## Department server-only client boundary (G2)

`modules/department/index.ts` is a server-only public API because its runtime
graph reaches Department infrastructure and Prisma. Department has no
`modules/department/client.ts` and no Department-owned browser presentation.
Employee selectors, import UI, and Employee-specific Department formatting stay
Employee-owned and use the existing `GET /api/departments` HTTP contract.

The architecture checker walks production Client Component runtime graphs and
rejects both direct and transitive imports of `@/modules/department`. The
diagnostic points browser code to the existing HTTP/API boundary and does not
suggest a Department client entry. The app Department route and Employee
application import remain valid server consumers; HTTP use of `/api/departments`
or `API_ROUTES.employees.departments` is not a module dependency.

## Automated enforcement

Phase A limits automation by import target rather than by importer location.
The checker scans repository source files so external consumers cannot bypass
the module boundary from a legacy directory, while imports unrelated to
`modules/**` remain outside its scope:

| Check | Scope | Behavior |
| --- | --- | --- |
| ESLint `no-restricted-imports` | `shared/**/*.{js,jsx,ts,tsx}` | Rejects imports from `modules/` so a shared capability cannot acquire a business dependency |
| `npm run architecture:check` | Repository source files, excluding dependency, build, coverage, and generated directories | Uses the installed TypeScript parser to inspect imports, re-exports, type imports, dynamic imports, and `require()` calls; allows `@/modules/<feature>` and, when present, `@/modules/<feature>/client` as module public entries; rejects `shared -> modules`, external consumers deep-importing module internals, cross-module deep imports, including relative paths, and any business module importing the global Outbox Processor |
| Leave route ownership | `app/api/leave/**`, `app/api/line/leave/**` | Requires the server entry `@/modules/leave` and rejects legacy paths, the client entry, and deep implementation imports |
| Leave presentation ownership | `app/dashboard/leave/**`, `app/liff/leave/**`, `modules/leave/**` | Requires route composition through `@/modules/leave/client`, rejects deleted legacy presentation paths, and rejects Leave internals importing either public barrel |
| Client/server policy | Production `"use client"` dependency graphs and migrated module client entries | Walks runtime imports transitively, rejects client-reachable use of the Leave, Employee, and server-only Department entries, and separately rejects server-only runtime dependencies reachable from `@/modules/leave/client` and `@/modules/employee/client`; type-only imports are erased before graph traversal |
| Route-level Prisma policy | Legacy and new code | Documentation-led for unrelated legacy routes; G1 enforces Department ownership in `modules/department/infrastructure/**` |
| Employee F3 ownership | `app/api/employees/**`, `app/dashboard/employees/**`, `modules/employee/**`, production Client Component graphs | Requires `@/modules/employee` for API routes and `@/modules/employee/client` for the four Employee Dashboard routes; rejects deleted legacy compatibility paths and deep presentation paths, including relative forms, deep/self-barrel imports, Employee → Leave imports, client-to-server reachability, and server-only dependencies from the Employee client graph |
| Employee/Leave offboarding seam | `modules/employee/**` plus Employee route composition | Employee exposes only a structural blocker-provider port; the outer composition binds Leave's implementation and must preserve the same Employee lifecycle transaction client |
| Department G1 ownership | `app/api/departments/**`, `modules/department/**`, Employee import, production source | Department API delivery uses `@/modules/department`; Department Prisma access stays in Department infrastructure; Employee uses the Department public query; Department does not depend on Employee |
| Department G2 presentation boundary | Production Client Component runtime graphs and Employee Department presentation | Rejects direct/transitive client imports of the server-only `@/modules/department` entry; preserves the `/api/departments` browser contract and does not require a Department client entry |

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

The Employee validation facade `lib/validations/employee.ts`, mixed legacy
Employee helper/type files, duplicate CSV helper, and confirmed orphan
presentation files were removed after repository-wide production-consumer
audits. Employee API routes consume schemas exported by `@/modules/employee`;
the browser client entry exposes only route composition and the proven pure
Employee display formatter. The architecture checker rejects the deleted
legacy Employee paths to prevent their reintroduction, including relative and
non-static import forms supported by the checker parser. Generic User/Employee
fallback display is owned by the structural browser-safe helper at
`shared/identity/display.ts`; Leave report labels remain Leave-owned.
