# Feature modules

`modules/` is the ownership boundary for business capabilities in the NHF
Employee application.

`modules/` currently contains the Audit, Auth, Authorization, Department,
Employee, IT, Leave, LINE/LIFF, Notification, Routine, and Stock capability
boundaries. IT1 through IT9D are closed under `modules/it/`. IT8 moved Email
Request ownership into the module while preserving its compatibility seam.
IT9A is CLOSED and owns the requester-only LIFF authorization/API foundation.
IT9B is CLOSED and provides requester presentation at `/liff/it` and
`/liff/it/[ticketId]`. IT9C is **CLOSED** after independent review and owns the
LIFF Home/module projection, service card, shared navigation, canonical
requester deep links, and Unified Rich Menu destination. The review covered the
fixed `LIFF_SELF_SERVICE` projection, requester Home visibility, shared
Home/card/header/Bottom Nav integration, canonical requester LIFF root/detail
destinations, the Unified Rich Menu four-area contract, the retained Dashboard
Inbox destination, and no IT9D delivery leakage. IT9D is **CLOSED** after
independent review and adds requester personal LINE for
`OPERATOR_COMMENTED`, `WAITING_REQUESTER`, and `RESOLVED`; operator-facing
events remain in-app only because operator LIFF does not exist. IT9E-A is
COMPLETE for repository E2E/acceptance readiness; IT9E-UX-P0 unified IT
workspace and creation evidence is IMPLEMENTED / review pending. IT9E-B
Android/iPhone device acceptance is PAUSED / NOT RUN while the POC is under
review. IT10 is OPEN / deferred. No Android/iPhone acceptance has been
performed; no live LINE provider acceptance is claimed.
The LIFF Home projection consumes IT's centralized presentation capabilities
through `LIFF_SELF_SERVICE`; its requester read/create rule is presentation-only
and does not change the existing API authorization boundary.
Its server entry is
`@/modules/it` and its browser-safe Dashboard and LIFF presentation entry is
`@/modules/it/client`. The module owns Ticket persistence, creation and
idempotency, requester and operator queries, approved workflow, assignment,
classification, conversation, attachments, event history, and aggregate-only
operational analytics. IT6 adds Ticket notification meaning, recipient policy,
payload interpretation, action destination, and dispatch through a
transactional shared-outbox intent and the public Notification Inbox command.
IT7 adds the independently authorized `it.analytics.read / ALL` query and Thai
Dashboard at `/dashboard/it/analytics`; it uses Asia/Bangkok 7D/30D/90D periods,
one consistent MySQL read snapshot, and no analytics table or index. Analytics
does not grant individual Ticket access. IT8 moved the existing structured
Email Request subdomain under IT while preserving `/dashboard/email-request`,
`/api/email-request`, its stored rows and authorization contracts. Email
Request remains separate from `ITTicket`; no automatic Ticket creation or
capability inheritance is introduced. Audit Phase I3 is
closed with generic
server/application/persistence,
producer, entity-history query, and Dashboard presentation ownership in
`modules/audit/`. Its public server entry is `@/modules/audit`; its browser-facing entry is
`@/modules/audit/client`, with Audit presentation under
`modules/audit/presentation/dashboard/**`. Production physical AuditLog
delegates are exclusive to `modules/audit/infrastructure/**`; Employee, Leave,
Stock, and Routine retain event meaning and consume only the public Audit
server entry. Phase J0
Auth / Session / Identity discovery and boundary definition is closed, Phase
J1 Auth / Session server and persistence ownership is closed, and Phase J2
Auth identity projection and browser presentation ownership is closed, and
Phase J3 closes LINE/LIFF identity integration plus Auth Audit producer
migration; the Auth / Session / Identity migration is complete. The
authoritative record is
[`docs/architecture/auth-session-identity-migration.md`](../docs/architecture/auth-session-identity-migration.md).
The repository-wide K0 ownership map, K1 closure, and deferred-boundary
inventory are recorded in
[`docs/architecture/final-repository-audit.md`](../docs/architecture/final-repository-audit.md).
The deferral statements in the historical IT6 and Stock K1 closure notes below
record their original phase boundaries; the current IT8 ownership state is
closed and is summarized above. The retained
`lib/line` outbound webhook (`sendLineWebhook`, its service-object export,
`LineWebhookData`, and `LINE_WEBHOOK_URL`) remains a separate L6/H0 external
compatibility seam. Active Email Request delivery continues through IT-owned
Flex and generic LINE push/broadcast. Its type bridge references IT's
authoritative payload type.
The runtime Auth capability is `modules/auth/`, with
`@/modules/auth` as its server public entry and `@/modules/auth/client` as its
browser public entry. It
owns the Auth field slice of User, credentials, web token/session families,
recovery/reset, signup, and Auth refresh/reset-token persistence.
Employee/workforce ownership remains outside Auth. The LINE/LIFF integration
capability is `modules/line/`, with `@/modules/line` as its server entry and
`@/modules/line/client` as its browser entry.

