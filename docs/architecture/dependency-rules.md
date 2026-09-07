# Dependency rules and enforcement

Status: Phase I3 CLOSED — Audit producer integration and physical AuditLog
persistence exclusivity complete. Audit capability migration I0-I3 is closed;
Auth/Session/Identity remains NOT STARTED. Phase H3 Notification producer integration and
final migration audit remain complete. Phase G3 Department migration remains
complete. These rules govern new architecture code while unrelated legacy
features remain compatible during incremental migration.

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

## Notification and outbox boundary (H0/H1/H2/H3)

The Notification capability is consumed through `@/modules/notification`;
server consumers must not deep-import its repository, Prisma, or presentation
internals. Browser consumers use only `@/modules/notification/client`; its
Dashboard presentation implementation lives under
`modules/notification/presentation/dashboard/**`. The H1 public server
contract is for the user-facing in-app Inbox
and generic persistence to an explicit user. A business producer supplies the
recipient and owns event meaning, semantic type, title/message, action URL,
reference ID, channel selection, and event-specific dedupe/supersede policy.

`NotificationOutbox` and `lib/services/outbox/processor.ts` are global
platform infrastructure, not part of the Notification feature module. Leave,
Stock, Routine, and other business modules may persist/enqueue outbox rows in
their own transactions, but no `modules/**` code may import the global Outbox
Processor. Processor scheduling/wakeup, claim/retry/backoff/dead-letter/stale
recovery, supersede lifecycle, and Email/LINE dispatch composition remain
outside Notification. For business-owned outbox events, the global processor
routes through the producing business module's public dispatch contract. That
module performs domain validation, recipient/semantic resolution, and
stale/defer/supersede decisions before invoking Notification's public command
for an in-app write. If atomic persistence is required, the business dispatch
contract owns the transaction and supplies its transaction-bound persistence
context; the global processor does not pass a transaction client directly to
Notification. A direct processor-to-Notification dispatch is reserved for a
future truly Notification-owned generic event whose payload is already a fully
resolved Notification command; no current production event uses that shape.

The current `lib/services/notifications/in-app.ts` helper is now a minimal
explicit-user compatibility adapter used only by deferred Email Request. It
contains no audience lookup. `createAdminInAppNotificationsOnce` was removed;
Stock owns its active-admin and requester-cancellation admin policies locally.
Do not introduce a generic Notification audience query or migrate Email
Request until the future IT capability boundary is approved. Legacy IT
notification and outbox enum values remain storage-compatible history only.

Notification application commands distinguish strict `createForUser` and
`createForUsers` persistence from idempotent `createForUserOnce`: strict
commands propagate `P2002`, while create-once catches only `P2002`. The
business-driven `markUnreadByReferenceForUser` command accepts only explicit
user/type/reference fields and a transaction context; the business module
still owns when and why a row becomes obsolete.

All production physical `Notification` delegate operations must be owned by
`modules/notification/infrastructure/**`. Tests, integration fixtures, and
Prisma support/schema/seed code remain allowed where appropriate. This rule is
enforced by `scripts/check-architecture.mjs`; `notificationOutbox` is a
separate delegate and is intentionally not matched.

H2 keeps `app/dashboard/notifications/page.tsx` and `loading.tsx` as App Router
composition and requires them to use `@/modules/notification/client`.
`components/dashboard/layout/DashboardNavbar.tsx` remains generic Dashboard
shell ownership and mounts `NotificationDropdown` through that client entry.
The deleted `components/dashboard/notifications/**` path must not be
reintroduced. Notification browser code remains HTTP-based through
`API_ROUTES.notifications.*`; H1 server/application, Prisma, Outbox, Email,
LINE, and business producer ownership remain unchanged after H3. Leave, Stock,
and Routine now consume only `@/modules/notification` for Inbox persistence;
Email Request remains the documented compatibility exception.

## Audit boundary (I1/I2/I3 foundation and enforcement)

`modules/audit/` owns the cohesive generic Audit server/application,
physical persistence, generic queries/retention, and Dashboard presentation.
`shared/` may continue to own neutral database, HTTP/security, and trusted
network primitives. Audit Dashboard routes use the separate browser-safe
`@/modules/audit/client` entry, with implementation under
`modules/audit/presentation/dashboard/**`.

