# Notification migration record

Status: **Phase H2 CLOSED — Notification presentation ownership complete.**
Phase H1 server/application ownership and Phase H0 discovery remain closed.
H3 producer integration and compatibility cleanup remain open/not started.

This record is the source of truth for the Notification boundary and its
incremental implementation. It records the repository behavior observed at the
G3 closure baseline and separates the in-app Inbox capability from business
notification semantics, reliable asynchronous delivery, and provider/channel
integrations.

Baseline audited: `b839e84bc2bc67ece29a224874b340d1af00fdae`
(`docs(architecture): close G3 Department migration audit`). The working tree
was clean and this baseline was the current `HEAD` at H0 start; the H0 baseline
had no `modules/notification/` directory. H1 now establishes that server-side
module without changing the physical Prisma schema.

## H0 scope and evidence

H0 is discovery and architecture definition only. The audit read the Prisma
schema, current Notification routes and tests, active Dashboard consumers,
all production Notification persistence and outbox enqueue sites, the Leave,
Stock, Routine, and Email Request implementations, global outbox processing,
provider adapters, and the completed Stock, Routine, Leave, Employee, and
Department migration records.

Repository-wide searches covered at least:

- `prisma.notification`, `.notification.create`, `.notification.createMany`,
  `.notification.update`, and `.notification.updateMany`;
- `createInAppNotificationOnce`,
  `createAdminInAppNotificationsOnce`, `NotificationType`, notification
  dedupe keys, action URLs, and reference IDs;
- `NotificationOutbox`, all `NotificationOutboxType` values, outbox enqueue
  sites, `processOutbox`, provider retry keys, and the notification cron
  route; and
- all Notification Dashboard components, route/menu constants, API consumers,
  tests, and architecture guardrails.

No runtime source, test, Prisma schema, migration, generated file, lockfile,
API response, UI component, producer, or outbox processor was changed for
H0.

## Boundary decision

### What the Notification capability is

The Notification capability is the user-facing **in-app Notification / Inbox**
capability. It owns durable per-user inbox entries and the queries and commands
that let the current user view, filter, paginate, and mark those entries read.
H1 established its server/application contracts and persistence boundary. H2
now owns the Notification-specific browser presentation and exposes it through
the explicit `@/modules/notification/client` entry.

Notification does not own the business event that caused an entry, the
recipient policy, a domain-specific message, or the choice of delivery
channels.

### Four concerns that must stay separate

| Concern | Owner at target | Boundary decision |
| --- | --- | --- |
| In-app Notification / Inbox | `modules/notification/` | Owns the `Notification` persistence boundary, generic durable create-to-user mechanics, inbox queries, unread/read commands, the H1 server/application contract, and the H2 browser presentation/client seam. |
| Business-owned notification semantics | Leave, Stock, Routine, Email Request while deferred, and future IT/business modules | Owns why an event is noteworthy, who receives it, its semantic type, title, message, action URL, reference ID, channel selection, and event-specific dedupe/supersede rules. |
| Reliable asynchronous delivery / NotificationOutbox | Shared/platform outbox infrastructure | Owns `NotificationOutbox` lifecycle, claim/retry/dead-letter/supersede behavior, scheduling/wakeup, and processor composition. Business modules may enqueue rows transactionally but must not import the processor. |
| Provider/channel integrations | Shared/platform transports plus business-owned payload composers | Email and LINE transports remain generic platform infrastructure. Leave, Stock, Routine, and the deferred Email Request capability continue to own channel-specific event payload and message meaning. |

### Canonical business/outbox/Notification flow

```text
Business transaction/event
        ↓
Business module
        ├─ owns recipients + semantics
        ├─ may enqueue NotificationOutbox event
        └─ may create Inbox notification atomically
                    ↓
            Notification public command
                    ↓
              Notification persistence

Async path:

NotificationOutbox
        ↓
Global Outbox Processor
        ↓
Business module public dispatch contract
        ↓
domain validation / recipient resolution / semantic composition
        ↓
Notification public command (when in-app delivery is required)
        ↓
Notification persistence
```

Email/LINE branches remain business/provider delivery concerns. The global
processor owns reliable delivery lifecycle and routes business-owned events to
the producing business contract; it does not interpret domain notification
semantics or bypass that contract to call Notification directly.

The Dashboard navbar, route composition, and generic shell remain app/Dashboard
composition. They mount Notification presentation but do not become the owner
of Notification persistence or business meaning.

### Explicit answers to the H0 architecture questions

1. **Notification business capability:** a per-user in-app Inbox with durable
   entries, history/unread queries, pagination/filtering, and read commands.
2. **In-app inbox or delivery infrastructure:** Notification means the in-app
   Inbox. It does not absorb reliable delivery infrastructure. For a
   business-owned outbox event, the global processor routes through the
   producing business module, which may then invoke Notification to persist an
   entry. A direct Outbox-to-Notification path is reserved for a future truly
   Notification-owned generic event with a fully resolved command payload.
3. **`Notification` Prisma model:** the Notification capability owns
   its repository and application persistence boundary. The physical Prisma
   schema remains the repository's shared physical schema; H1 changes code
   ownership only.
4. **`NotificationOutbox`:** shared/platform reliable asynchronous delivery
   infrastructure owns the model's lifecycle and processor composition.
5. **Retry/scheduling/processor behavior:** shared/platform outbox code owns
   stale-claim recovery, retry/backoff, dead-lettering, superseding,
   scheduling/wakeup, and dispatch composition.
6. **Recipients:** the business producer decides recipients. Notification
   receives explicit user IDs; it must not decide that all Stock admins, Leave
   approvers, Routine assignees, or an Email Request email audience should be
   notified.
7. **Title/message/action URL:** the business producer owns domain-specific
   meaning and destination. Notification persists the supplied values and
   presents the resulting entry.
8. **Creating an in-app entry:** another module uses a narrow public
   Notification application command with an explicit user and semantic
   payload. It does not import Notification Prisma internals or the shared
   helper's implementation file.
9. **Transaction-aware creation:** the business use case or business dispatch
   contract owns its transaction and supplies a transaction-bound Notification
   persistence port (implemented by the existing Prisma transaction client
   pattern) to the command. The command writes through that context and does
   not start a second transaction. The global processor does not pass its own
   transaction client directly to Notification.
10. **Outbox-delivered in-app entry:** for current business-owned outbox
    events, the global processor calls the producing business module's public
    dispatch contract. That business application performs domain
    revalidation, recipient resolution, stale/defer/supersede decisions, and
    semantic composition, then invokes Notification's public command when an
    in-app entry is required. The business dispatch contract owns the
    transaction-bound context for atomic persistence. The processor remains
    outside Notification and keeps ownership of claim, retry, status, wakeup,
    and provider composition. Only a future truly Notification-owned generic
    event with a fully resolved Notification command payload could use a direct
    processor-to-Notification dispatch; no current production event does.
11. **Legacy IT values:** `TICKET_CREATED`, `NEW_COMMENT`, and
    `TICKET_UPDATED` in `NotificationType`, and the legacy `TICKET_*` outbox
    values described below, are historical storage compatibility only. H0 does
    not restore IT Support or delete these values.
12. **Email Request:** it remains a transitional/deferred consumer. It is not
    migrated or redesigned with Notification; its future ownership is intended
    to be decided with the future IT capability boundary.
13. **Transitional paths:** H1 now routes the legacy
    `app/api/notifications/**` HTTP adapters and generic
    `lib/services/notifications/in-app.ts` writes through the Notification
    public server entry. Direct producer writes and the public business
    dispatch contracts consumed by the global processor remain transitional
    until H3; the obsolete `components/dashboard/notifications/**` ownership
    path was removed in H2.
14. **Next phases:** H1 established server/application ownership and route
    delegation; H2 established Notification presentation/client ownership; H3
    integrates producers, resolves mixed helpers, adds guardrails, and performs
    the final compatibility audit. H1 and H2 are closed; H3 remains open.

## Current `Notification` persistence model

The current model is in `prisma/schema.prisma` and is mapped to the
`notifications` table. Its observed semantics are:

