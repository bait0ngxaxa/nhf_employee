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

The root API intentionally groups only route-facing schemas, use cases and
errors, HTTP/response adapters, report and attachment delivery contracts,
notification/outbox dispatch contracts, and the small domain values required
by existing server/platform consumers. It does not re-export query fragments,
Prisma select/include constants, workbook builders, storage factories, raw
templates, or internal notification composition helpers. The small
`getEmployeeIdFromUserId` export remains only for the existing transitional
server/test facade; it is not a general module-internal escape hatch.

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

## Not-taken application ownership

`application/not-taken.ts` owns both not-taken use cases. It contains the
authorization and eligibility decisions, serializable transaction boundaries,
Leave row locking, exception-approver resolution, state transition, quota
restoration and forward reconciliation, notification persistence, and audit
orchestration. The workflow remains atomic across the operations that were
atomic before the extraction.

`server/not-taken-api.ts` is a thin delivery adapter. It reads and validates
the HTTP body, invokes the application use case, maps its typed errors to the
existing HTTP responses, serializes the result, and accepts the route-owned
outbox scheduling callback. The route remains responsible for `after(...)`
and the global `processOutbox()` call; the Leave module does not import the
global processor. This preserves replay behavior and keeps outbox dispatch
outside Leave business ownership.

## Attachments

Leave owns the attachment-specific storage orchestration and metadata boundary
under `infrastructure/attachments/`. Generic filesystem primitives remain a
platform concern inside that adapter. The module continues to enforce
authentication, participant/admin authorization, private-file responses,
safe request IDs and storage keys, image type/size/count/pixel constraints,
rollback cleanup, orphan cleanup, and redacted error responses. Routes never
return absolute paths or storage keys. The public API exposes only the
route-facing `readLeaveAttachment` and cleanup contracts; storage factories and
write/delete implementation details remain private. Storage behavior tests are
colocated under `modules/leave/`, while external API/integration tests mock the
module public contract.

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
- the remaining client-safe compatibility paths (`constants/leave.ts`,
  `lib/types/leave.ts`, `lib/validations/leave*.ts`,
  `lib/ssot/leave-attachments.ts`, and `lib/services/leave/client.ts`) forward
  to `@/modules/leave/client`;
- the remaining server/delivery facades under `lib/services/leave/`,
  `lib/server/leave-api.ts`, `lib/server/leave-request-api.ts`,
  `lib/server/leave-not-taken-api.ts`, and `lib/line/leave-links.ts` forward
  to `@/modules/leave`; and
- no Leave deep-import compatibility exception remains. The former
  `lib/services/leave/audit-details.ts`,
  `lib/services/leave/create-request-audit.ts`, and
  `lib/services/leave/transaction.ts` facades had no remaining consumers
  after the E1 extraction and were removed.

The remaining `lib/services/leave/client.ts` and legacy presentation locations
are client/delivery compatibility work deferred to Phase E2. Retained
server/delivery facades forward through `@/modules/leave` or
`@/modules/leave/client`; they do not deep-import Leave internals. No new
Leave business logic should be added to legacy locations.

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
