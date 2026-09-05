# Module boundaries

Status: Phase E3 policy. Stock and Routine are migrated examples, and the Leave
server/business, Dashboard/LIFF presentation, compatibility cleanup, and
production boundary re-audit are complete.

## What is a module

A module is the code ownership boundary for one business capability. It should
contain the rules, use cases, technical adapters, and feature-facing artifacts
that change together. A module is not merely a page, route folder, database
table, or collection of convenient helpers.

The test is ownership, not reuse:

> If the code changes because a business feature changes, keep it in that
> feature's module.

## Public module API

Each module should expose a deliberate server/application contract from its
root entry point:

```text
modules/<feature>/index.ts
```

Consumers use the public entry point:

```ts
import { something } from "@/modules/stock";
```

Client-facing presentation may use the separate client-safe entry point:

```text
modules/<feature>/client.ts
```

```ts
import { StockSection } from "@/modules/stock/client";
```

Routine follows the same split: server/application consumers use
`@/modules/routine`, while Dashboard and LIFF consumers use
`@/modules/routine/client`.

Leave server/application consumers use `@/modules/leave`. Leave Dashboard and
LIFF route composition use the explicit client-safe entry point
`@/modules/leave/client`; migrated module presentation internals use local
relative contracts.

The root barrel remains server/application-oriented. The client entry point
must export only client-safe presentation contracts.

Files below the module root are internal implementation. Consumers must not
turn paths such as the following into an accidental public API:

```ts
import { something } from "@/modules/stock/application/internal/foo";
```

The public entries should export only contracts that another layer or module
is intended to rely on. Avoid exporting an entire internal tree through broad
barrel files; small explicit entry points are easier to evolve and keep
dependency direction visible. Only the module root and its /client entry are
public; arbitrary subpaths remain private.

## Larger feature shape

A feature with substantial domain rules, workflows, persistence, or external
integrations may evolve toward:

```text
modules/<feature>/
├── domain/
├── application/
├── infrastructure/
├── presentation/
└── index.ts
```

The layers have these responsibilities:

- `domain/`: pure business concepts, policies, invariants, domain errors, and
  calculations. Avoid framework and database dependencies where reasonably
  possible.
- `application/`: cohesive use cases and orchestration such as
  `create-item`, `approve-request`, `generate-routine`, or `complete-task`.
  Prefer use-case cohesion over increasingly large generic buckets such as
  `queries.ts`, `mutations.ts`, `utils.ts`, or `helpers.ts`.
- `infrastructure/`: technical adapters such as Prisma repositories,
  external-service clients, storage integration, and workbook/file
  implementations.
- `presentation/`: feature-facing schemas, components, hooks, API adapters,
  and other artifacts that translate to or from delivery concerns.
- `index.ts`: the supported public module API.

These folders are guidance, not a requirement to add ceremony before the
feature needs it.

## Smaller feature shape

A small feature should remain small:

```text
modules/<feature>/
├── server/
├── components/
├── schemas.ts
└── index.ts
```

Do not create domain, application, infrastructure, and presentation layers
with no distinct responsibility. Complexity should be added when the feature
has a real boundary or use case that benefits from it.

## Cross-module communication

When module A needs module B, module A may consume only B's documented public
API. Prefer a narrow command, query, type, or result contract over reaching
into B's repository, database model, UI component, or internal helper.

```text
module A -> module B/index.ts or module B/client.ts -> module B internals
```

The target module owns the meaning and compatibility of its public contract.
If two modules appear to share a business rule, first determine which module
owns that rule. Move it to `shared/` only when it is truly cross-domain and
platform-level; reuse alone is not enough.

## Shared/platform ownership

Appropriate future `shared/` responsibilities may include authentication and
session infrastructure, database adapters, HTTP/security primitives, audit
infrastructure, notification or LINE delivery, uploads, network concerns, and
generic UI primitives. Phase A establishes ownership guidance but does not move
the existing implementations.

Feature-specific validation, policies, calculations, status semantics,
workflow orchestration, and feature UI remain feature-owned. For example, code
whose behavior changes with Routine rules belongs to Routine, even if multiple
Routine screens use it.

## Correct and incorrect placement

| Concern | Preferred owner | Avoid |
| --- | --- | --- |
| Approving a leave request | Leave application/domain | A generic global service or shared helper |
| Stock inventory invariant | Stock domain/application | `shared/` because two Stock screens use it |
| Prisma client adapter | Shared/platform infrastructure or a feature infrastructure layer | Direct Prisma handling in a new client component |
| Generic request parsing/security primitive | `shared/http` or `shared/security` | Copying it into every feature |
| Routine-specific schema | Routine module | `lib/validations/` for new Routine code |
| Feature-to-feature call | Target module public API | Importing the target's internal file |

## Legacy coexistence

The current `app/`, `components/`, `hooks/`, `lib/`, and `lib/validations/`
structure remains operational for features that have not migrated. Existing
imports are not rewritten merely to make the target diagram look complete. A
migration must preserve behavior unless a separate change explicitly requests
a behavior change.

Leave is a completed incremental migration: `modules/leave/` owns server,
Dashboard presentation, and LIFF presentation behavior. No Leave compatibility
facades remain. The architecture checker rejects deleted Leave ownership paths,
requires API routes to use `@/modules/leave`, requires Dashboard/LIFF routes to
use `@/modules/leave/client`, and walks production Client Component graphs so a
generic helper cannot transitively import the Leave server entry.