| Field/constraint | Current semantics | Boundary implication |
| --- | --- | --- |
| `id String @id @default(cuid())` | Server-generated CUID identity for one inbox entry. | Notification persistence owns entry identity; producers do not choose database IDs. |
| `userId Int` and `user User @relation(..., onDelete: Cascade)` | Each entry belongs to one user. Deleting the user cascades to the user's entries. | User ownership is a persistence invariant and every read/write must remain user-scoped. |
| `type NotificationType` | Semantic notification type is stored as a Prisma enum. | The producer supplies the business semantic type; H1 must preserve existing values and mappings. |
| `title String` | Short display title supplied by the producer. | Notification must not generate domain titles. |
| `message String @db.Text` | Longer display message, including Thai business detail in current producers. | Notification persists and presents the supplied text without translating or normalizing business meaning. |
| `isRead Boolean @default(false)` | New entries are unread; read commands set it to `true`. There is no unread timestamp. | Preserve current boolean semantics and mark-one/mark-all behavior. |
| `actionUrl String?` | Optional producer-supplied destination. Client presentation normalizes legacy dashboard tab aliases before navigation. | The producer owns the destination; Notification presentation owns safe client navigation behavior. |
| `referenceId String?` | Optional opaque ID of the related domain record. There is no foreign key or domain-specific relation. | Notification stores a reference but must not own Leave/Stock/Routine records. |
| `dedupeKey String? @unique` | Optional globally unique key. Multiple `NULL` values remain allowed by normal nullable-unique behavior; non-null collisions are used as idempotency. Existing helper treats Prisma `P2002` as a no-op. | Preserve global uniqueness and event-specific key construction. Do not silently scope or invent dedupe keys. |
| `createdAt DateTime @default(now())` | Creation timestamp used for latest ordering and history cursoring. There is no `updatedAt`. | Preserve ordering and cursor behavior before considering a stable tie-breaker in a separate change. |
| `@@index([userId, isRead])` | Supports user/unread filtering. | Preserve user/read query behavior and index unless a later migration proves a safe schema change. |
| `@@index([createdAt])` | Supports timestamp ordering/cursor access. | The current history cursor is timestamp-only; this is a known compatibility risk. |
| absence of other uniqueness/foreign keys | No composite `(userId, createdAt)` index, no user-scoped dedupe constraint, and no FK for `referenceId`. | H1/H3 must not assume stronger guarantees than the schema currently provides. |

### `NotificationType` inventory

The complete current enum is classified below from production consumers and
the existing stored-history comments:

| Enum value | Current classification | Current producer/meaning |
| --- | --- | --- |
| `TICKET_CREATED` | Historical IT Support compatibility only | No current production producer found. Preserve rows; do not restore IT Support. |
| `NEW_COMMENT` | Historical IT Support compatibility only | No current production producer found. Preserve rows; do not restore IT Support. |
| `TICKET_UPDATED` | Historical IT Support compatibility only | No current production producer found. Preserve rows; do not restore IT Support. |
| `SYSTEM_ALERT` | Active generic semantic | Currently used by Leave cancellation rejection, Stock low-stock alerts, and deferred Email Request in-app notification. The value does not make those capabilities Notification-owned. |
| `LEAVE_REQUESTED` | Active Leave semantic | Leave action notification to the configured approver; Leave owns recipient, Thai title/message, approval URL, reference, and dedupe. |
| `LEAVE_APPROVED` | Active Leave semantic | Leave result notification to the employee. |
| `LEAVE_REJECTED` | Active Leave semantic | Leave result notification to the employee. |
| `LEAVE_CANCELLED` | Active Leave semantic | Leave cancellation/action notification according to the current Leave workflow. |
| `LEAVE_CANCELLATION_REQUESTED` | Active Leave semantic | Leave cancellation request to the configured approver. |
| `LEAVE_CANCELLED_AFTER_APPROVAL` | Active Leave semantic | Leave cancellation result after approval. |
| `LEAVE_NOT_TAKEN_REQUESTED` | Active Leave semantic | Leave not-taken request to the configured approver, including the employee's current in-app confirmation. |
| `LEAVE_NOT_TAKEN_CONFIRMED` | Active Leave semantic | Leave not-taken confirmation to the employee. |
| `STOCK_REQUEST_NEW` | Active Stock semantic | New Stock request notification to resolved Stock admins. |
| `STOCK_ISSUED @map("STOCK_APPROVED")` | Active Stock semantic | Requester notification that Stock was issued; code uses `STOCK_ISSUED`, database value remains mapped to `STOCK_APPROVED`. |
| `STOCK_CANCELLED @map("STOCK_REJECTED")` | Active Stock semantic | Requester/admin notification that a Stock request was cancelled; database value remains mapped to `STOCK_REJECTED`. |
| `ROUTINE_REMINDER` | Active Routine semantic | Routine task reminder delivered through the global outbox. |
| `ROUTINE_CONTRACT_EXPIRY` | Active Routine semantic | Routine contract-expiry reminder delivered through the global outbox. |

The three `TICKET_*` Notification values are not evidence that an IT Support
feature should return. They remain only so historical Notification rows can be
read by the existing model and future Inbox queries.

## Current Notification HTTP behavior

All four routes use `requireApiSession()`. That helper obtains the hybrid
access-cookie session, verifies the access token and session family, requires
an active eligible employee-backed user, and checks the token version. A
missing or invalid session returns the existing 401 response (`{ error:
"Unauthorized" }`). The routes then scope Prisma operations to the parsed
session user ID. Invalid session IDs return the existing 400
`COMMON_API_MESSAGES.invalidUserSession` response.

| Route | Current behavior and response contract | Compatibility evidence |
| --- | --- | --- |
| `app/api/notifications/route.ts` `GET` | Runs the latest query and unread count in parallel. Latest query is `findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 })`. Count is `count({ where: { userId, isRead: false } })`. Success is `{ notifications, unreadCount }` with 200. Prisma serialization currently returns the full model fields selected by `findMany`, not a hand-written DTO. Failure logs server-side and returns 500 `{ error: "Failed to fetch notifications" }`. | `__tests__/api/notifications.test.ts` asserts auth, user scope, descending order, `take: 10`, and unread count. |
| `app/api/notifications/all/route.ts` `GET` | Uses `PAGE_SIZE = 20`. `filter=unread` adds `isRead: false`; any other filter behaves as all. `cursor` is an ISO timestamp string from the last row. The query applies `createdAt < new Date(cursor)`, orders descending by `createdAt`, and takes 21 rows. It returns the first 20 plus `{ notifications, nextCursor, hasMore, totalCount }`. The cursor is `null` when there is no next page. Invalid cursor parsing currently falls into the generic 500 path. | The route is consumed by `NotificationsPageContent`; current repository tests cover the main Notification API contracts but do not establish a new cursor contract. |
| `app/api/notifications/[id]/read/route.ts` `PATCH` | Parses the route ID as a string and executes `update({ where: { id: notificationId, userId }, data: { isRead: true } })`. Success is `{ success: true, notification }` with 200. A missing row, non-owned row, or Prisma error currently reaches the catch path and returns 500 `{ error: "Failed to mark notification as read" }`; it is not converted to 404 in H0. | Tests assert the user-scoped `where` and `isRead: true`; the user-scope is the security boundary. |
| `app/api/notifications/mark-all-read/route.ts` `POST` | Executes `updateMany({ where: { userId, isRead: false }, data: { isRead: true } })`. Success is `{ success: true, updatedCount: result.count }` with 200. Repeating it with no unread rows succeeds with count 0. Failures return 500 `{ error: "Failed to mark all notifications as read" }`. | Tests assert the user/unread scope and returned count. |

The API tests currently prove unauthenticated 401 behavior, authenticated
latest-list/count behavior, single-read user scoping, and mark-all count
behavior. They do not fully prove `/all` cursor edge cases, malformed cursor
handling, non-owned read errors, or response-field narrowing. Those are
compatibility risks, not H0 fixes.

## Current Notification presentation boundary

### Notification-specific presentation

