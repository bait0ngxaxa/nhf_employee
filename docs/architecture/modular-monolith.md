# NHF Employee modular monolith

Status: Phase A — Architecture Baseline & Guardrails.

This document separates the repository's observed current state from the
target architecture. No business feature has been migrated as part of Phase A.

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

At the Phase A baseline, `modules/` and `shared/` are foundations for future
work. Existing feature code remains in its current locations and existing
routes continue to use their current services and database adapters.

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
entry point, normally `modules/<feature>/index.ts`.

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
explicit and feature-by-feature; Phase A does not perform the first feature
migration.

## Invariants for this phase

The following remain outside the scope of the architecture scaffolding:

- business behavior, API contracts, UI behavior, URLs, and navigation;
- authentication, authorization, permissions, and LIFF behavior;
- the Prisma schema, migrations, and database layout; and
- cron, notifications, email, LINE, uploads, Stock, Routine, Leave, and
  Employee runtime behavior.

Detailed boundary and import rules are in
[module-boundaries.md](./module-boundaries.md) and
[dependency-rules.md](./dependency-rules.md).
