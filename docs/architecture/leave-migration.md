# Leave module migration

Status: Phase E3 complete — Leave server/business, Dashboard presentation,
LIFF presentation, compatibility cleanup, and production client/server
re-audit are closed from baseline `1b4e49b1`.

Leave server-side business behavior is now owned by `modules/leave/`. The
migration preserves the existing delivery boundaries while moving the rules,
use cases, validation contracts, and Leave-specific technical composition
behind a deliberate module API.

The migration closed incrementally: E1 moved server/business ownership; E2
moved Dashboard and LIFF presentation ownership; corrective commit `1b4e49b1`
closed the audit-display client/server regression found by production build;
and E3 removed compatibility facades, minimized both public interfaces, moved
implementation tests, and added transitive client-graph enforcement.

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

The root interface intentionally groups only route-facing schemas, application
queries/use cases/errors, HTTP/response adapters, report and attachment
delivery contracts, notification/outbox dispatch contracts, and the small
domain contracts used by route/auth/platform composition. It does not expose
Prisma selectors/includes, transaction helpers, raw repositories, workbook
builders, storage factories, raw templates, individual email senders, link
builders, client formatters, or test-only helpers.

The module also has `modules/leave/client.ts`, the supported client-safe entry
point for Leave presentation. It exposes the route-facing Dashboard and LIFF
roots plus the minimum client-safe formatting contract used by generic audit
presentation. It does not export database, filesystem, email, LINE transport,
server application implementation, schemas, query helpers, or domain
calculations merely because they are client-compatible.

The presentation-root exports are `LeaveManagementSection`,
`LeaveManagementSectionSkeleton`, and `LiffLeaveApp`. The legitimate formatter
exports are `formatLeaveDateRange`, `formatLeaveDurationDays`,
`getLeavePeriodLabel`, `getLeaveTypeLabel`, `LeavePeriodValue`, and
`LeaveTypeValue`; `lib/audit-log/display.ts` is their production client-shared
consumer. Presentation components, hooks, schemas, calculations, and the
Dashboard/LIFF API adapters remain internal to `modules/leave/**`.

### Final server interface

`modules/leave/index.ts` exposes three deliberate categories:

- Route contracts: Leave action/ID/cancellation/approver/report schemas;
  request-size validation; decision, cancellation, approval-list,
  approver-assignment, profile/detail/attachment/recovery queries; request and
  not-taken HTTP adapters; LIFF serializers; report response/meta/year
  orchestration; and attachment read/orphan-cleanup operations.
- Platform delivery contracts: current-action dispatch; Leave semantic email,
  LINE, and in-app notification orchestration; payload parsers; and Leave LINE
  outbox enqueue/dispatch.
- Cross-boundary domain contracts: assigned/actionable/history approver query
  predicates used by server auth composition, the current Leave year, employee
  and approver action availability, and half-day-to-response conversion.

No export is retained only for a compatibility facade or unit test. In
particular, raw hash helpers, individual Leave email senders, link builders,
payload types, formatter functions, Prisma details, and storage factories are
not part of the server interface.

### Final client interface

`modules/leave/client.ts` exports exactly the three presentation roots listed
above plus the four audit formatter functions and two formatter value types.
The route roots are `PRESENTATION ROOT` contracts; the formatter surface is a
`LEGITIMATE CLIENT CONTRACT`. No compatibility-only, test-only, or
module-internal export remains.

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

## Post-E2 production-build finding

The E2 ownership migration at `584e8c72` left a transitive client/server
violation: `components/audit/AuditLogViewer.tsx` reached
`lib/audit-log/display.ts`, which imported the server-oriented
`@/modules/leave` entry and pulled the Leave application/server graph into the
client bundle. Corrective baseline `1b4e49b1` changed the audit formatter to
`@/modules/leave/client` and exposed only its client-safe formatter/types.

E3 keeps the existing runtime walk from `modules/leave/client.ts` and adds a
repository client-reachability walk rooted at production files with a
`"use client"` directive. Runtime imports are derived through the TypeScript
parser/transpiler so type-only imports are erased. Any transitive client path
that reaches `@/modules/leave` is rejected, while the equivalent path through
`@/modules/leave/client` is allowed. Regression fixtures cover both cases.

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

Generic `lib/email/index.ts` no longer imports or re-exports Leave-specific
senders, and `emailService` contains no Leave methods. `lib/email/types.ts`
keeps transport-level `EmailData` and Stock compatibility only; Leave payload
types remain in the Leave module. Generic LINE transport remains outside Leave,
while Leave link and Flex composition are module-internal. The global outbox
processor consumes deliberate parse, semantic notification, and LINE dispatch
contracts from the server entry without reconstructing authorization, quota,
approver, or state-transition policy.

## Final compatibility and test ownership

No Leave compatibility facade remains. E3 removed `lib/services/leave/**`,
`lib/server/leave-*`, `lib/line/leave-links.ts`,
`lib/validations/leave.ts`, and `lib/ssot/leave-attachments.ts` after inventory
confirmed that their remaining consumers were tests. Deleted Dashboard/LIFF
components, hooks, and `lib/client/liff-leave.ts` remain forbidden paths; there
is no duplicate Leave implementation outside the module.

Domain calculation, business-date, quota, history-filter, idempotency, schema,
orphan-cleanup, link, and Leave email tests are colocated with their owning
implementation. The Leave overlap/cancellation MySQL test is module-owned and
the integration Vitest configuration includes its new path. API, auth, global
outbox, delivery composition, and cross-boundary attachment tests remain
external and consume `@/modules/leave` only.

The architecture checker rejects deleted ownership imports, Leave API routes
using anything other than the server entry, Leave presentation routes using
anything other than the client entry, every Leave implementation importing its
own public barrels, any business module importing the global outbox processor,
server-only dependencies reachable from the Leave client entry, and the
transitive client-to-Leave-server-entry failure class.

## Preserved invariants

The migration preserves half-day arithmetic, Leave-year boundaries, overlap and
quota accounting, over-quota behavior, approver and exception-approver rules,
approval generations/current-action checks, reassignment behavior,
cancellation-after-approval, not-taken flows, participant authorization,
idempotency keys/hashes, transaction ordering, worker claim safety, attachment
security, report output, notification channels, dedupe semantics, and audit
redaction.

The attachment boundary and report boundary remain unchanged: Leave owns their
orchestration and feature-specific validation/composition, while routes expose
the same private-file and workbook responses through deliberate server
contracts. Shared auth still requires trusted origin and
`X-Requested-With: XMLHttpRequest`; client mutation code obtains the identical
header value from `lib/auth/mutation-headers.ts` without reaching server CSRF
implementation.

No Prisma schema or database migration was introduced. No API contract, public
route, permission policy, status value, business rule, transaction/concurrency
behavior, notification behavior, attachment behavior, LIFF behavior, Thai
wording, UI/UX, or database semantic changed in E3. Closure requires both
`npm run check` and the actual production `npm run build`; their final results
are recorded in the E3 delivery report.

## E3 verification

The final E3 implementation passed `npm run architecture:check`,
`npm run lint:strict`, `npm run typecheck`, `npm run test:run` (228 files,
1,793 tests), `npm run check`, and `npm run build`. The production build
compiled successfully and generated all 88 static pages, covering the client
bundle regression missed during E2. The configured MySQL integration suite
passed 10 files and 65 tests; its first run encountered a transient fixture
setup deadlock, and an unchanged rerun passed with no pending migrations.