The following files are Notification-owned Dashboard presentation behind the
browser-safe `@/modules/notification/client` entry after H2:

| H2 path | Observed responsibility |
| --- | --- |
| `modules/notification/presentation/dashboard/NotificationShared.tsx` | Browser-safe Notification item/list contracts, fetcher, loading/empty/error states, badge formatting, action-URL normalization, and type-to-icon mapping. `NotificationItem` exposes `id`, `type`, `title`, `message`, `isRead`, `actionUrl`, and `createdAt`; it intentionally does not expose every Prisma field. |
| `modules/notification/presentation/dashboard/NotificationPageParts.tsx` | Notification history header, filter tabs, mark-all affordance, list rows, unread styling/dot, type icon, and relative-time display. |
| `modules/notification/presentation/dashboard/NotificationDropdown.tsx` | Navbar inbox dropdown; SWR list fetch, 60-second polling, no focus revalidation, no automatic retry, 30-second dedupe, single-read and mark-all mutations, badge, and navigation to the history route. |
| `modules/notification/presentation/dashboard/NotificationsPageContent.tsx` | Full history page; SWR filter fetch, timestamp cursor loading, append behavior, optimistic read/mark-all behavior, total count, and action navigation. |
| `modules/notification/presentation/dashboard/NotificationSkeletons.tsx` | Notification history loading presentation formerly embedded in generic Dashboard feedback; it is now owned by Notification without moving generic skeleton primitives. |

The current type-to-icon mapping is semantic presentation, not business policy:

| Stored type(s) | Current icon/presentation |
| --- | --- |
| `STOCK_REQUEST_NEW`, `LEAVE_REQUESTED`, `LEAVE_NOT_TAKEN_REQUESTED`, `LEAVE_CANCELLATION_REQUESTED` | `Bell` with the corresponding Stock/Leave CSS token. |
| `ROUTINE_REMINDER` | `ClipboardCheck`. |
| `ROUTINE_CONTRACT_EXPIRY` | `CalendarClock`. |
| `STOCK_ISSUED`, `LEAVE_APPROVED`, `LEAVE_NOT_TAKEN_CONFIRMED`, `LEAVE_CANCELLED_AFTER_APPROVAL` | `Check`. |
| `STOCK_CANCELLED`, `LEAVE_REJECTED`, `LEAVE_CANCELLED` | `XCircle`. |
| `SYSTEM_ALERT` and any unknown/historical value | `Info` with the muted content token. |

The default mapping intentionally remains forward-compatible for new stored
values and historical values.

The H2 browser entry exposes only `NotificationDropdown`,
`NotificationsSection`, and `NotificationSectionSkeleton`. Shared contracts,
page parts, row components, state components, and fetcher implementation stay
internal to Notification presentation. Current browser contracts and behavior
preserved by H2 include:

- `API_ROUTES.notifications.list` uses `/api/notifications` and the history
  endpoint uses `/api/notifications/all?filter=...`.
- The dropdown polls every 60 seconds, does not revalidate on focus, and does
  not retry failed requests automatically.
- The history page uses the server timestamp cursor, appends later pages, and
  resets items/cursor/has-more when the filter changes.
- `actionUrl` is normalized before `router.push`: the legacy
  `tab=it-equipment` alias is converted to Stock, disabled tabs fall back to
  the dashboard, and malformed URLs are treated as normalized strings rather
  than causing a component crash.
- Unread state is shown by row styling/dot and the badge formats counts above
  99 as `99+`.

### Dashboard/app composition that remains outside Notification

These files compose the generic shell or delivery boundary and should not be
absorbed into the future Notification feature merely because they reference
notifications:

- `components/dashboard/layout/DashboardNavbar.tsx` owns the generic navbar
  and mounts the dropdown alongside the user menu.
- `app/dashboard/notifications/page.tsx` and
  `app/dashboard/notifications/loading.tsx` own App Router page/metadata,
  Suspense, and route loading composition.
- `lib/ssot/routes.ts` owns URL constants and Dashboard route/menu composition:
  `API_ROUTES.notifications`, `APP_ROUTES.dashboardNotifications`,
  `APP_DASHBOARD_TABS.notifications`, and the Dashboard menu path/meta.
- `constants/dashboard.ts` owns generic Dashboard page/menu labels and shell
  composition, including the Thai label `การแจ้งเตือน`.
- `__tests__/components/DashboardNavbar.test.tsx` proves navbar composition;
  it should remain a shell test even after the dropdown implementation moves.

`app/dashboard/notifications/page.tsx` and `loading.tsx` consume the client
entry. `DashboardNavbar` remains Dashboard-owned and mounts only the public
`NotificationDropdown` contract through that entry. The Notification browser
graph remains HTTP-based through `API_ROUTES.notifications.*`; it does not
reach the H1 server/application or infrastructure implementation.

## Producer audit by business capability

### Leave

Leave owns Leave notification semantics. The audited code in
`modules/leave/application/notifications/notifications.ts` constructs the
Leave-specific recipient, `NotificationType`, Thai title/message, approval or
history action URL, Leave reference ID, and event dedupe key. Its duplicate
handling treats a unique violation as an idempotent no-op. The current action
dispatcher can create the in-app entry and send email independently, including
the `createInApp: false` path used when the in-app row was created while the
outbox event transaction was being processed.

Leave also owns workflow read/supersede semantics. The audited direct writes
include:

- `modules/leave/application/approvals/decision.ts`: mark the current
  approver's unread `LEAVE_REQUESTED` entry for the Leave reference as read in
  the approval transaction;
- `modules/leave/application/cancellation/cancellation.ts`: mark obsolete
  cancellation entries read and create the employee's
  `LEAVE_CANCELLED`, `LEAVE_CANCELLATION_REQUESTED`, or `SYSTEM_ALERT`
  entries as dictated by the current cancellation state machine; and
- `modules/leave/application/not-taken.ts`: create the employee's
  `LEAVE_NOT_TAKEN_REQUESTED` confirmation entry and mark the effective
  approver's request entry read when confirmed.

These are not generic Notification workflow rules. H1/H3 must give Leave a
narrow Notification command/query seam without moving Leave's state-machine
meaning or recipient policy into Notification.

Leave's transaction-coupled outbox sites are:

- `modules/leave/application/requests/create-request.ts` — `LEAVE_ACTION`;
- `modules/leave/application/approvals/decision.ts` — `LEAVE_RESULT`;
- `modules/leave/application/cancellation/cancellation.ts` —
  `LEAVE_CANCELLED`, `LEAVE_CANCELLATION_REQUESTED`, and
  `LEAVE_CANCELLED_AFTER_APPROVAL`;
- `modules/leave/application/not-taken.ts` —
  `LEAVE_NOT_TAKEN_REQUESTED` and `LEAVE_NOT_TAKEN_CONFIRMED`; and
- `modules/leave/infrastructure/notifications/line.ts` — Leave-specific LINE
  child rows for the seven `*_LINE` values, including deterministic provider
  retry keys.

`modules/leave/application/approvals/current-action-recipient.ts` is the
important cross-boundary example. The global processor claims a Leave outbox
row, the Leave application revalidates the current action inside a transaction,
creates the Leave in-app entry there, and enqueues the Leave LINE child. After
the transaction commits, the Leave dispatch contract sends the Leave action
email through Leave-owned notification behavior. After Leave's revalidation
and semantic composition, the Leave dispatch contract is the future caller of
the public Notification command; this does not transfer the processor or Leave
semantics to Notification.

### Stock

Stock owns requester/admin recipient resolution, request lifecycle meaning,
low-stock meaning, Stock-specific text and destinations, and Stock event
dedupe choices. The main implementation is
`modules/stock/infrastructure/notifications/notifications.ts`:

- `notifyStockRequestResult` directly persists the requester result with
  `STOCK_ISSUED` or `STOCK_CANCELLED`, Stock title/message, request reference,
  and the My Requests destination. This path currently has no dedupe key.
- `notifyAdminsNewStockRequest` uses the shared helper for explicit current
  admins, with `STOCK_REQUEST_NEW` and a request/admin dedupe prefix.