The J2 Auth structure is:

```text
modules/auth/
├── application/
├── domain/
├── infrastructure/persistence/
├── presentation/
├── client.ts
└── index.ts
```

Core Auth routes delegate business and Auth-token persistence through the server
entry while retaining HTTP/security/cookie adaptation. Auth Audit producers
call `@/modules/audit` directly. Employee binds Auth's transaction-aware account-lifecycle
provider through its own structural port, preserving the same serializable
transaction and avoiding an Auth/Employee runtime cycle. The broad
`/api/auth/me` projection is composed outside generic Auth from Auth, Employee,
and Leave public contracts.

The J3 LINE structure is:

```text
modules/line/
├── application/
├── infrastructure/
├── presentation/
├── client.ts
└── index.ts
```

The server entry owns LINE account linking, verified identity, LIFF sessions,
LIFF workforce composition, and recovery contracts. Auth supplies the narrow
account lookup, Employee supplies the active workforce lookup, and Leave
supplies the exact actionable LIFF approval capability. `LineAccountLink`
persistence is exclusive to LINE infrastructure; Routine retains recipient
meaning and uses the public LINE read contract. The browser entry contains only
browser-safe LIFF transport, DTOs, SDK bootstrap, and recovery, and cannot
reach server secrets or the LINE server entry.

The LIFF session cookie name and lifetime contract remain compatible. Phase L3
binds issued LIFF sessions to the verified LINE user identity and protected
LIFF requests revalidate the current `LineAccountLink` before authorization.
Provider Messaging/outbox infrastructure remains under its existing
platform/provider owners, and feature modules retain notification meaning.
Employee F0-F3 owns its server/business behavior and active presentation in
`modules/employee/`. Employee Dashboard routes consume the minimal
browser-safe `@/modules/employee/client` entry, which also exposes the proven
pure Employee display formatter required by Leave, Routine, and audit
presentation. Generic Dashboard shell/context/navigation and route access
remain outside Employee. Other legacy locations remain valid until their
feature is deliberately migrated; Employee compatibility cleanup is complete.

Rules for new work:

- Put a substantial new business feature under `modules/<feature>/`.
- Expose the supported external contract from `modules/<feature>/index.ts`.
- Treat everything below a module's public entry point as internal
  implementation.
- A module may depend on `shared/` and may consume another module only through
  that module's public entry point.
- Keep the structure proportional to the feature. See
  [module boundaries](../docs/architecture/module-boundaries.md) for the
  larger and smaller module shapes.

The intended dependency direction is documented in
[dependency rules](../docs/architecture/dependency-rules.md). Run

`npm run architecture:check` when changing code under this directory.

Employee/Leave lifecycle composition is intentionally one-way: Leave may use
the public Employee hierarchy contract for the Employee-owned `managerId`
write, while Employee lifecycle code depends only on its structural
`EmployeeOffboardingDependencyProvider` port. The outer application boundary
binds Leave's blocker implementation and passes the same transaction client
used by the Employee serializable lifecycle operation. Employee must not
runtime-import `@/modules/leave` or Leave internals.

