# NHF Employee modular monolith

Status: Phase E1 — Leave server/business Module Migration.

This document separates the repository's observed current state from the
target architecture. Stock server/business ownership is now migrated into
`modules/stock/`; its Dashboard and client presentation now live in the same
module behind separate server and client public entry points. See
[stock-migration.md](./stock-migration.md) for the migration status and
transitional dependencies.

Routine server/business and Dashboard/LIFF presentation ownership is now also
migrated into `modules/routine/`. See
[routine-migration.md](./routine-migration.md) for its public contracts and
transitional platform dependencies.

Leave server/business ownership is now migrated into `modules/leave/`. Its
Dashboard and LIFF presentation remain transitional for Phase E2. See
[leave-migration.md](./leave-migration.md) for the ownership boundary, public
server API, attachment boundary, and compatibility ledger.

## Why a modular monolith

NHF Employee is gaining business capabilities while remaining one product. A
modular monolith gives each capability a clear ownership boundary while
keeping deployment and operations simple. It makes incremental feature
migration possible without requiring a distributed-system boundary before the
business boundaries are stable.

## Why not microservices

The target remains one Next.js application, one deployment/runtime boundary,
and the existing Prisma/database infrastructure. This phase does not introduce
separate repositories, databases, services, queues, brokers, or network calls
between features. A module boundary is a source-code ownership and dependency
boundary, not a process boundary.

## Current architecture

The repository currently has a single Next.js application with responsibilities
distributed across locations such as:

- `app/` for routes, pages, and other Next.js delivery concerns;
- `components/`, `hooks/`, and `types/` for UI and client-facing artifacts;
- `lib/` for shared infrastructure and feature services, including legacy
  Stock, Routine, Leave, Employee, authentication, notification, and upload
  code;
- `prisma/` for the single schema and its migrations; and
- `__tests__/` for the existing unit, integration, API, and component tests.

At the Phase E1 baseline, `modules/stock/` and `modules/routine/` own their
server/business and client-facing presentation code behind separate public
entry points, while `modules/leave/` owns Leave server/business behavior and
exposes a client-safe transitional contract. Leave Dashboard and LIFF
presentation, and Employee feature code, remain in their current locations.
The Dashboard uses route-per-module App Router pages;
historical
`/dashboard?tab=...` links remain inbound-compatible through the dashboard home
route boundary.

## Target architecture

The intended high-level dependency direction is:

```mermaid
flow LR
    APP[app/**\nNext.js delivery layer]
    MODULES[modules/**\nfeature ownership]
    SHARED[shared/**\ncross-domain platform]

    APP --> MODULES
    APP --> SHARED
    MODULES --> SHARED
    MODULES -.->|public API only| MODULES
```

`app/` owns routing and framework delivery. `modules/` owns business feature
behavior. `shared/` owns only genuinely cross-domain/platform capabilities.
Cross-module use is deliberate and goes through the target module's public
entry point: `modules/<feature>/index.ts` for server/application code or the
explicit `modules/<feature>/client.ts` entry for client presentation.

The dependency graph describes new architecture code. It does not claim that
the legacy `lib/`, `components/`, or route structure has already been
reorganized.

## Ownership principle

Code belongs with the business capability whose rules determine its behavior.
If a change is required because Routine, Leave, Stock, or another feature's
business rules changed, that code is feature-owned even when several screens
use it. Shared placement is justified by stable platform responsibility, not
by reuse alone.

## Incremental migration strategy

Future migrations should be vertical and behavior-preserving:

1. Identify one feature's current routes, UI, services, validations, tests,
   and persistence dependencies.
2. Define the feature's public contract and choose a proportional module
   shape.
3. Move or wrap one coherent slice at a time, keeping existing URLs, API
   contracts, permissions, database behavior, and integrations unchanged.
4. Update delivery code to consume the module public API.
5. Verify the feature before removing the now-obsolete legacy path.

Legacy and migrated modules may coexist during this process. Migration is
explicit and feature-by-feature; Stock was the Phase B pilot, Routine is the
Phase D migration, and Leave server/business is the Phase E1 migration.
Employee and Leave presentation remain out of scope for the next migration
steps.

## Invariants for this phase

The following remain outside the scope of the route migration:

- business behavior, API contracts, visual UI behavior, and navigation wording;
- API URLs and historical dashboard query-tab URLs remain behavior-preserving
  compatibility constraints; canonical Dashboard page paths are now explicit;
- authentication, authorization, permissions, and LIFF behavior;
- the Prisma schema, migrations, and database layout; and
- cron, notifications, email, LINE, uploads, and Employee runtime behavior;
  Leave runtime behavior remains unchanged by its ownership migration. Stock
  and Routine runtime behavior remain unchanged by their ownership migrations.

Detailed boundary and import rules are in
[module-boundaries.md](./module-boundaries.md) and
[dependency-rules.md](./dependency-rules.md).
