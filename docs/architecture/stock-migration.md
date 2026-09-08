# Stock pilot migration

Status: Phase C historical scope closed; Phase K1 Stock ownership boundary
completion closed.

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
Stock outbox dispatch contracts, and the maintenance/audit contracts required
by existing server consumers. Prisma repositories, workbook implementations,
and other internal helpers are not exported as public implementation details.

Stock Dashboard and LIFF React components, browser API helpers, and
client-facing Stock contracts now live under `modules/stock/presentation/` and
`modules/stock/contracts/`. The module exposes the minimum browser composition
through `@/modules/stock/client`; its server barrel remains `@/modules/stock`.
The obsolete `lib/validations/stock.ts` facade was removed after its remaining
production consumers moved to Stock-owned schemas/contracts.

Existing generic platform infrastructure also remains where it is still the
correct owner, including audit persistence, generic notification/email/LINE
transport, Prisma access, and outbox processing. Phase C moved Stock
orchestration and business use cases behind the Stock public API, but it did
not relocate every Stock-specific delivery payload from the generic provider
paths.

## Historical K0 note

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

## Phase K1 closure — current state

K1 closes the three findings recorded by the K0 audit without introducing a
new capability or deployment boundary:

- F-1 CLOSED: `app/liff/stock/page.tsx` composes through
  `@/modules/stock/client`; active LIFF UI, browser API, and neutral contracts
  are owned under `modules/stock/**`.
- F-2 CLOSED: Stock email subjects/templates/Message-ID composition and Stock
  LINE Flex/message composition are owned under
  `modules/stock/infrastructure/notifications/**`. SMTP and LINE provider
  transport remain platform-owned.
- F-3 CLOSED: the shared status badge renders resolved neutral metadata;
  Leave and Stock each own their status presentation maps.

The global Outbox Processor remains shared infrastructure. It delegates
`STOCK_REQUEST_LINE`, `STOCK_LOW_LINE`, `STOCK_REQUEST_RESULT_EMAIL`, and
`STOCK_REQUEST_RESULT_LINE` through `@/modules/stock`; Stock interprets and
composes the payloads while the processor retains claim, retry, stale,
dead-letter, supersede, and final-state lifecycle ownership.

Operational Stock broadcasts still use
`LINE_STOCK_CHANNEL_ACCESS_TOKEN` through the platform Stock-channel transport.
Personal request-result LINE still uses `LINE_APP_CHANNEL_ACCESS_TOKEN`,
`LineAccountLink`, and `sendAppLineNotification`. API URLs, payloads, status
values, Thai wording, permissions, idempotency keys, Message-ID values, and
side-effect ordering remain unchanged.