The Employee presentation keeps using the existing `/api/employees/**` and
`/api/departments` browser endpoints. Its CSV upload/preview/result flow uses
the module-owned client-safe parser and does not depend on the deleted mixed
Prisma/Leave `lib/helpers/csv-helpers.ts` implementation. Employee
presentation internals use local contracts and must not import either Employee
public barrel. Generic User/Employee fallback display is owned by the neutral
structural helper in `shared/identity/display.ts`, and Leave report labels are
owned by Leave report infrastructure.

Phase F3 CLOSED — Employee migration complete.
F0-F3 Employee modular-monolith migration is complete. This does not claim
that other application features are fully migrated.

Phase G0 Organization/Department discovery remains available as a historical
record. The post-G0 product decision is permanent single-NHF organization:
there is no Organization domain or tenant architecture. Department is an
NHF-wide reference-data capability owned by `modules/department/`.

`modules/department/index.ts` is the supported server entry. It exposes
`listDepartments()` for `app/api/departments/route.ts` and
`listDepartmentReferences()` for Employee import. Department infrastructure
owns production Department Prisma reads. Employee still owns its
`departmentId` association, CSV aliases/mapping, import policy, and Employee
creation; it consumes Department only through `@/modules/department`.

Department is intentionally server-only: it has no `client.ts`, standalone
presentation, CRUD, lifecycle, hierarchy, or Department-head behavior in the
final G3 architecture.
Employee owns its Department selectors, `departmentId` form state, import
mapping, and Employee-specific display formatting. Browser lookup remains
`GET /api/departments`, and the architecture checker rejects direct or
transitive client-reachable imports of `@/modules/department`; server consumers
use the root entry. No obsolete production Department compatibility artifact
remained, so no runtime deletion was necessary in G3. See the final migration
ledger in
[organization-department-migration.md](../docs/architecture/organization-department-migration.md)
for the historical G0 record and final G1-G3 implementation ledger.

Phase H3 Notification producer integration and final migration audit are
complete; Phase H1 server/application and H2 presentation ownership remain
complete.
`modules/notification/` owns the user-facing in-app Notification/Inbox
persistence, queries, read commands, strict/idempotent explicit-user create
commands, strict explicit-user batch create, business-driven unread reference
transitions, and Notification dedupe behavior. Its `index.ts` is the only
supported server entry. The four `app/api/notifications/**` routes remain HTTP/auth adapters and
delegate through that entry; their full Prisma-serialized row responses and
history cursor contract (including legacy timestamp-cursor compatibility)
remain compatible. Its browser-facing
`client.ts` exposes only `NotificationDropdown`, `NotificationsSection`, and
`NotificationSectionSkeleton`; the active Dashboard presentation is owned under
`modules/notification/presentation/dashboard/**`. The Notification page and
loading routes use the client entry, and the generic DashboardNavbar remains
Dashboard-owned while mounting the dropdown through it.

Notification presentation continues to use the HTTP contracts in
`API_ROUTES.notifications.*`; the client graph does not reach the server entry,
Prisma, Notification application/infrastructure, Outbox, Email, or LINE
implementation. The deleted `components/dashboard/notifications/**` path has
no compatibility facade. The Notification-specific history skeleton moved to
the module; generic Dashboard skeleton primitives remain shared.

`createForUser` and `createForUsers` are strict public persistence commands;
`createForUserOnce` is the idempotent command that catches only `P2002`.
`markUnreadByReferenceForUser` persists business-driven unread transitions
without interpreting business state. The former
`createAdminInAppNotificationsOnce` helper was removed. IT8 removed the
Email Request-only `createInAppNotificationOnce` compatibility adapter;
Email Request calls Notification's public `createForUserOnce` command with its
configured-authority recipient set.
Leave, Stock, Routine, and IT own their event meaning, recipients,
titles/messages, action/reference values, channel choices, and event-specific
dedupe or supersede rules. IT owns `ITTicketEvent` as operational history and
the IT Ticket and Email Request notification producers. Leave, Stock, Routine,
and IT use `@/modules/notification` for Inbox writes. Physical
Notification persistence is owned only by
`modules/notification/infrastructure/**`; Stock's two intentionally different
admin eligibility policies remain Stock-owned.