- `notifyAdminsStockRequestCancelledByRequester` directly resolves admins and
  creates `STOCK_CANCELLED` entries. Its current admin query differs from the
  shared admin helper by not filtering active/deleted users; H0 records this
  behavior and does not normalize it.
- `notifyAdminsLowStockInApp` uses `SYSTEM_ALERT`, Stock inventory wording,
  an inventory action URL, and an alert/item reference. It is paired with the
  Stock low-stock outbox row in the same transaction by
  `persistLowStockNotifications`.

Stock transaction boundaries are preserved by
`request-creation.ts`, `request-mutations.ts`, and `item-mutations.ts`.
They create requester/admin in-app rows and enqueue relevant channel rows in
the same transaction where the current use case requires atomicity.

Stock outbox sites are:

- `modules/stock/infrastructure/notifications/notifications.ts` — request
  result email and LINE child rows, new-request LINE rows, and low-stock LINE
  rows; and
- `modules/stock/application/requests/request-creation.ts`,
  `request-mutations.ts`, and `item-mutations.ts` — transaction composition
  that invokes those notification operations.

Stock's public module entry exposes dispatcher contracts consumed by the global
processor. Those contracts are a valid business-to-platform seam; the global
processor remains outside Stock and outside Notification.

### Routine

Routine owns reminder/contract-expiry event timing, recipient policy, payload
meaning, title/message/action URL, reference IDs, versioned event keys, and
supersede rules. `modules/routine/application/recipients.ts` explicitly
resolves active employees/users, configured assignees, and active admins for
the requested Routine scope. Notification must not reproduce this policy.

The scheduler paths in `scheduler.ts` and `contract-reminders.ts` enqueue
global `ROUTINE_REMINDER_IN_APP` and `ROUTINE_CONTRACT_EXPIRY_IN_APP` rows with
unique event keys. The global processor then calls the public Routine dispatch
contracts in `reminders.ts` and `contract-reminders.ts`. Those dispatchers
revalidate current task/occurrence/rule/version/due state, defer or supersede
stale work, resolve current recipients, and create in-app rows with explicit
Routine semantic payloads and user-specific dedupe keys. They also create
independent email/LINE child outbox rows.

This is an explicit required case: **an in-app Notification can be delivered
through the global outbox reliability mechanism**. That fact does not make
`NotificationOutbox` part of the Notification feature. Routine owns the
reminder event and its dispatch contract; the platform processor owns delivery
lifecycle; Notification will own only the durable inbox write when H1/H3
establish that seam.

`modules/routine/application/mutations.ts` also supersedes pending/processing/
failed reminder child rows when a Routine task is deleted. That is Routine
business lifecycle behavior and remains Routine-owned.

### Email Request (deferred)

`lib/services/email-request/notifications.ts` resolves configured recipient
emails to active users and calls the generic in-app helper with `SYSTEM_ALERT`,
Email Request wording, the Email Request destination, the reply-email
reference, and a request/time/user dedupe key. This is an Email Request
audience and semantic policy, not Notification audience policy.

`lib/services/email-request/mutations.ts` creates the `EMAIL_REQUEST` outbox
row transactionally with the Email Request record and idempotency state.
`app/api/email-request/route.ts` authenticates/admin-checks the request and
wakes the global processor after a new request. The global processor creates
the Email Request in-app entry before attempting the LINE/email channel path.
This current direct path is transitional legacy behavior, not the target
business-dispatch boundary and not a pattern for H1; future Email Request/IT
ownership remains deferred.

Email Request remains a transitional consumer. Its future ownership is
intentionally deferred until the IT capability boundary is re-established so
the same feature is not migrated twice. H0 does not move, redesign, or clean
up these paths.

### Legacy IT Support

The repository contains historical `TICKET_*` values in both notification
enums, but no current production producer for those values was found. They
remain for stored-history compatibility. H0 does not restore an IT Support
module, recreate ticket behavior, delete enum values, or reinterpret old rows.

## Shared in-app helper audit

`lib/services/notifications/in-app.ts` remains a transitional compatibility
surface that combines the Notification adapter with one business audience
policy:

| Symbol | Current responsibility | H0 boundary finding |
| --- | --- | --- |
| `InAppNotificationClient` | Narrows a Prisma transaction/client to `notification` and `user`, allowing the helper to run against `prisma` or a transaction client. | H1 passes its `notification` portion to the public Notification command and preserves atomicity. |
| `createInAppNotificationOnce` | Skips a missing user ID, creates one `Notification` row with the supplied type/title/message/action/reference/dedupe values, and treats `P2002` as a duplicate no-op. | H1 makes this a thin adapter over `@/modules/notification`; durable persistence and uniqueness handling belong in Notification. |
| `createAdminInAppNotificationsOnce` | Looks up active, non-deleted `Role.ADMIN` users, then calls the generic helper with an admin/user-specific dedupe key. | The lookup and “all admins” audience policy do not belong in generic Notification persistence. |

The helper does not own business reasons, but the admin helper does own a
recipient-selection policy. H1 keeps that lookup outside Notification while
business modules continue to migrate toward explicit recipients; H3 can remove
or adapt the mixed helper after every consumer is migrated. Do not automatically
create a generic Notification “notify all admins” API.

## NotificationOutbox audit

### Schema and runtime type boundary

`NotificationOutbox` is mapped to `notification_outbox` and currently has:

| Field/constraint | Current semantics |
| --- | --- |
| `id` | Auto-increment integer identity. |
| `type` | `NotificationOutboxType` enum. |
| `eventKey String? @unique` | Nullable globally unique event identity used for idempotent enqueueing. |
| `payload String @db.Text` | Serialized event payload; producers and dispatchers validate their own payload shape. |
| `status` | `PENDING`, `PROCESSING`, `SENT`, `FAILED`, `DEAD`, or `SUPERSEDED`. |
| `attempts` | Retry attempt counter, default 0. |
| `nextAttemptAt` | Due time for processing, default now. |
| `lastError` | Mapped database column `error`; stores the last processing error string for operations. |
| `createdAt`, `updatedAt` | Creation and update timestamps. |
| indexes | `[status, nextAttemptAt]` for due work and `[createdAt]` for chronological access. |

The Prisma `NotificationOutboxType` enum contains the following first ten
legacy storage values, which are retained but are absent from the runtime
whitelist in `lib/services/outbox/types.ts`:

```text
TICKET_CREATED
TICKET_UPDATED
TICKET_CREATED_IN_APP
TICKET_CREATED_LINE
TICKET_CREATED_EMAIL_REPORTER
TICKET_CREATED_EMAIL_IT
TICKET_UPDATED_IN_APP_REPORTER
TICKET_UPDATED_EMAIL_REPORTER
TICKET_UPDATED_LINE
TICKET_COMMENT_IN_APP
```

The active runtime whitelist begins with `EMAIL_REQUEST` and contains:

```text
EMAIL_REQUEST
LEAVE_ACTION
LEAVE_RESULT
LEAVE_CANCELLED
LEAVE_CANCELLATION_REQUESTED
LEAVE_CANCELLED_AFTER_APPROVAL
LEAVE_NOT_TAKEN_REQUESTED
LEAVE_NOT_TAKEN_CONFIRMED
LEAVE_ACTION_LINE
LEAVE_RESULT_LINE
LEAVE_CANCELLED_LINE
LEAVE_CANCELLATION_REQUESTED_LINE
LEAVE_CANCELLED_AFTER_APPROVAL_LINE
LEAVE_NOT_TAKEN_REQUESTED_LINE
LEAVE_NOT_TAKEN_CONFIRMED_LINE
STOCK_REQUEST_LINE
STOCK_LOW_LINE
STOCK_REQUEST_RESULT_EMAIL
STOCK_REQUEST_RESULT_LINE
ROUTINE_REMINDER_IN_APP
ROUTINE_REMINDER_EMAIL
ROUTINE_REMINDER_LINE
ROUTINE_CONTRACT_EXPIRY_IN_APP
ROUTINE_CONTRACT_EXPIRY_EMAIL
ROUTINE_CONTRACT_EXPIRY_LINE
```

