# Stock pilot migration

Status: Phase B — server/business ownership migrated.

Stock is the first feature migrated onto the modular-monolith foundation. Its
server-side business behavior, application orchestration, Stock validation,
Prisma-facing persistence, request/inventory workflows, default-variant
maintenance, notifications orchestration, and Stock report/workbook adapters
are owned by `modules/stock/`.

The delivery boundary remains unchanged:

```text
app/api/stock/** and app/api/line/stock/**
    -> @/modules/stock
    -> application/domain/infrastructure internals
    -> existing platform infrastructure and Prisma
```

`modules/stock/index.ts` is the only supported external server entry point.
It exposes Stock use cases, API schemas, command adapters, report responses,
notification dispatch contracts, and the maintenance/audit contracts required
by existing server consumers. Prisma repositories, workbook implementations,
and other internal helpers are not exported as public implementation details.

The migration intentionally leaves the Dashboard, Stock React components,
browser API helpers, and client-facing Stock types in their legacy locations
until Phase C. `lib/validations/stock.ts` is now a type-only compatibility
facade for that deferred client layer; runtime schemas live in the module.

Existing generic platform infrastructure also remains transitional where it is
still the correct owner, including audit persistence, notification/email/LINE
delivery adapters, Prisma access, and outbox processing. These adapters now
consume the Stock public API and do not duplicate Stock business rules.

No Prisma schema or migration changes are part of Phase B. API URLs, payloads,
status mappings, Thai wording, permissions, transaction boundaries, inventory
invariants, default-variant safety behavior, and report output remain
behavior-preserving migration constraints.
