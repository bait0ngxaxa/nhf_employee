# Leave module migration

Status: Phase E2 — Leave server/business, Dashboard presentation, and LIFF
presentation ownership migrated. Final compatibility and public API cleanup
remain for Phase E3.

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

The module also has `modules/leave/client.ts`, the supported client-safe entry
point for Leave presentation. It exposes only the route-facing Dashboard and
LIFF roots plus the small client-safe contracts still required by retained
compatibility consumers. It does not export database, filesystem, email, LINE
transport, or server application implementation.

The route-facing exports are `LeaveManagementSection`,
`LeaveManagementSectionSkeleton`, and `LiffLeaveApp`. Presentation components,
hooks, and the Dashboard/LIFF API adapters remain internal to
`modules/leave/presentation/**`.

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
├── presentation/
│   ├── dashboard/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api.ts
│   │   └── Leave* roots and tests
│   ├── liff/
│   │   ├── api.ts
│   │   ├── leave-format.ts
│   │   └── LiffLeave* components and tests
│   └── types.ts
├── client.ts
└── index.ts
```

`app/dashboard/leave/page.tsx` and its loading boundary compose the module
through `@/modules/leave/client`. The page retains metadata, feature gating,
query parsing, the five existing `leaveTab` values (`my-leave`, `approvals`,
`recovery`, `reports`, and `approver-settings`), and the existing Suspense
fallback. `LeaveManagementSection` owns the Leave-specific tab composition
under `presentation/dashboard/` while continuing to consume shared dashboard
context and generic Section UI.

`app/liff/leave/page.tsx` composes `LiffLeaveApp` through the same client entry.
All Leave LIFF state, deep-link handling, mutations, pagination, session
recovery usage, and attachment presentation now live under
`presentation/liff/`. The Leave LIFF API adapter is `presentation/liff/api.ts`;
generic LIFF session recovery and API infrastructure remain platform-owned.

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

The former Leave presentation ownership paths and the generic
`lib/client/liff-leave.ts` adapter were deleted after all application consumers
were migrated. There is no duplicate Dashboard or LIFF implementation under
`components/`, `hooks/`, or `lib/client/`.

The following narrow, behavior-free facades remain because external unit or
integration tests still import these historical contracts:

- `lib/validations/leave.ts`;
- `lib/ssot/leave-attachments.ts`; and
- the client-safe domain/query facades under `lib/services/leave/` for
  business-date, half-day, quota, history-filter, action-availability, and
  utility contracts.

Each forwards directly to an explicit export from `@/modules/leave/client` and
contains no Leave behavior. They are tracked for final removal or minimization
in E3. The remaining server/delivery facades under `lib/services/leave/`,
`lib/server/leave-api.ts`, `lib/server/leave-request-api.ts`,
`lib/server/leave-not-taken-api.ts`, and `lib/line/leave-links.ts` continue to
forward through `@/modules/leave` as established by E1.

The architecture checker now rejects Leave route or migrated presentation
imports from the deleted ownership paths, requires route composition through
`@/modules/leave/client`, rejects module-internal imports through that public
barrel, and checks the runtime client graph for server-only dependencies.

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
semantic change was introduced in Phase E2. Phase E3 has not started; it is
reserved for final facade removal/public API minimization, cross-layer cleanup,
and the full dependency re-audit.
