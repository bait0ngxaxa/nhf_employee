# Leave module migration

Status: Phase E1 — Leave server/business ownership migrated. Dashboard and
LIFF presentation remain transitional and are planned for Phase E2.

Leave server-side business behavior is now owned by `modules/leave/`. The
migration preserves the existing delivery boundaries while moving the rules,
use cases, validation contracts, and Leave-specific technical composition
behind a deliberate module API.

## Ownership boundary

The intended server dependency direction is:

```text
app/api/leave/** and app/api/line/leave/**
    -> @/modules/leave
    -> Leave domain/application/infrastructure
    -> generic platform infrastructure and Prisma
```

`modules/leave/index.ts` is the supported server/application entry point.
External server consumers must use that entry point; module internals such as
Prisma selects, transaction-only helpers, workbook implementation details, and
private validation helpers are not public contracts.

The module also has `modules/leave/client.ts`. It is a client-safe transitional
contract for existing Dashboard/LIFF consumers while their presentation
ownership is migrated in Phase E2. It does not export database, filesystem,
email, LINE transport, or server application implementation.

## Actual module shape

```text
modules/leave/
├── domain/
│   ├── action-availability.ts
│   ├── approval-action-version.ts
│   ├── approver-eligibility.ts
│   ├── business-date.ts
│   ├── constants.ts
│   ├── half-days.ts
│   ├── over-quota.ts
│   ├── quota-accounting.ts
│   ├── quota-entitlement.ts
│   ├── quota-year.ts
│   └── utils.ts
├── application/
│   ├── approvals/
│   ├── cancellation/
│   ├── notifications/
│   ├── queries/
│   ├── requests/
│   └── recovery.ts
├── infrastructure/
│   ├── attachments/
│   ├── notifications/
│   ├── persistence/
│   └── reports/
├── schemas/
├── server/
├── presentation/types.ts
├── client.ts
└── index.ts
```

The domain layer owns Leave-year and business-date calculations, half-day
arithmetic, quota/carry accounting, over-quota calculations, action
availability, approver eligibility, approval-action versions, and related
state policies. The application layer owns request creation and idempotency,
approvals and reassignment, cancellation and not-taken flows, participant and
profile queries, admin recovery, report orchestration, audit metadata, and
notification event creation.

The schemas are the single authoritative implementation for Leave request,
approval, cancellation, attachment, and report contracts. The server layer
contains HTTP parsing and response serialization for the existing route
families. No public URL, request body, response shape, status mapping, or Thai
message changed.

## Attachments

Leave owns the attachment-specific storage orchestration and metadata boundary
under `infrastructure/attachments/`. Generic filesystem primitives remain a
platform concern inside that adapter. The module continues to enforce
authentication, participant/admin authorization, private-file responses,
safe request IDs and storage keys, image type/size/count/pixel constraints,
rollback cleanup, orphan cleanup, and redacted error responses. Routes never
return absolute paths or storage keys.

## Reports and exports

Leave owns report scope validation, report query orchestration, row shaping,
metadata, and workbook generation under `infrastructure/reports/`. The export
route remains a thin delivery adapter and keeps its existing authorization,
limits, response formats, audit behavior, and URL.

## Notifications and outbox

Leave owns notification event meaning, recipient and current-action semantics,
dedupe/event identities, Leave links, payload parsing, email/Flex composition,
and Leave-specific LINE outbox composition. Generic email transport
(`lib/email/transport.ts`), LINE delivery, notification persistence/audit
infrastructure, and the global outbox processor remain platform-owned.

The flow remains:

```text
Leave application
    -> creates/enqueues Leave notification intent
    -> global outbox processor
    -> generic in-app/email/LINE delivery
```

No file under `modules/leave/` imports or executes the global outbox processor.
The processor consumes Leave contracts through `@/modules/leave`; it does not
contain Leave business policy.

## Transitional compatibility

The following facades intentionally remain until Phase E2/E3 removes their
legacy consumers. They contain no independent Leave business logic:

- `constants/leave.ts`, `lib/types/leave.ts`, the three Leave validation
  files, and `lib/ssot/leave-attachments.ts` forward client/schema contracts to
  `@/modules/leave/client`;
- the moved `lib/services/leave/*.ts`, `lib/server/leave-*.ts`,
  `lib/server/leave-api.ts`, `lib/uploads/leave.ts`, Leave email template,
  LINE Flex, and Leave-link paths forward to `@/modules/leave` (or its
  client-safe entry where appropriate); and
- `lib/services/leave/audit-details.ts`,
  `lib/services/leave/create-request-audit.ts`, and
  `lib/services/leave/transaction.ts` are narrow internal compatibility
  facades for existing transitional consumers. The architecture checker
  allowlists only these exact paths; new consumers must use the public API.

The remaining `lib/services/leave/client.ts` and legacy presentation locations
are client/delivery compatibility work deferred to Phase E2. No new Leave
business logic should be added to those locations.

## Preserved invariants

The migration preserves half-day arithmetic, Leave-year boundaries, overlap and
quota accounting, over-quota behavior, approver and exception-approver rules,
approval generations/current-action checks, reassignment behavior,
cancellation-after-approval, not-taken flows, participant authorization,
idempotency keys/hashes, transaction ordering, worker claim safety, attachment
security, report output, notification channels, dedupe semantics, and audit
redaction.

No Prisma schema or database migration was introduced. No API contract, public
route, permission policy, status value, Thai wording, UI/UX, or database
semantic change was introduced in Phase E1.