`NotificationOutbox` is not part of the Notification module. The shared
platform outbox owns reliable asynchronous delivery, claim/retry/dead-letter/
supersede lifecycle, scheduling/wakeup, and provider dispatch composition.
Business modules may enqueue outbox rows transactionally but must not import
the global processor. For business-owned outbox events, the global processor
routes through the producing business module's public dispatch contract. That
module owns domain validation, recipient/semantic resolution, and
stale/defer/supersede decisions before invoking Notification's public command
for an in-app write. The business dispatch contract owns any transaction-bound
persistence context; the global processor does not pass a transaction client
directly to Notification. A direct processor-to-Notification dispatch is
reserved for a future truly Notification-owned generic event with a fully
resolved command payload; no current production event uses that shape. IT
enqueues `IT_TICKET_IN_APP` and eligible `IT_TICKET_LINE` rows in the Ticket
mutation transaction and exports its server-only dispatch contract through
`@/modules/it`; app API adapters wake the global processor only after successful
mutations. IT6 implements in-app Ticket notifications; IT9D reuses the same
strict semantic payload and adds deterministic LINE event/retry identity,
`LineAccountLink`, `LINE_APP_CHANNEL_ACCESS_TOKEN`, and the canonical requester
LIFF Ticket destination. Dashboard Inbox URLs stay unchanged. Unlinked or
ineligible recipients are superseded; provider failures use the shared
at-least-once retry/dead-letter lifecycle. No live LINE provider or smartphone
acceptance was performed. Ticket Email remains a product decision/deferred.
The Ticket creation rate-limit scope is
`it-ticket-create` (60 requests per IP per 15 minutes; 10 per authenticated
principal per minute); like the shared mutation limiter, it is currently
process-local. Attachment-bearing comments reuse
`it-ticket-comment-attachment` with the same budgets. See
[notification-migration.md](../docs/architecture/notification-migration.md)
for the H0 evidence, exhaustive ledger, invariants, and H1-H3 slices. H3
producer integration and compatibility cleanup are complete. NotificationOutbox
and the global processor remain outside Notification; L4 closes the
timestamp-only history cursor ambiguity while legacy `TICKET_*` storage
compatibility remains unchanged.

Phase H0 CLOSED — Notification discovery and boundary definition complete.
Phase H1 CLOSED — Notification server/application ownership complete.
Phase H2 CLOSED — Notification presentation ownership complete.
Phase H3 CLOSED — Notification producer integration and final migration audit complete.

Notification H0-H3 migration complete. IT1 authorization foundation, IT2
Ticket persistence/workflow, IT3 requester self-service, IT4 operator
processing, IT5A conversation/timeline, and IT5B private attachments are closed.
IT6 in-app notifications are implemented with final closure verification
pending because the repository-wide test run had resource-sensitive timeouts in
unrelated existing UI/architecture tests. Email Request migration remains
deferred to IT8.

## Stock K1 ownership closure

Stock is the single owner of Stock server/business behavior, Dashboard and
LIFF presentation, browser contracts/helpers, and Stock notification meaning.
Stock email subjects/templates/Message-ID and LINE Flex/message composition live
under `modules/stock/**` and call the generic platform transports through
narrow contracts.

`STOCK_REQUEST_RESULT_LINE` remains personal LINE_APP delivery through
`LineAccountLink`/`sendAppLineNotification`. `STOCK_REQUEST_LINE` and
`STOCK_LOW_LINE` remain operational broadcasts through the legacy Stock
Messaging channel and `LINE_STOCK_CHANNEL_ACCESS_TOKEN`.

The shared Outbox Processor remains platform-owned and delegates Stock event
interpretation through `@/modules/stock`; it continues to own claim, retry,
stale-processing, dead-letter, and supersede lifecycle. IT6 adds in-app Ticket
notifications through the IT dispatcher; Email Request migration remains
deferred to IT8.
