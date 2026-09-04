# Stock pilot migration

Status: Phase C — server/business and Dashboard/client ownership migrated.

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

Stock Dashboard React components, browser API helpers, and client-facing Stock
types now live under modules/stock/presentation/. The module exposes them
through the explicit @/modules/stock/client entry point; its server barrel
remains @/modules/stock. lib/validations/stock.ts remains a type-only
compatibility facade where legacy client types still need it.

Existing generic platform infrastructure also remains transitional where it is
still the correct owner, including audit persistence, notification/email/LINE
delivery adapters, Prisma access, and outbox processing. These adapters now
consume the Stock public API and do not duplicate Stock business rules.

No Prisma schema or migration changes are part of Phase C. API URLs, payloads,
status mappings, Thai wording, permissions, transaction boundaries, inventory
invariants, default-variant safety behavior, and report output remain
behavior-preserving migration constraints.