All six outbox status values are active runtime lifecycle states. The enum
comparison is intentional: storage compatibility is broader than the current
processor whitelist. H0 does not delete any enum value.

### Processor, retry, and provider behavior

`lib/services/outbox/processor.ts` remains a global platform/composition
component. It currently:

- recovers stale `PROCESSING` rows after the configured ten-minute threshold;
- claims due `PENDING`/`FAILED` rows with attempts below the configured maximum
  of three;
- dispatches business-specific events through the public Leave, Stock, and
  Routine contracts and the deferred Email Request adapter;
- marks successful work `SENT`, stale business work `SUPERSEDED`, and
  exhausted failures `DEAD`;
- retries failures with the existing exponential delays and stores the last
  error; and
- preserves at-least-once behavior, relying on event keys, in-app dedupe keys,
  and provider retry keys for idempotency.

`lib/services/outbox/provider-key.ts` derives deterministic LINE retry keys and
email message IDs from event keys. `lib/line/**` owns generic LINE transport
and app-message eligibility/delivery; `lib/email/**` owns generic SMTP
transport and Stock result email adapter behavior. Leave, Stock, Routine, and
Email Request continue to own their channel-specific payload/message meaning.

The current lifecycle constants are `MAX_OUTBOX_ATTEMPTS = 3`, a 60-second
retry base delay, and a ten-minute stale-`PROCESSING` threshold. A normal
failure increments attempts and retries after 60 seconds for the first retry,
then 120 seconds for the second; the third failed attempt becomes `DEAD`.
Stale rows at the terminal threshold become `DEAD`; earlier stale rows become
`FAILED`, increment attempts, and are due again after the 60-second base delay.
Routine/other dispatchers may deliberately return `DEFERRED` or
`SUPERSEDED`; those outcomes remain business/platform lifecycle behavior and
must not be reinterpreted as Inbox read state.

Email transport in `lib/email/transport.ts` uses pooled Nodemailer SMTP,
checks credentials and connection readiness, reconnects on recognized transient
transport errors, and makes up to three internal send attempts before
returning `false`. The global outbox then applies the event-level retry/
dead-letter lifecycle. LINE transport in
`lib/line/messaging.ts` sends `X-Line-Retry-Key`; a successful response or a
409 with a retry key is treated as delivered. `lib/line/app-notification.ts`
skips ineligible/unlinked users and throws on provider failure so the outbox
can retry. These are channel reliability contracts, not Notification Inbox
ownership.

The cron/wakeup composition remains outside Notification:

- `app/api/cron/notification-outbox/route.ts` authenticates the configured
  secret and invokes `processOutbox()`;
- business API routes use the existing `after(() => processOutbox())` wakeup
  pattern after transaction completion; and
- Routine's scheduler cron enqueues Routine work but does not become the global
  processor.

Business-module code may persist/enqueue outbox rows as part of its own
transaction. No `modules/**` production code may import the global Outbox
Processor. For business-owned events, the global processor routes through the
producing business module's public dispatch contract; that contract may make a
narrow Notification application command call after domain composition. This is
not a transfer of processor ownership.

## Target ownership and public seam

The target ownership map is:

| Responsibility | Target owner |
| --- | --- |
| `Notification` repository and persistence adapter | `modules/notification/` Notification infrastructure/application |
| Generic create-one-to-explicit-user and deduplicated write mechanics | Notification application contract |
| Inbox latest/history queries, unread count, filter, cursor, mark-one, mark-all | Notification application contract |
| Notification-specific server DTOs and route delegation | Notification application; `app/api/notifications/**` remains HTTP delivery composition |
| Notification-specific client data contract and components | `modules/notification/client.ts` and `modules/notification/presentation/dashboard/**` |
| Leave/Stock/Routine event and recipient policy | Respective business module |
| `NotificationOutbox` row lifecycle, processor, retry, stale recovery, scheduling/wakeup | Shared/platform outbox infrastructure |
| Email/LINE transport and provider retry mechanics | Shared/platform channel infrastructure |
| Email/LINE event payload/message meaning | Respective business producer; Email Request remains deferred |
| Dashboard navbar, menu, route mounting, generic labels | App/Dashboard composition |
| Authentication/session and generic HTTP/security primitives | Existing auth/shared platform |

H1 established the smallest public Notification server contract from the
observed consumers. The evidence supports these operations, without requiring
a new business abstraction:

```text
listLatestForUser(userId) -> notifications + unreadCount
listHistoryForUser({ userId, filter?, cursor? }) -> notifications + pagination/count
markReadForUser(notificationId, userId)
markAllReadForUser(userId)
createForUserOnce(input, persistenceContext?)
```

These are the H1 public APIs from `@/modules/notification`. The create input
carries explicit `userId`, semantic `type`, title, message, optional
action/reference values, and the producer's dedupe key. It does not carry an
implicit audience query such as “all Stock admins”. Query/read commands enforce
user scope in the server/application layer regardless of caller UI. Query
results intentionally preserve the complete Prisma `Notification` row shape
currently serialized by the HTTP APIs.

For a business-owned outbox-dispatched in-app event, the global processor
continues to dispatch through the producing business module's public contract.
After domain revalidation and recipient/semantic resolution, that business
application may call `createForUserOnce` through `@/modules/notification`,
using the existing transaction context when atomic persistence is required.
The global processor continues to own claiming, retry, status, scheduling, and
channel dispatch; it does not pass a transaction client or business semantic
input directly to Notification.

## Behavioral invariants for future phases

Future H3 work must preserve these observed invariants unless a separately
approved behavior change explicitly supersedes them:

- a signed-in user can only list, count, read, or mark-read their own Inbox;
- the dropdown returns the ten newest rows ordered by descending `createdAt`
  and the unread count covers all unread rows for that user;
- the history page uses the current all/unread filter, 20-row page size,
  timestamp cursor, `hasMore`, `nextCursor`, and `totalCount` response shape;
- single-read and mark-all-read remain idempotent in their current forms;
- current 401, invalid-session 400, and sanitized 500 response behavior stays
  compatible for existing consumers/tests until a deliberate API migration;
- action URLs continue to navigate through the existing normalization and
  Dashboard route/menu mapping;
- historical Notification rows remain readable, including legacy IT enum
  values;
- non-null `dedupeKey` uniqueness and `P2002` duplicate no-op behavior remain
  available to retrying producers;
- transaction-coupled in-app creation remains atomic with the current Leave,
  Stock, and other domain state changes where it is currently coupled;
- Leave, Stock, and Routine retain workflow/event/recipient/title/message/
  action/reference/dedupe ownership;
- global outbox retry, stale-processing recovery, dead-letter, and supersede
  semantics remain unchanged;
- an in-app delivery may be outbox-backed without moving the outbox processor
  into Notification; and
- Email/LINE delivery is not made implicitly dependent on Inbox persistence or
  absorbed by Notification.

## Risks and follow-up (not H0 fixes)

- The history cursor is timestamp-only and has no stable ID tie-breaker. Rows
  sharing a timestamp can create ordering/skip ambiguity.
- The history route does not validate the cursor or reject unknown filters;
  malformed cursors currently reach a generic 500 response.
- The latest/history routes serialize Prisma results rather than a dedicated
  DTO. The browser contract consumes a narrower shape, so H1 must choose the
  compatibility surface deliberately before narrowing fields.
- The frontend history page derives its local `hasUnread` mark-all affordance
  from loaded rows, while the server has a complete unread count. This can
  produce a UI quirk when unread rows are beyond the loaded page.
- `Notification.dedupeKey` is global and nullable, not user-scoped. Existing
  producers encode user/event identity where needed, while some current Stock
  paths intentionally have no dedupe key.
- Direct Leave and Stock writes are not all expressed through the shared
  helper. H3 must preserve their transaction and audience differences rather
  than mechanically replacing every write.
- The shared admin helper filters active/non-deleted admins, while the Stock
  requester-cancellation path currently queries all admins. This is a producer
  behavior difference requiring an explicit decision, not an H0 cleanup.
