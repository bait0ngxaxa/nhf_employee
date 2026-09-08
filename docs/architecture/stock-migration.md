# Stock pilot migration

Status: Phase C — closed for the defined server/business and Dashboard/client
migration scope.

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

Existing generic platform infrastructure also remains where it is still the
correct owner, including audit persistence, generic notification/email/LINE
transport, Prisma access, and outbox processing. Phase C moved Stock
orchestration and business use cases behind the Stock public API, but it did
not relocate every Stock-specific delivery payload from the generic provider
paths.

## Current-state note from K0

The final repository audit records two Stock boundaries that remain for a
future K1 correction and are not evidence that Phase C's defined migration
scope is open:

* Stock LIFF presentation still spans `app/liff/stock/**`,
  `components/liff/stock/**`, `lib/client/liff-stock.ts`, and
  `lib/types/stock-liff.ts` instead of being fully exposed through
  `@/modules/stock/client`.
* Generic provider paths still compose Stock-specific email and LINE meaning,
  including Stock subjects, message IDs, sender names, status/template
  selection, and Flex payloads under `lib/email/**`, `lib/line/**`, and
  related Stock notification adapters. K1 should move that business-specific
  composition behind the Stock boundary while keeping generic transport
  infrastructure platform-owned.

Therefore, the historical Phase C statement that provider adapters “do not
duplicate Stock business rules” is narrowed to the migrated orchestration and
use-case boundary; it does not describe the complete current provider-payload
state. See `docs/architecture/final-repository-audit.md` findings F-1 and F-2.

No Prisma schema or migration changes are part of Phase C. API URLs, payloads,
status mappings, Thai wording, permissions, transaction boundaries, inventory
invariants, default-variant safety behavior, and report output remain
behavior-preserving migration constraints.