Audit producers retain event meaning, action/entity selection, snapshots,
business metadata, actor semantics, and the choice between a strict
transaction-bound, best-effort, or after-response write. The Audit public
server contract accepts a transaction-bound context for strict callers. It
must not import business module internals or expose
feature-specific commands. Employee, Leave, Stock, and Routine now consume
only `@/modules/audit` for Audit appends and the narrow entity-history query;
their feature-specific detail contracts remain capability-owned. Employee
after-response producers resolve trusted request metadata at the route
boundary. Email Request remains a deferred compatibility consumer and Auth
remains a later producer phase. See audit-migration.md.

The architecture checker enforces that every production AuditLog delegate
operation is under `modules/audit/infrastructure/**`; the historical I1/I2
10-expression/7-file allowlist is removed. Tests, integration fixtures, Prisma
schema/migrations, and narrow test-support files remain non-production
exceptions. It also rejects migrated Employee/Leave/Stock/Routine imports of
`@/lib/server/audit` and the deleted `@/lib/audit-log/contracts` path, while
requiring cross-module consumers to use only the Audit public server entry.
I2's client-entry, deleted-presentation, and server-only graph rules remain
active. Generic admin query, retention, and cleanup behavior remains unchanged.

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
| Client/server policy | Production `"use client"` dependency graphs and migrated module client entries | Walks runtime imports transitively, rejects client-reachable use of the Leave, Employee, Department, and Notification server entries, and separately rejects server-only runtime dependencies reachable from `@/modules/leave/client`, `@/modules/employee/client`, `@/modules/notification/client`, and `@/modules/audit/client`; type-only imports are erased before graph traversal |
| Route-level Prisma policy | Legacy and new code | Documentation-led for unrelated legacy routes; G1 enforces Department ownership in `modules/department/infrastructure/**` |
| Employee F3 ownership | `app/api/employees/**`, `app/dashboard/employees/**`, `modules/employee/**`, production Client Component graphs | Requires `@/modules/employee` for API routes and `@/modules/employee/client` for the four Employee Dashboard routes; rejects deleted legacy compatibility paths and deep presentation paths, including relative forms, deep/self-barrel imports, Employee → Leave imports, client-to-server reachability, and server-only dependencies from the Employee client graph |
| Employee/Leave offboarding seam | `modules/employee/**` plus Employee route composition | Employee exposes only a structural blocker-provider port; the outer composition binds Leave's implementation and must preserve the same Employee lifecycle transaction client |
| Department G1 ownership | `app/api/departments/**`, `modules/department/**`, Employee import, production source | Department API delivery uses `@/modules/department`; Department Prisma access stays in Department infrastructure; Employee uses the Department public query; Department does not depend on Employee |
| Department G2 presentation boundary | Production Client Component runtime graphs and Employee Department presentation | Rejects direct/transitive client imports of the server-only `@/modules/department` entry; preserves the `/api/departments` browser contract and does not require a Department client entry |
| Notification H1-H3 ownership | `app/api/notifications/**`, `app/dashboard/notifications/**`, `components/dashboard/layout/DashboardNavbar.tsx`, `modules/notification/**`, production client graphs, production source | Requires Notification API routes to consume `@/modules/notification`; requires Notification Dashboard routes and DashboardNavbar to consume `@/modules/notification/client`; rejects deleted legacy presentation paths, deep/self-barrel imports, server-only dependencies in the Notification client graph, production client reachability of the Notification server entry, business-module legacy adapter imports, and physical Notification delegate access outside `modules/notification/infrastructure/**`; allows tests/fixtures/support code and does not match `notificationOutbox` |
| Audit I1-I2 ownership | `app/api/audit-logs/**`, `app/dashboard/audit/**`, `modules/audit/**`, production client graphs, production source | Requires Audit API routes to consume `@/modules/audit` and Audit Dashboard routes to consume `@/modules/audit/client`; rejects deleted Audit presentation paths, deep/self-barrel imports, server-only dependencies and other module server entries in the Audit client graph, while preserving the I1 direct-access allowlist |

## Department final closure (G3)

The G3 final audit confirmed that the Department guardrails are sufficient for
the completed migration:

- `app/api/departments/**` uses only the Department public root.
- Production `prisma.department` access is owned by
  `modules/department/infrastructure/**`.
- Department internals cannot import the Department public barrel or Employee;
  external and cross-module consumers cannot deep-import Department internals.
- Production Client Component graphs cannot reach the server-only Department
  entry; browser consumers use `GET /api/departments`.
- Prisma seed/support code, test/integration fixtures, and architecture
  fixtures remain permitted infrastructure exceptions.

No checker change was required in G3. The existing narrow rules cover the
validated direct, transitive, deep-import, self-barrel, and persistence-leak
regression classes without introducing false positives for legitimate support
or test code.

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