- Provider side effects are at-least-once. Existing event keys, dedupe keys,
  and provider retry keys are part of reliability behavior and must not be
  weakened during migration.
- Email Request remains coupled to the current global processor and configured
  recipient lookup until the future IT boundary is approved.

## Exhaustive migration ledger

The ledger below covers every current production Notification model/API,
presentation, helper, producer, outbox, provider, test, and architecture
surface found by the H0 repository-wide audit. Grouped rows list every path or
symbol in that responsibility; grouping does not imply ownership transfer.

| Current path / symbol | Current responsibility | Current owner | Target owner | Migration action | Target phase | Notes / compatibility constraint |
| --- | --- | --- | --- | --- | --- | --- |
| `prisma/schema.prisma :: Notification` | Durable per-user inbox row, fields, relation, indexes, nullable global dedupe uniqueness | Shared Prisma schema consumed by legacy routes/helpers/producers | Notification repository/application boundary over the shared schema | H1 established repository ownership without changing the physical schema | H1 | No schema/index/migration change; retain `referenceId` as opaque. |
| `prisma/schema.prisma :: NotificationType` | Current active semantic values plus historical IT values | Shared Prisma schema; semantic values supplied by producers | Notification stores the contract; business modules own meaning | Keep enum/storage compatibility and document active vs historical values | H1/H3 | Do not remove `TICKET_CREATED`, `NEW_COMMENT`, or `TICKET_UPDATED`. Preserve `@map` values. |
| `prisma/schema.prisma :: NotificationOutbox`, `NotificationOutboxType`, `NotificationOutboxStatus` | Reliable event row, event identity, payload, lifecycle status, retry timestamps | Global platform outbox infrastructure | Global platform outbox infrastructure | Keep outside Notification; migrate only callers/contracts as approved | H3 audit only | First ten TICKET outbox values are storage-only compatibility; runtime whitelist is narrower. |
| `app/api/notifications/route.ts` `GET` | Latest ten rows plus complete unread count | App HTTP adapter | App HTTP adapter delegating through `@/modules/notification` | H1 migrated direct Prisma calls to the public Notification query | H1 | Preserve session, user scope, order, take 10, response shape, and sanitized 500. |
| `app/api/notifications/all/route.ts` `GET` | 20-row all/unread history with timestamp cursor and total count | App HTTP adapter | App HTTP adapter delegating through `@/modules/notification` | H1 migrated route query behavior behind the public contract | H1 | Preserve filter fallback, cursor shape, `hasMore`, `nextCursor`, `totalCount`; timestamp ties remain unresolved by design. |
| `app/api/notifications/[id]/read/route.ts` `PATCH` | User-scoped single mark-read | App HTTP adapter | Notification application command via app adapter | H1 moved persistence behind the public command | H1 | Preserve current 500 behavior for missing/non-owned rows unless separately approved. |
| `app/api/notifications/mark-all-read/route.ts` `POST` | User-scoped mark-all-read and count | App HTTP adapter | Notification application command via app adapter | H1 moved update behind the public command | H1 | Preserve idempotent zero count and response. |
| `__tests__/api/notifications.test.ts`; `modules/notification/application/*.test.ts`; `modules/notification/infrastructure/persistence/repository.test.ts` | Auth, public app contract, query semantics, read commands, create-once dedupe/context tests | API/module compatibility suites | Notification API/application/persistence contract suites | H1 added focused boundary coverage while preserving existing route contracts | H1 | Full cursor tie correctness remains a later approved change. |
| `modules/notification/presentation/dashboard/NotificationShared.tsx` | Browser-safe item/list types, fetcher, states, action URL normalization, badge, icon mapping | Notification client/presentation | Notification client/presentation | H2 moved implementation with local contracts | H2 (closed) | Preserve legacy Stock tab alias, disabled-tab fallback, unknown icon fallback, and client-safe graph. |
| `modules/notification/presentation/dashboard/NotificationPageParts.tsx` | History header, filters, rows, unread visual semantics | Notification client/presentation | Notification client/presentation | H2 moved with minimal behavior-preserving component contract | H2 (closed) | Preserve all/unread labels, mark-all affordance, relative time, and row navigation. |
| `modules/notification/presentation/dashboard/NotificationDropdown.tsx` | Navbar SWR polling and mutations | Notification client/presentation | Notification client/presentation; mounted by Dashboard | H2 moved implementation behind the client entry; navbar mount remains external | H2 (closed) | Preserve 60s polling, no focus revalidation/retry, 30s dedupe, toast/navigation behavior. |
| `modules/notification/presentation/dashboard/NotificationsPageContent.tsx` | History SWR, timestamp cursor append, optimistic read mutations | Notification client/presentation | Notification client/presentation | H2 moved implementation with local contracts | H2 (closed) | Preserve filter reset, append behavior, local unread quirk, and action navigation. |
| `modules/notification/presentation/dashboard/NotificationSkeletons.tsx` | Notification history loading presentation | Generic Dashboard feedback | Notification client/presentation | H2 moved the Notification-specific skeleton only | H2 (closed) | Generic skeleton primitives remain in Dashboard feedback. |
| `app/dashboard/notifications/page.tsx`, `loading.tsx` | App Router metadata, Suspense, route composition, skeleton | App/Dashboard delivery | App/Dashboard composition + Notification client entry | H2 changed imports only | H2 (closed) | Routes consume `@/modules/notification/client`; route ownership remains in `app/`. |
| `components/dashboard/layout/DashboardNavbar.tsx` | Generic navbar/user-menu composition and dropdown mount | Dashboard shell | Dashboard shell | H2 updated only the Notification mount import | H2 (closed) | Navbar remains Dashboard-owned and uses the Notification client entry. |
| `lib/ssot/routes.ts` and `constants/dashboard.ts` | API URLs, dashboard path/tab/menu metadata, generic labels | App/shared route/menu SSOT | App/shared route/menu SSOT | Keep constants stable; only add a public module adapter if needed | H1/H2 | `API_ROUTES.notifications` and `APP_DASHBOARD_TABS.notifications` are compatibility contracts, not persistence ownership. |
| `lib/services/notifications/in-app.ts :: createInAppNotificationOnce` | Generic create, optional Prisma transaction client, P2002 idempotent no-op | Transitional compatibility adapter | Notification application/infrastructure, with adapter retained for current callers | H1 converted it to a thin adapter over `@/modules/notification`; migrate callers incrementally in H3 | H1/H3 | Preserve explicit user ID, supplied semantic fields, dedupe, and transaction client support. |
| `lib/services/notifications/in-app.ts :: createAdminInAppNotificationsOnce` | Admin lookup plus repeated generic create | Mixed shared helper: persistence + audience policy | Recipient resolution in business producer; generic write in Notification | Split after consumers have explicit recipient resolution | H3 | Do not create a generic “all admins” Notification API. |
| `modules/leave/application/notifications/notifications.ts` | Leave titles/messages/types/actions/references/dedupe; in-app plus email orchestration | Leave | Leave for semantics; Notification for durable write | Replace local persistence seam with Notification public command when safe | H3 | Keep Leave payload parsing, recipient/action policy, `createInApp:false`, and email meaning. |
| `modules/leave/application/approvals/decision.ts` | Mark current Leave request notification read and enqueue result event in same tx | Leave approval workflow | Leave workflow + Notification command for persistence | Adapt read command and preserve transaction coupling | H3 | Do not move Leave state/read-supersede rules to Notification. |
| `modules/leave/application/cancellation/cancellation.ts` | Mark obsolete rows; create cancellation/rejection rows; enqueue cancellation outbox events | Leave cancellation workflow | Leave workflow + Notification command | Adapt persistence/read commands after H1 seam exists | H3 | Preserve state-specific type, recipient, action, dedupe, and atomic rollback behavior. |
| `modules/leave/application/not-taken.ts` | Create employee confirmation; mark approver row read; enqueue not-taken events | Leave not-taken workflow | Leave workflow + Notification command | Adapt persistence/read commands | H3 | Preserve request/confirm semantics and event keys. |
| `modules/leave/application/requests/create-request.ts` (`LEAVE_ACTION`), `modules/leave/application/approvals/decision.ts` (`LEAVE_RESULT`), `modules/leave/application/cancellation/cancellation.ts` (`LEAVE_CANCELLED`, `LEAVE_CANCELLATION_REQUESTED`, `LEAVE_CANCELLED_AFTER_APPROVAL`), `modules/leave/application/not-taken.ts` (`LEAVE_NOT_TAKEN_REQUESTED`, `LEAVE_NOT_TAKEN_CONFIRMED`), and `modules/leave/infrastructure/notifications/line.ts` (seven Leave `*_LINE` child types) | Transactional Leave event and channel-row enqueueing | Leave use cases + global outbox infrastructure | Leave + global outbox infrastructure | Keep transactional enqueue; only change the in-app dispatch seam | H3 | Preserve each event key, payload, child retry key, and Leave-owned meaning; the processor remains global. |
| `modules/leave/application/approvals/current-action-recipient.ts` | Claims/revalidates a Leave action during global dispatch, writes the in-app entry in the transaction, enqueues the LINE child, and sends the Leave action email through Leave-owned notification behavior after commit | Leave application + global processor composition | Leave application + Notification command + global outbox | Keep the public Leave dispatch contract; after Leave revalidation and semantic composition, call Notification through its public command | H3 | This is the canonical Outbox → Leave → Notification flow; stale/current-action supersede remains Leave-owned. |
| `modules/leave/infrastructure/notifications/line.ts` | Leave LINE child rows, payload validation, retry key, stale/current-action supersede | Leave channel composition | Leave channel composition + global outbox lifecycle | No wholesale move; keep the public Leave channel dispatch contract | H3 audit | LINE is not Notification inbox ownership. |
| `modules/leave/index.ts`, `modules/stock/index.ts`, `modules/routine/index.ts` | Public business dispatch contracts consumed by the global processor | Respective business modules | Respective business modules + global processor composition | Keep explicit public business dispatch contracts; do not expose Notification internals through them | H3 audit | Cross-boundary calls use module public entries; no business module imports the processor. |
| `modules/stock/infrastructure/notifications/notifications.ts` | Stock requester/admin/low-stock in-app semantics; result email/LINE and low-stock/new-request outbox enqueue | Stock | Stock for semantics/recipients; Notification for generic write; global outbox for delivery | Resolve explicit recipients, then adapt generic writes | H3 | Preserve no-dedupe paths, admin filtering differences, request refs, URLs, and transaction boundaries. |
| `modules/stock/application/requests/request-creation.ts`, `request-mutations.ts`, `item-mutations.ts` | Atomic Stock state changes plus in-app/outbox notification composition | Stock application | Stock application + public Notification command + global outbox | Keep business transaction; replace only persistence internals after seam | H3 | No producer refactor in H0; low-stock in-app/outbox pairing remains atomic. |
| Stock outbox sites in `infrastructure/notifications/notifications.ts` | `STOCK_REQUEST_LINE`, `STOCK_LOW_LINE`, `STOCK_REQUEST_RESULT_EMAIL`, `STOCK_REQUEST_RESULT_LINE` rows | Stock + global outbox | Same | Keep enqueue payload/event/retry semantics; retain public Stock dispatch contracts | H3 audit | Provider/channel meaning stays Stock-owned. |
| `modules/stock/infrastructure/notifications/line-notifications.ts` | Claims Stock LINE rows, validates current request/stock state, supersedes unavailable work, and delegates provider delivery | Stock channel composition + global outbox lifecycle | Stock channel composition + global outbox lifecycle | Keep as a public Stock channel dispatch contract; do not move to Notification | H3 audit | LINE delivery and Stock state validation are not Inbox ownership. |
| `modules/routine/application/recipients.ts` | Active assignee/admin/user and linked LINE recipient policy | Routine | Routine | No move; Notification accepts explicit IDs only | H3 audit | Never reproduce Routine audience selection in Notification. |
| `modules/routine/application/scheduler.ts` | Due reminder scheduling and `ROUTINE_REMINDER_IN_APP` enqueue | Routine scheduler | Routine + global outbox | Keep scheduler/event key; adapt eventual in-app dispatch | H3 | Scheduler does not import processor and remains Routine-owned. |
| `modules/routine/application/reminders.ts` | Revalidation, defer/supersede, in-app persistence, email/LINE child enqueue/dispatch | Routine | Routine semantics + Notification write + global outbox | Keep public Routine processor contract; replace generic write after H1 | H3 | In-app delivery through outbox is a required compatibility case. |
| `modules/routine/application/contract-reminders.ts` | Contract due scheduling, in-app persistence, email/LINE child dispatch | Routine | Routine semantics + Notification write + global outbox | Same as reminders | H3 | Preserve end-date event key and user-specific dedupe. |
| `modules/routine/application/mutations.ts` | Supersedes child outbox rows when Routine task is deleted | Routine lifecycle | Routine lifecycle + global outbox status update | No move to Notification | H3 audit | Supersede is domain lifecycle behavior, not generic inbox behavior. |
| `modules/routine/index.ts` and Routine public reminder/contract dispatch exports | Public Routine scheduler/dispatch contracts used by app cron and global processor | Routine | Routine + app/platform composition | Keep public entry; migrate only the inner in-app persistence call | H3 audit | Recipient resolution and current-task validation remain Routine-owned. |
| `lib/services/email-request/notifications.ts` | Configured email audience lookup and `SYSTEM_ALERT` in-app semantic payload | Email Request transitional capability | Deferred Email Request/IT capability + Notification generic write | Leave in place until IT boundary decision; later adapt explicit recipients | Deferred; not H1 | Do not migrate or redesign Email Request in H0/H1. |
| `lib/services/email-request/mutations.ts`, `app/api/email-request/route.ts` | Transactional Email Request outbox, idempotency, admin delivery/wakeup | Email Request transitional path + app | Deferred IT capability + global outbox/app | Preserve current path until approved IT migration | Deferred | Department remains requester-provided free text/snapshot. |
| Legacy `TICKET_*` Notification and NotificationOutbox values | Readability of historical IT Support rows | Shared schema/storage compatibility | Shared schema/storage compatibility | Retain; add no producers and do not restore module | H3 final audit | Delete only in a separately approved data-compatibility decision. |
| `lib/services/outbox/types.ts` | Runtime whitelist, status list, max attempts and stale threshold | Global platform outbox | Global platform outbox | Keep outside Notification; document enum/storage difference | H3 audit | Current whitelist intentionally excludes legacy TICKET values. |
| `lib/services/outbox/processor.ts` | Claim, stale recovery, retry/backoff/dead, supersede, dispatch composition | Global platform outbox | Global platform outbox | Do not move; later business dispatch contracts may add a narrow Notification public call after domain composition | H3 | The processor routes business-owned events through public business contracts; business modules and Notification must not own/import this processor. |
| `app/api/cron/notification-outbox/route.ts`; `app/api/email-request/route.ts`; `app/api/leave/request/route.ts`, `decision/route.ts`, `cancel/route.ts`, `not-taken/route.ts`; `app/api/line/leave/request/route.ts`, `decision/route.ts`, `cancel/route.ts`, `not-taken/route.ts`; `app/api/stock/requests/route.ts`, `requests/[id]/issue/route.ts`, `requests/[id]/review/route.ts`, `items/[id]/adjust/route.ts`; `app/api/line/stock/requests/route.ts`, `requests/[id]/issue/route.ts` | Secret-gated processor execution and post-transaction `after(() => processOutbox())` wakeups | App/platform composition | App/platform composition | Keep unchanged while module contracts migrate | H3 audit | These routes wake the global processor; no route becomes Notification-owned merely by delivering an event. |
| `lib/services/outbox/provider-key.ts` | Deterministic LINE retry keys and email message IDs | Global platform outbox/provider infrastructure | Global platform outbox/provider infrastructure | Preserve derivation and provider idempotency | H3 audit | Keys are not inbox dedupe keys. |
| `lib/email/**`, `lib/line/**` | Generic SMTP/LINE transport, eligibility, provider retries, legacy adapters | Shared/platform channel infrastructure | Shared/platform channel infrastructure | No move to Notification; preserve channel-specific caller contracts | H3 audit | Business modules still choose channels and compose event meaning. |
| `modules/notification/presentation/dashboard/NotificationShared.test.tsx`, `__tests__/components/DashboardNavbar.test.tsx` | Notification icon/URL/badge semantics and Dashboard shell integration | Notification presentation + Dashboard shell tests | Split Notification client tests from shell tests | H2 moved Notification tests and updated only the Navbar mock boundary | H2 (closed) | Preserve mappings and prove navbar composition separately. |
| `__tests__/api/notification-outbox-cron.test.ts`; `__tests__/services/outbox/processor.test.ts`, `routine-processor.test.ts`, `app-line-processor.test.ts`, `provider-key.test.ts` | Cron secret boundary, global claim/retry/dead, producer dispatch ordering, child delivery, provider keys | Global outbox/provider tests | Global outbox/provider tests | Keep outside Notification; add contract tests only when seam changes | H3 | Tests prove wakeup security, in-app-before-failed-channel, and at-least-once behavior. |
| `modules/leave/application/notifications/notifications.test.ts`, `modules/leave/infrastructure/notifications/line.test.ts`, `modules/stock/__tests__/notifications.test.ts`, `modules/stock/__tests__/mutations.test.ts`, `modules/stock/__tests__/line-notifications.test.ts`, `modules/routine/application/reminders.test.ts`, `contract-reminders.test.ts`, `scheduler.test.ts`, `delete.test.ts` | Business recipient, payload, transaction, dedupe, supersede, and channel behavior | Respective feature test suites | Respective feature suites plus Notification contract tests | Preserve behavior; extend for public seam during H3 | H3 | Do not move business tests into a god Notification suite. |
| `__tests__/api/leave-request.test.ts`, `leave-decision.test.ts`, `leave-cancel.test.ts`, `leave-not-taken.test.ts`, `stock-requests-routes.test.ts`, `line-stock-routes.test.ts`, `line-leave-routes.test.ts`, `email-request.test.ts`, and `__tests__/integration/email-request-idempotency.integration.test.ts` | API transaction/wakeup/idempotency evidence around notification-producing use cases | App/feature compatibility suites | Same feature/API suites | Preserve and extend only for an approved public seam | H3 | These tests prove producer behavior; they are not grounds for moving producer semantics into Notification. |
| `__tests__/architecture/check-architecture.test.ts`, `scripts/check-architecture.mjs`, `modules/README.md`, `docs/architecture/*.md` | Import/dependency and ownership rules | Architecture documentation/checker | Architecture rules + Notification record | H1 server rules remain; H2 adds client-entry composition, deleted-path, self-barrel, client-graph, and client-to-server reachability rules | H2 (closed) | Full `prisma.notification` exclusivity remains deferred until H3 producer migration. |
| `modules/notification/index.ts`, `application/**`, `infrastructure/persistence/**` | Server/application Notification contract and durable Inbox persistence | H1 Notification module | Notification capability | H1 established public queries/commands, repository ownership, timestamp pagination, and transaction-aware create-once persistence | H1 (closed) | H2 left the server boundary unchanged; business producer integration remains H3. |

## Explicit H0 non-goals

H0 does not:

- create or move production Notification implementation;
- create `modules/notification/`;
- rewrite `app/api/notifications/**`, response contracts, pagination, polling,
  or read behavior;
- move Dashboard Notification components or modify Dashboard shell behavior;
- change Prisma models, enums, indexes, migrations, generated files, or
  stored-history compatibility;
- refactor Leave, Stock, Routine, or Email Request producers;
- restore IT Support or remove legacy IT values;
- move the global outbox processor, retry lifecycle, scheduling/wakeup, Email,
  or LINE infrastructure;
- introduce tenant/Organization behavior, speculative abstractions, or
  unrelated business cleanup; or
- change runtime behavior for any capability.

## Subsequent implementation slices

### H1 — Notification Server/Application Ownership (CLOSED)

H1 established `modules/notification/` with the smallest evidence-backed
server boundary:

- `index.ts` is the only supported server/application entry and exposes the
  latest/history queries, mark-one/mark-all commands, and generic
  `createForUserOnce` command;
- `application/**` owns the query/command semantics while
  `infrastructure/persistence/**` owns the Prisma `Notification` operations;
- all four `app/api/notifications/**` routes remain HTTP/auth adapters and now
  delegate through `@/modules/notification`;
- `createInAppNotificationOnce` is a compatibility adapter over the public
  create command, while `createAdminInAppNotificationsOnce` retains its
  transitional admin audience lookup outside Notification; and
- the public create command preserves the narrow transaction-bound persistence
  context and treats existing `P2002` dedupe conflicts as idempotent no-ops.

H1 preserved the full Prisma-serialized response rows, current filter and
timestamp-cursor behavior, user scoping, error compatibility, and zero-count
mark-all behavior. It did not change the Prisma schema, business producer
writes, NotificationOutbox, global processor, Email/LINE behavior, or
Notification presentation. The timestamp-only cursor tie risk remains
intentionally unresolved. Email Request/IT remains deferred; H2 subsequently
moved presentation ownership and H3 owns producer integration and
compatibility cleanup.

For outbox-originated writes, H1 preserves the canonical
Outbox → business dispatch contract → business/application semantics →
Notification command flow. The global processor remains unchanged and is not a
direct Notification caller in current or H1 code.

### H2 — Notification Presentation Ownership

H2 moved Notification-specific Dashboard presentation to
`modules/notification/presentation/dashboard/**` behind the minimal
browser-safe `modules/notification/client.ts` surface. The public surface is
limited to `NotificationDropdown`, `NotificationsSection`, and
`NotificationSectionSkeleton`; page parts, browser contracts, row/state
components, and fetcher implementation remain internal. The old
`components/dashboard/notifications/**` path was removed after the consumer
audit. The Notification-specific history skeleton moved out of generic
Dashboard feedback, while generic skeleton primitives stayed in Dashboard.

The notification page and loading route consume `@/modules/notification/client`.
`DashboardNavbar` remains Dashboard-owned and mounts the dropdown through the
same client entry. H2 preserves HTTP API access, SWR/polling, filters, the
timestamp cursor behavior, action URL normalization, icon mapping,
unread/read UX, Thai wording, accessibility, and loading/error/empty states;
it does not redesign UI or change the H1 server boundary.

H2 guardrails require the route and navbar composition entries, reject deleted
legacy presentation imports and Notification self-barrel imports, walk the
Notification client graph for server-only dependencies, and reject production
client reachability of `@/modules/notification`. Full Notification Prisma
exclusivity and producer migration remain H3 work.

### H3 — Producer Integration, Compatibility Cleanup, and Final Audit

Migrate generic in-app persistence consumers to the Notification public
contract while leaving Leave, Stock, Routine, and future IT semantics in their
business modules. Split mixed helpers such as generic persistence plus admin
audience resolution, preserve transaction coupling, add/strengthen targeted
architecture guardrails, and remove only proven obsolete Notification
compatibility paths. Email Request/IT ownership remains explicitly deferred if
the IT capability is not ready; H3 must not force a duplicate migration.

## H0 closure

The verified boundary is intentionally asymmetric: Notification owns the
in-app Inbox capability and generic durable write mechanics; business modules
own notification meaning and recipients; the global platform owns reliable
outbox delivery and provider composition; Dashboard owns generic composition.
This is the minimum boundary that lets H1 migrate the Inbox without absorbing
Leave, Stock, Routine, Email/LINE, Email Request, or the global Outbox
Processor.

**Phase H0 CLOSED — Notification discovery and boundary definition complete.**

**Phase H1 CLOSED — Notification server/application ownership complete.**

**Phase H2 CLOSED — Notification presentation ownership complete.**

H3 remains open/not started. Timestamp-only history cursor ambiguity remains an
unresolved compatibility risk. Email Request/IT remains deferred, and the
global Outbox Processor plus Email/LINE delivery remain outside Notification.
