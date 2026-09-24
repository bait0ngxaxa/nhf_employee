# IT Module Architecture and Domain Contract

Status: **IT0 CLOSED; IT1 foundation and authorization contract CLOSED.** The `modules/it` server boundary, role-neutral authorization adapter, five Dashboard-only capabilities, Administration metadata, requester resource policy, and assignee eligibility contract are implemented. Ticket persistence, routes, UI, and notification producers do not exist. Product questions marked OPEN must be answered before the slice that depends on them. Current implementation wins over older phase documents.

## 1. Product scope and terminology

**LOCKED.** `modules/it` will own IT support work, its business policy, Ticket history, IT-specific notification meaning, analytics queries, and the existing structured Email Request business capability after a compatibility migration. Employee self-service includes incident reports, general service requests, suggestions, own-ticket tracking, and conversation. Operators with configured authority get the full queue, processing, assignment, classification, and reporting. Initial channel is `DASHBOARD`; LIFF is an open product requirement.

| Term | Meaning |
| --- | --- |
| IT Ticket | A single requester's support work item with a lifecycle and conversation. It is not a formal ITIL Problem. |
| `INCIDENT` | Something broken, unavailable, degraded, or incorrect. |
| `SERVICE_REQUEST` | IT action, provisioning, or configuration requested. |
| `SUGGESTION` | Improvement, feedback, or an opportunity that is not an incident. |
| Requester | The authenticated `User` that created the Ticket; immutable ownership. |
| Assignee | Zero or one currently responsible active `User`; null means unassigned. |
| Team | Authorization grouping and grant origin. It is not a Department or necessarily an assignment queue. |
| Department | Employee reference data and possible historical reporting dimension; never authority. |

The three types express why the work exists. They do not create three unrelated workflow engines. General service requests use the Ticket type; the existing Email Request retains its structured provisioning data and compatibility contract.

## 2. Repository evidence and authority

| Evidence | Current finding / consequence |
| --- | --- |
| [`modules/README.md`](../../modules/README.md), [module boundaries](./module-boundaries.md), [dependency rules](./dependency-rules.md), [K0/K1 audit](./final-repository-audit.md) | Business ownership belongs under `modules/<feature>`, with `index.ts` server and `client.ts` browser entries. Email Request was deliberately deferred to future IT; outbox and generic Dashboard shell remain shared. |
| [`modules/authorization/contracts.ts`](../../modules/authorization/contracts.ts), [`registry.ts`](../../modules/authorization/registry.ts), [`application/resolver.ts`](../../modules/authorization/application/resolver.ts), [`composition.ts`](../../modules/authorization/application/composition.ts), [`evaluator.ts`](../../modules/authorization/application/evaluator.ts), [`application/seed.ts`](../../modules/authorization/application/seed.ts) | Actor carries trusted `userId`, optional `employeeId`, `systemRole`, channel; resolver evaluates configured Team, TeamRole, User grants. Domain default scopes are composed separately. `systemRole` is not business authority. IT1 registers domain `it` and its five approved capabilities. `AUTHORIZATION_SEED_CONFIGURATION` remains empty until a production mapping is explicitly approved. |
| [authorization current state](./authorization-current-state.md), [contract](./authorization-contract.md), [resolver](./authorization-resolver.md), [12H-C](./authorization-phase-12hc-domain-default-policy-rebaseline.md), [12H-G](./authorization-phase-12hg-enforcement-cutover-security-regression.md), [12H-I](./authorization-phase-12hi-compatibility-debt-removal.md) | The current role-neutral model supersedes historical ADMIN compatibility descriptions. Default Domain Policy plus configured authority is additive. Unknown capabilities, unsupported channels, and malformed grants fail closed. |
| [`prisma/schema.prisma`](../../prisma/schema.prisma), [`lib/auth/workforce.ts`](../../lib/auth/workforce.ts) | `User.id` and `Employee.id` are Int; User has optional Employee identity. Active workforce requires active, non-deleted User and active, non-deleted Employee. Existing Email Request references User and stores free-text Department. |
| [Notification migration](./notification-migration.md), [Audit migration](./audit-migration.md), [`modules/notification/index.ts`](../../modules/notification/index.ts), [`modules/audit/index.ts`](../../modules/audit/index.ts), [`lib/services/outbox/processor.ts`](../../lib/services/outbox/processor.ts) | Inbox, Audit, and outbox have separate owners. Historical Ticket enum values survive without a Ticket production dispatcher. |
| [`app/api/email-request/route.ts`](../../app/api/email-request/route.ts), [`lib/services/email-request`](../../lib/services/email-request), [`app/dashboard/email-request/page.tsx`](../../app/dashboard/email-request/page.tsx) | Email Request is active and fragmented; its API, presentation, persistence, delivery, and compatibility contracts need a later coordinated migration. |
| [`modules/leave/infrastructure/attachments/storage.ts`](../../modules/leave/infrastructure/attachments/storage.ts), [`app/api/leave/attachments/[attachmentId]/route.ts`](../../app/api/leave/attachments/%5BattachmentId%5D/route.ts), [`app/api/uploads/[...path]/route.ts`](../../app/api/uploads/%5B...path%5D/route.ts) | Leave has a private, authorized file pattern. Stock uploads are intentionally public and unsuitable for Ticket evidence. |

The repository's local Next.js route-handler documentation was also checked at `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`; App Router routes remain delivery adapters.

## 3. Bounded context and dependency contract

```text
Dashboard shell / App Router pages / app/api adapters
                         |
                         v
                 modules/it public entries
                 | Ticket domain + application
                 | structured Email Request (after IT8)
                 | analytics queries + IT presentation
                         |
       +-----------------+------------------+
       |                 |                  |
 authorization public  Employee/Department public  Notification/Audit public
       |                                    |
       +----- shared persistence/outbox infrastructure ----+
```

**LOCKED.** IT owns Ticket aggregate rules, Ticket repository, conversation, event timeline, category semantics, IT notification recipient/payload policy, reporting definitions, and later Email Request business code. `app/api/**` owns HTTP/session adaptation; Dashboard owns shell, navigation, route composition; Auth owns sessions and account identity; Employee/Department own workforce and Department lookup; Authorization owns registry/resolver/grants; Notification owns Inbox persistence; Audit owns security history; shared outbox owns reliable delivery; generic SMTP/LINE remain transport. IT uses supported public entries or narrow structural ports, never another module's internals. IT1 starts with the application contracts and `index.ts` server entry that it needs; it has no browser entry until a real browser consumer exists.

## 4. Ticket aggregate and persistence concept

**LOCKED conceptual model; physical Prisma shape deferred to IT2.** Use `ITTicket` as the aggregate root. Follow repository Int/autoincrement business-record convention unless an API or import requirement later proves a different identifier necessary; do not reuse the dropped legacy `tickets` table or its IDs implicitly. Keep references to `User.id` as authoritative `requesterUserId` and nullable `assignedToUserId`. `requesterEmployeeId` is not needed for authorization or ownership: the User→Employee link can change and may be absent. If reporting needs stable employee identity, decide whether to snapshot it separately, rather than creating two competing owners. A nullable Department ID/name snapshot is the justified historical reporting candidate below.

| Concept | Minimum durable data / invariant |
| --- | --- |
| `ITTicket` | id, type, title, description, status, requesterUserId, nullable assignedToUserId, nullable categoryId, createdAt, updatedAt; optional priority and response/resolution/closure timestamps as decided below. Requester/type/creation time immutable. |
| `ITTicketCategory` | id, stable unique key, name, isActive. Category is reference data, not a hardcoded operational enum. Inactive categories remain readable on historical tickets. No initial category administration capability is justified. |
| `ITTicketComment` | id, ticketId, authorUserId, body, createdAt; requester and operator messages visible to both sides. Immutable after posting unless an explicit correction/moderation requirement is approved. No private/internal note flag by default. |
| `ITTicketEvent` | id, ticketId, actorUserId (nullable only for a genuinely trusted system event), kind, old/new structured values where relevant, occurredAt, monotonic ordering key. Append with the state change in the same transaction. |
| `ITTicketAttachment` | Only if approved for the first relevant slice: id, ticketId, uploaderUserId, private storage key, sanitized original name, validated media type, size, createdAt. Metadata and file lifecycle must be coordinated. |

Use restrictive FK behavior or soft lifecycle retention for Ticket and history; cascading deletion of operational history through User/Employee removal would break traceability. Preserve historical display identity with minimal actor/requester display snapshots if account deletion or renaming can remove meaningful names; define retention and minimization before implementing. Query indexes should serve `(requesterUserId, createdAt, id)`, `(status, createdAt, id)`, `(assignedToUserId, status, createdAt)`, `(type, createdAt)`, `(categoryId, createdAt)`, event `(ticketId, occurredAt, id)`, and comment `(ticketId, createdAt, id)` as actual query plans require. Category/status/priority and Department reporting indexes should be added from verified query shapes, not a speculative index per column. Growing queues use stable cursor ordering `(createdAt, id)`; aggregates start as transactional-data queries, without precomputed tables.

Do not hard delete Tickets in normal operation. `CLOSED` and `CANCELLED` represent lifecycle outcomes, not physical deletion. A future legal deletion/retention policy is separate.

## 5. Workflow, assignment, conversation, classification

**LOCKED core transitions** (assuming an active eligible actor and domain resource authorization):

```text
OPEN --operator starts--> IN_PROGRESS
IN_PROGRESS --operator requests information--> WAITING_REQUESTER
WAITING_REQUESTER --requester replies or operator resumes--> IN_PROGRESS
IN_PROGRESS --operator resolves--> RESOLVED --authorized closure?--> CLOSED

OPEN / IN_PROGRESS / WAITING_REQUESTER / RESOLVED --cancellation?--> CANCELLED
RESOLVED / CLOSED --reopening?--> IN_PROGRESS
```

| Transition / action | Actor and rule | Contract status |
| --- | --- | --- |
| Create → `OPEN` | Active eligible workforce with `it.ticket.create / OWN`; server sets requester. | LOCKED |
| `OPEN → IN_PROGRESS`, `IN_PROGRESS → WAITING_REQUESTER`, `IN_PROGRESS → RESOLVED` | Operator with `it.ticket.manage / ALL`; require current-state predicate. | LOCKED |
| `WAITING_REQUESTER → IN_PROGRESS` on requester reply | A requester with comment OWN may reply; whether that reply automatically resumes work is unresolved. An operator with manage ALL may explicitly resume. | OPEN automatic-resume policy |
| `RESOLVED → CLOSED` | `RESOLVED` means IT states a solution was supplied; `CLOSED` means final handling is complete. Closure actor/timing are OPEN. | OPEN |
| Cancellation | Whether requester may cancel; eligible states; operator cancellation authority/reason are OPEN. No unrestricted status write. | OPEN |
| Reopening | Whether resolved or closed tickets can reopen, who may do so, and time window are OPEN. | OPEN |
| Terminal handling | `CLOSED`/`CANCELLED` reject ordinary status mutation and comments unless reopening/exception policy is explicitly approved. | LOCKED default |

`WAITING_REQUESTER` is an active unresolved state, entered only when a requester response is needed; it is not a notification delivery state. Store entering/leaving timestamps as events so accumulated wait time survives multiple cycles. A status filter cannot manufacture authority. Assignment starts null (`UNASSIGNED`); `ASSIGNED` means a non-null User reference, whose current eligibility may later change. Only manage ALL may issue assignment mutations, and each selected assignee must satisfy the IT assignee eligibility contract. **IT1 locks that contract as active workforce plus configured `it.ticket.read / ALL`, `it.ticket.comment / ALL`, and `it.ticket.manage / ALL`.** Each capability is independent; defaults, including read/comment OWN, do not count as configured operator authority, and analytics is not required. The rule is a pure evaluator so IT2 can re-check it alongside transaction-aware authorization and current workforce lifecycle. Do not create `it.ticket.assignable` without a new requirement. Team name, TeamRole name, Department and job title never determine eligibility. Whether exactly one assignee suffices is OPEN; design one nullable assignee for the first slice. When an assignee later becomes inactive, retain the historical User reference and require a visible reassignment/unassignment path; do not silently transfer work.

Requesters with `it.ticket.comment / OWN` may comment only on their own authorized, commentable Ticket. Operators with comment ALL may respond on visible tickets. Requester comments are not IT's first response; the first qualifying operator comment (or an explicitly defined operator response action) sets `firstRespondedAt` once. Whether an operator's status/assignment alone counts as first response is OPEN. Internal IT-only notes require a distinct visibility/authorization model and are OPEN, so they are not part of the initial schema.

Priority candidates are `LOW`, `NORMAL`, `HIGH`, `URGENT`. If included in MVP, default authoritative priority to `NORMAL`, and allow only manage ALL to change it. Requester urgency may be collected as separate input only after a product decision; never treat it as operational priority. Record priority changes in the timeline. A formal impact×urgency matrix and SLA engine are outside scope. Category may be null until classified; operator manages classification, while category reference maintenance can initially be deployment/configuration managed without a new capability.

## 6. Business timeline and Audit

**LOCKED.** Ticket history is an operational record, separate from `AuditLog`. Durable events are needed for `CREATED`, `ASSIGNED`/`UNASSIGNED` (old/new assignee), `STATUS_CHANGED` (old/new, including resolution, closure, waiting, cancellation and any reopening), `PRIORITY_CHANGED`, and classification changes if categories can change. A comment row itself is durable; a separate `COMMENTED` event is useful only if one merged timeline cannot safely union comments and events with stable ordering. Decide the exact timeline representation at IT2/IT5; do not duplicate comment body in event payload. Derive `RESOLVED`, `REOPENED`, and `CLOSED` display labels from status transitions unless distinct business meaning is required. Assignment, status, priority and comment writes need actor, timestamp and ordered identity; event rows are append-only and committed with their mutation. `createdAt` is the first creation time; `resolvedAt` should mean latest current resolution (clear/recompute on reopen) while historical resolution cycles remain in events; `closedAt` is set only on final closure. Do not infer first response or waiting duration from `updatedAt`.

`ITTicketEvent` answers operational questions and feeds analytics. `AuditLog` records security/accountability evidence and follows [`modules/audit`](../../modules/audit) public commands. Audit important IT actions: creation, assignment/reassignment, state changes including cancellation/reopen/closure, and privileged changes to priority/category; comment creation may be audited for accountability if policy requires it, without duplicating message text or sensitive attachments in Audit details. Audit write reliability must match the chosen action's security requirement: use a transaction-aware Audit command where rollback together is required; otherwise document best-effort separately. Never use Audit as the Ticket event store or expose Audit rows as the requester timeline.

## 7. Authorization and resource policy

```text
Normal active workforce → IT Default Domain Policy → OWN Ticket resources
Configured Team / TeamRole / direct User grants
    → central Authorization Resolver → composed IT scopes
    → IT-owned query/resource/workflow policy → permitted operation
```

**LOCKED; IT1 IMPLEMENTED.** The IT server adapter builds a trusted `AuthorizationActor` with the Dashboard channel, resolves through `@/modules/authorization`, then composes IT's role-neutral Default Domain Policy. The current [`lib/auth/workforce.ts`](../../lib/auth/workforce.ts) active workforce boundary is the eligibility model: active, non-deleted User with active, non-deleted Employee. Explicitly assess any necessary exception for active account without Employee before release; the approved requirement says eligible application users broadly, not external customers. `systemRole`, Department, job title, Team/TeamRole names and client fields grant nothing. Team grants, TeamRole grants and exceptional direct User grants are configured authority; Team membership is not Ticket assignment. `TEAM` scope is omitted because no Ticket→Team resource relationship is approved.

| Capability | Scope | Meaning / decision |
| --- | --- | --- |
| `it.ticket.read` | `OWN`, `ALL` | Own Ticket list/detail versus complete operator queue. |
| `it.ticket.create` | `OWN` | Create with server-bound requester identity; OWN means self submission. |
| `it.ticket.comment` | `OWN`, `ALL` | Post in visible commentable Ticket; resource relationship checked by IT. |
| `it.ticket.manage` | `ALL` | Assignment, state, category, priority. No per-button capabilities. |
| `it.analytics.read` | `ALL` | Operational aggregates, protected independently from broad Ticket read. |

This vocabulary is sufficient for the approved Ticket operations; it does not replace existing `email.request.read / OWN|ALL` and `email.request.create / ALL`, which are active contracts. Email Request capability migration/reinterpretation is an IT8 decision with compatibility tests, not an automatic grant from new Ticket capabilities. No capability or grant is added in IT0.

Default Domain Policy should supply `read/create/comment / OWN` to every eligible Dashboard workforce actor, for both USER and ADMIN system roles. `manage` and `analytics.read` have no default. The policy is composed with the resolver decision through the current public `composeAuthorizationAuthority`; a resolver denial for unknown capability, unsupported channel, or invalid configuration cannot be rescued by defaults. The recipient helper `findActiveUsersWithConfiguredCapabilityScope` enumerates **configured** authority only; it does not enumerate Default Domain Policy recipients. Use it for explicitly configured operator audience only where the business event requires that audience, then apply IT lifecycle/recipient rules. Team, TeamRole and direct User grants remain supported by the central model, but the repository intentionally seeds no authorization policy until an explicit mapping is approved. IT1 must not seed or infer an IT Team, IT TeamRole, membership, grant, or Department→Team mapping. Any example IT operator grants are vocabulary illustrations only; activating them requires later explicit configuration through Authorization Administration against an approved real-user mapping. Administration's names are labels, not policy.

At query level, `OWN` is `requesterUserId = actor.userId` and `ALL` may remove that predicate; never fetch all then filter in UI. Apply the same predicate to detail, comments, attachments, counts, search, export and notification deep links. `manage / ALL` is required for operator mutation even if the operator owns the Ticket; `comment / ALL` does not imply manage. Requested view (`mine`/`all`) may narrow a query but never widen effective scopes. Re-resolve current authority and active workforce before sensitive mutation, and inside the transaction when a stale grant or relationship would create an unacceptable race; use conditional state/version updates for concurrent operators. Query and resource checks remain server authoritative, including direct API access. Return sanitized 403/404/409 outcomes without leaking another user's Ticket existence or SQL details. Inactive requesters retain historical Tickets but lose access until eligible again; configured operator grants cannot bypass workforce eligibility. An inactive assignee remains visible as historical assignment until IT changes it.

## 8. Attachments and storage

**LOCKED boundary; rollout timing OPEN.** Ticket files are private. [`lib/uploads/local.ts`](../../lib/uploads/local.ts) and public [`/api/uploads/[...path]`](../../app/api/uploads/%5B...path%5D/route.ts) serve Stock images with public immutable caching; never place Ticket files there. Leave's private `.uploads/private` pattern demonstrates size/type validation, random safe keys, contained-path checks, cleanup, authorized download, `private, no-store`, and `nosniff`. Its implementation is Leave-owned and must not be imported by IT. At the attachment slice, reuse only neutral storage primitives if extracted for a real common responsibility, otherwise implement a small IT-owned private storage adapter. Download sequence: authentication and active workforce → Ticket OWN/ALL resource check → attachment belongs to Ticket → storage-key validation → private read. Upload must validate actual file content, type, size/count limits, and associate metadata with the Ticket; database/file failure recovery needs cleanup or orphan reconciliation. See [Leave attachment deployment notes](../leave-attachments-deployment.md) for current local persistent-volume assumptions. Whether screenshots only or general files are accepted is OPEN.

## 9. Notification and outbox contract

```text
IT business event → IT-owned reason, audience, content, channel, destination,
                    dedupe/supersede policy
                  ├→ Notification public create command (Inbox)
                  └→ shared NotificationOutbox (reliable async delivery)
                       → global processor → IT public dispatch contract
                       → Notification public command and/or generic SMTP/LINE
```

**LOCKED.** IT decides requester/operator/assignee recipients per event and excludes self-notification when appropriate. Candidate semantic events: new Ticket to configured operator audience, assignment to assignee, state change/resolution to requester, operator reply to requester, requester reply to current assignee or configured operator audience. These are design candidates; channel matrix and exact audience for unassigned work are OPEN. Persist event/outbox intent with the Ticket mutation when loss would matter; use stable event-specific keys and channel-specific dedupe. The public Notification command creates an Inbox row for explicit User IDs; it does not decide IT meaning. The shared processor owns claim/retry/dead-letter and must call an IT public dispatch contract for IT payload interpretation. IT must not import the processor. Generic SMTP/LINE transport stays outside IT; any IT-specific template belongs to IT. Never select all users through default self-service authority as an operator notification audience. Historical `TICKET_*` values do not authorize reuse or duplicate new enum names; choose compatibility strategy against stored payloads and current processor before IT6.

## 10. Analytics and Department history

**LOCKED source strategy.** Start from Ticket rows, timestamps, comments and Ticket events with query-level aggregation. No materialized/precomputed table without measured need. All operational analytics require `it.analytics.read / ALL` and active workforce. Period/timezone, handling reopened cycles, and definition of “resolved” are OPEN; preserve raw history so definitions can change without losing facts.

| Metric | Authoritative source | Required history | Definition status |
| --- | --- | --- | --- |
| Current open backlog; oldest unresolved | Current status plus createdAt; exclude CLOSED/CANCELLED and define whether RESOLVED counts | No for snapshot; events for past as-of views | OPEN for RESOLVED inclusion |
| New tickets | createdAt | No | LOCKED event count; period OPEN |
| Resolved tickets; created vs resolved trend | Status transitions to RESOLVED; current resolvedAt only for current cycle | Yes for reopening and historical periods | OPEN whether count transitions or distinct Tickets |
| By status/type/category/priority | Current Ticket fields | No for current snapshot; events for historical classification | LOCKED snapshot, historical trend OPEN |
| Average first response | createdAt → firstRespondedAt, set on first qualifying IT response | Comment/response record to prove timestamp | OPEN qualifying response and business-hours rule |
| Average resolution | createdAt → resolution transition(s) | Yes for reopened cycles; current resolvedAt sufficient only for current cycle | OPEN first/latest/final cycle and cancelled handling |
| Waiting requester duration | Enter/leave WAITING_REQUESTER transitions | Yes | LOCKED elapsed-time source; reporting treatment OPEN |
| Reopen count | RESOLVED/CLOSED → IN_PROGRESS transitions if enabled | Yes | OPEN until reopen policy approved |
| Workload by assignee; unassigned backlog | Current assignedToUserId plus status | Events for historical assignment/workload | LOCKED current snapshot; historical interval OPEN |
| By requester Department | Creation-time Department snapshot | No for creation cohort; event only if historical Department correction is allowed | LOCKED snapshot direction |

At creation, resolve Department from the authenticated User's current Employee and Department through supported Employee/Department contracts or a narrow structural projection. The current public `findCurrentEmployeeProjection()` exposes `departmentName` but not `departmentId`, so IT2 must add a narrow public projection or transaction-aware lookup before claiming ID-plus-name atomic capture; IT must not import Employee persistence internals. Store nullable `requesterDepartmentId` (reference if feasible) **and** `requesterDepartmentNameSnapshot` for stable historical display; the name survives Department rename/deletion and the ID supports current-reference grouping. If no Employee/Department is available, keep both null and report “unknown”; do not guess from title/form input. A later Department move must not rewrite the Ticket's creation cohort. Avoid copying more personal data than reporting needs and define retention with Ticket retention. Existing Email Request's free-text `department` is a different, user-entered provisioning snapshot and must remain intact in IT8.

## 11. Dashboard and LIFF boundary

**LOCKED target.** Generic Dashboard shell/menu and App Router composition remain under `components/dashboard`, `constants/dashboard.ts`, `lib/ssot/routes.ts`, and `app/dashboard/**`. IT-specific self-service form/list, operator queue, detail/conversation/timeline, analytics views and later Email Request form/history should live under `modules/it/presentation/dashboard/**` and be exposed through browser-safe `@/modules/it/client` once a browser consumer exists. IT1 has no client entry or presentation. API handlers consume `@/modules/it` server contracts. Likely route composition is `/dashboard/it`, `/dashboard/it/tickets/[id]`, `/dashboard/it/queue`, `/dashboard/it/analytics`; URLs are proposals, not frozen external contracts. Preserve `/dashboard/email-request` and `/api/email-request` through IT8. Capability projections may hide or reveal menu/actions but are never server authorization. `LIFF_SELF_SERVICE` is not registered for IT without a product requirement; current initial surface is Dashboard only.

## 12. Existing Email Request: current → target inventory

```text
CURRENT: app/api + lib/services/email-request + lib/validations/types/constants
       + Dashboard components/context/hook + LINE Flex + outbox processor
       + Notification compatibility adapter + Audit call + Prisma tables
TARGET: app/API compatibility adapters → modules/it Email Request contracts
        modules/it owns business persistence/policy/presentation/semantic delivery
        Notification, Audit, shared outbox and generic LINE transport stay external
```

| Surface | Observed contract / migration constraint |
| --- | --- |
| [`prisma/schema.prisma`](../../prisma/schema.prisma) | `EmailRequest` Int id, structured employee/account fields, nullable JSON sharedDriveAccess, free-text `department`, `requestedBy` User; `EmailRequestIdempotency` CUID id, unique `(userId,idempotencyKey)` and emailRequestId. Preserve row IDs, data, and Department text. |
| [`app/api/email-request/route.ts`](../../app/api/email-request/route.ts) | POST authenticates session, requires `email.request.create / ALL`, validates `Idempotency-Key` and Zod body; 201 new, 200 replay, 409 hash conflict, 403 denial, safe 500. Response `{success,message,data:{id,thaiName,englishName,nickname,position,department,needsDocumentSystem,sharedDriveAccess,requestedAt}}`. GET requires `email.request.read / OWN|ALL`, accepts page/limit, returns `{success,emailRequests,pagination}`; OWN is applied in database query. URL and DTO are compatibility contracts. |
| [`lib/services/email-request/authorization.ts`](../../lib/services/email-request/authorization.ts), [`modules/authorization/registry.ts`](../../modules/authorization/registry.ts) | Current adapter uses central resolver and additive composition, but default scopes are empty; create supports ALL only. This is active behavior, not the new Ticket default policy. Dashboard projection has independent read/create booleans. |
| [`lib/services/email-request/mutations.ts`](../../lib/services/email-request/mutations.ts), [`idempotency.ts`](../../lib/services/email-request/idempotency.ts) | Canonical payload SHA-256, user-scoped key, same-payload replay, conflict on key reuse; serializable transaction writes EmailRequest, idempotency, and `EMAIL_REQUEST` outbox with `email-request:<id>:created`; unique race is recovered by readback. Preserve retry semantics. |
| [`lib/services/email-request/queries.ts`](../../lib/services/email-request/queries.ts) | Direct Prisma count/findMany with `requestedBy` predicate for OWN; page/limit bounded at 100, descending createdAt, includes requester id/name/email. Move delegate ownership coherently at IT8. |
| [`lib/validations/email-request.ts`](../../lib/validations/email-request.ts), [`constants/email-request.ts`](../../constants/email-request.ts), [`types/email-request.ts`](../../types/email-request.ts), [`types/api.ts`](../../types/api.ts), [`components/dashboard/context/email-request/types.ts`](../../components/dashboard/context/email-request/types.ts) | Thai validation text, phone normalization, allowed shared-drive options, API/outbox/UI DTOs are compatibility input and display contracts. Consolidate ownership only after caller audit; do not change meaning or translate Thai. |
| [`components/email`](../../components/email), [`components/dashboard/context/email-request`](../../components/dashboard/context/email-request), [`components/dashboard/sections/EmailRequestSection.tsx`](../../components/dashboard/sections/EmailRequestSection.tsx), [`hooks/useEmailRequestHistory.ts`](../../hooks/useEmailRequestHistory.ts), [`app/dashboard/email-request`](../../app/dashboard/email-request) | Feature form/history/provider live outside module. Provider uses SWR conditional on read projection and retains an idempotency key across retry; route has server projection guard. A separate history hook also calls the same API. Preserve UI behavior and route while moving feature presentation later. |
| [`constants/dashboard.ts`](../../constants/dashboard.ts), [`lib/ssot/routes.ts`](../../lib/ssot/routes.ts), [`app/_lib/auth/current-user.ts`](../../app/_lib/auth/current-user.ts), [`app/dashboard/_lib/route-access.ts`](../../app/dashboard/_lib/route-access.ts) | Generic menu/route mapping and current-user capability projection are composition points. They remain outside IT but should consume IT client/public projections after migration. |
| [`lib/services/email-request/notifications.ts`](../../lib/services/email-request/notifications.ts), [`lib/services/notifications/in-app.ts`](../../lib/services/notifications/in-app.ts) | Inbox recipient IDs come from **configured** `email.request.read / ALL`, excluding default-only users; `SYSTEM_ALERT`, Thai text, Dashboard Email Request destination, replyEmail reference, per-recipient dedupe. Generic adapter delegates to Notification public `createForUserOnce`. Preserve audience/notification behavior until intentional product change. |
| [`lib/services/outbox/processor.ts`](../../lib/services/outbox/processor.ts), [`lib/line/index.ts`](../../lib/line/index.ts), [`lib/line/flex-messages/email-request.ts`](../../lib/line/flex-messages/email-request.ts) | Outbox validates stored payload, creates Inbox before LINE, then sends LINE with retry key. LINE targets configured IT user ID or broadcasts when absent; Flex includes sensitive provisioning/contact fields and Dashboard link. Target business payload/composition belongs to IT; generic LINE transport and shared processor lifecycle remain outside. Preserve existing dispatch until a safe IT public seam is wired. |
| [`lib/server/audit.ts`](../../lib/server/audit.ts), [`modules/audit`](../../modules/audit), [`app/api/email-request/route.ts`](../../app/api/email-request/route.ts) | New non-replayed POST emits `EMAIL_REQUEST` Audit with selected fields through compatibility wrapper; replay does not. Move producer through Audit public contract while preserving action/entity ID semantics and the current best-effort boundary unless explicitly changed. |

**LOCKED.** Email Request is a structured IT service-request subdomain, not automatically one `ITTicket`. It records the *target employee's* names/contact, position, free-text Department, document-system need and selected shared drives; the authenticated requester is a different identity. The current `EmailRequest` model has no Ticket status, assignee, comments or timeline. Flattening those fields into title/description or automatically creating Ticket rows would change validation, idempotency, recipients, reporting and historic IDs. A future optional link from Email Request to Ticket needs a verified workflow and explicit cardinality. IT8 is an ownership migration first, with no automatic record conversion.

## 13. Historical Ticket compatibility inventory

Repository-wide `Ticket`, `TICKET_*`, and `NEW_COMMENT` searches found **no active Ticket aggregate, route, table, or Ticket notification producer**. [`20260812180000_remove_it_support_module/migration.sql`](../../prisma/migrations/20260812180000_remove_it_support_module/migration.sql) superseded pending/processing/failed Ticket outbox rows and dropped `tickets`, `ticket_views`, `ticket_comments`, and `ticket_mutation_idempotency`, while preserving shared histories and enum values. Earlier [`20260724130000_split_ticket_notification_outbox/migration.sql`](../../prisma/migrations/20260724130000_split_ticket_notification_outbox/migration.sql) had split old Ticket delivery by channel; [`20260724150000_add_ticket_mutation_idempotency/migration.sql`](../../prisma/migrations/20260724150000_add_ticket_mutation_idempotency/migration.sql) described a now-dropped Ticket idempotency table. Those migrations document old data handling, not the new domain design.

| Artifact | Classification | Constraint |
| --- | --- | --- |
| `NotificationType.TICKET_CREATED`, `NEW_COMMENT`, `TICKET_UPDATED` | Historical data compatibility | Notification Inbox rows may contain these types. Current UI must keep displaying history; no new producer is proven. |
| `NotificationOutboxType.TICKET_CREATED`, `TICKET_UPDATED` | Obsolete but retained compatibility | Old parent values can exist in superseded/sent history; current [`outbox/types.ts`](../../lib/services/outbox/types.ts) does not dispatch them. |
| `TICKET_CREATED_IN_APP`, `TICKET_CREATED_LINE`, `TICKET_CREATED_EMAIL_REPORTER`, `TICKET_CREATED_EMAIL_IT`, `TICKET_UPDATED_IN_APP_REPORTER`, `TICKET_UPDATED_EMAIL_REPORTER`, `TICKET_UPDATED_LINE`, `TICKET_COMMENT_IN_APP` | Historical data compatibility / obsolete pending delivery | Retained enum rows; pending work was superseded on module removal. Do not re-enable old payloads by merely adding a case. |
| `AuditAction.TICKET_CREATE`, `TICKET_UPDATE`, `TICKET_STATUS_CHANGE`, `TICKET_ASSIGN`, `TICKET_COMMENT`, `TICKET_DELETE` | Historical data compatibility; possible future reusable semantics only after explicit mapping | Existing Audit rows and presentation/tests retain them. `TICKET_DELETE` does not imply new hard-delete behavior. |
| Old `tickets`, `ticket_views`, `ticket_comments`, `ticket_mutation_idempotency` migration definitions | Obsolete physical implementation | Tables are absent from current Prisma schema and were dropped by migration. New persistence requires its own migration and data plan. |
| `EMAIL_REQUEST` outbox and Audit values; `SYSTEM_ALERT` Inbox producer | **Active production behavior** | Preserve Email Request compatibility; these are separate from legacy Ticket. |

Do not delete, rename, reinterpret, or reuse historical stored values in IT0. At IT6/IT9, inspect actual deployed rows and processor contracts before deciding whether any legacy semantic type can be safely reused. New Ticket Audit actions may map to historically named values only with explicit entity/payload compatibility and historical display review. No migration should assume old Ticket records still exist merely because enum values do.

## 14. Security, transaction, and lifecycle invariants

**LOCKED implementation obligations for later slices.** Validate request size, authentication/workforce eligibility, schema, capability, resource relationship, workflow and side effects in that order. Server derives requester and ignores client-supplied owner/permission/assignee authority. Ticket creation needs an idempotency key (or equivalent unique command identity) for retried POSTs; same key and same canonical input replays, different input conflicts. **IT2 transaction:** Ticket row, creation event and idempotency record commit atomically. IT2 does not add NotificationOutbox intent or IT notification semantics. Comment POST may need the same retry protection to prevent duplicate conversation entries; implement when comments arrive. Assignment/status/priority/category writes use a transaction with conditional expected status/version (or row locking supported by the database), recheck current authorization and assignee eligibility, write the business event in the same transaction, and return conflict on lost race. **IT6 and later:** when an approved business mutation requires reliable notification, its NotificationOutbox intent joins that same business transaction; shared outbox still owns delivery lifecycle and IT owns event meaning/recipients. Unique constraints enforce idempotency keys and event/outbox dedupe. Notification delivery is at least once; dispatch is idempotent per recipient/event/channel. A stale screen is never sufficient mutation authority. Ticket read/search/count/attachment paths enforce OWN/ALL at SQL query level. Keep user-facing errors safe and server logs useful. If a requester becomes inactive, history remains but access stops; if an assignee becomes inactive, retain evidence and surface reassignment. Deletion and retention policy must not silently cascade away Tickets, comments or events.

## 15. Explicit non-goals and open product requirements

**Non-goals:** ITIL Problem/Change Management, CMDB/assets, SLA engine or breach automation, approvals, multi-tenant/external customers, email ingestion, chatbot/AI classification, knowledge base, automatic routing/escalation/on-call, nested IT teams, custom workflow/policy DSL, arbitrary custom fields, and automatic EmailRequest→Ticket conversion. No LIFF surface without an approved requirement.

**OPEN product questions that materially affect a later implementation:**

1. May a requester cancel, and from which states? May an operator cancel, and is a reason mandatory?
2. Can `RESOLVED` or `CLOSED` reopen, by whom, and within what window? Who closes, and is closure manual or time-based? May a requester reply while resolved?
3. Should a requester reply in `WAITING_REQUESTER` always resume `IN_PROGRESS`? Does a status update without a message count as first response?
4. Are internal IT-only notes required? This changes comment visibility, storage and API authorization.
5. Are attachments required in the first production slice, and which file types/count/size are allowed?
6. Is exactly one current assignee sufficient? If not, assignment cardinality and workload definitions change.
7. Is priority part of MVP? Should requester provide a separate urgency signal? Who may set `URGENT`?
8. Are categories centrally configured by deployment/operator data, or must IT administer them in the app? What initial categories are approved?
9. Which notification channels and recipients are required for creation, assignment, replies and resolution? Is an unassigned queue broadcast desired?
10. Is LIFF Ticket access required? No current approval establishes it.
11. Are response/resolution targets required now? If so, specify measures before considering any SLA implementation.
12. Should reporting periods use calendar or fiscal year, which timezone/business-hours convention, and how should reopened/resolved/cancelled cycles count? Should `RESOLVED` be included in backlog?
13. Are active application accounts without an Employee profile eligible? Current active workforce helper requires an Employee; product wording alone does not settle this exception.
14. What retention/deletion policy applies to Ticket text, files, personal identity snapshots and operational history?

These questions are intentionally unresolved; later slices must close their dependencies before schema/API behavior is frozen.

## 16. Incremental implementation roadmap

| Phase | Objective / introduced behavior | Persistence, API, UI, authorization and migration boundaries | Verification scope |
| --- | --- | --- | --- |
| IT1 — Module foundation + authorization (**CLOSED**) | Register `it` domain and five capabilities; add Administration/presentation metadata, role-neutral Default Domain Policy and IT authorization adapter; define/test assignee eligibility. No Ticket mutation or operator configuration data. | Registry/domain extension; trusted actor contract, requester resource policy and capability projection. Verify configured Team/TeamRole/User grants resolve; do not seed/infer an IT Team, TeamRole, membership, grant, or Department→Team mapping. No Email Request migration. | Focused resolver/default/channel/grant and assignee-eligibility contract tests, architecture, lint/typecheck. |
| IT2 — Ticket persistence + workflow | Add Ticket/category/event and creation/transition/assignment domain operations, conditional concurrency, creation idempotency. Close workflow and IT1 assignee-eligibility questions first. | Prisma migration, IT repository/service and server command contracts. Ticket + creation event + idempotency are atomic; no NotificationOutbox intent or notification semantics. No broad UI. | Focused domain + MySQL transaction/authorization/idempotency tests and migration validation. |
| IT3 — User self-service | Create Ticket, list/detail OWN, status tracking. | Versioned long-lived API if a new public API is intended; Dashboard self-service presentation; default OWN enforcement. | Direct API denial/OWN isolation and UI flow tests. |
| IT4 — Operator processing | Complete queue, assignment, classification, status changes and detail. | Query indexes as needed, operator API/UI, configured ALL grants; no implicit IT role. | Query scope, stale-grant and competing-operator integration tests. |
| IT5 — Conversation, timeline, attachments | Requester/operator replies and coherent timeline; private files only if approved. | Comment/event and optional attachment migration, authorized download/upload, comment OWN/ALL. | Conversation/resource/private-file and lifecycle tests; storage failure recovery. |
| IT6 — Notifications | Introduce approved Ticket events/channels. | IT semantic producer and public outbox dispatch seam; enqueue required NotificationOutbox intent in the same transaction as its business mutation; preserve legacy enum/history; Notification/Audit public calls. | Transaction/dedupe/recipient/retry/channel compatibility tests. |
| IT7 — Analytics dashboard | Operational summaries/trends from transactional data. | IT read queries and presentation, `it.analytics.read / ALL`; indexes by measured queries. | Metric definition and query authorization tests. |
| IT8 — Email Request migration | Move existing structured capability into IT without changing API/DTO/idempotency/user behavior. | Transfer Prisma delegate, validation, presentation, notification/Flex and Audit producer ownership behind IT public entries; keep URL/rows/keys/grants. | Existing Email Request API, UI, MySQL idempotency, outbox, LINE, Audit compatibility suites. |
| IT9 — Hardening + compatibility | Review deployed legacy rows, retention, operational failure modes and final ownership. | Only approved compatibility cleanup/migrations; explicit decision before any enum or grant change. | Architecture/security regression, relevant broad suite and deployment data review. |

Each phase needs its own stable diff and relevant verification; no phase is implicitly authorized by IT0. Split a phase further if a product question blocks only part of it. IT0 closed when this document recorded ownership, current compatibility, locked invariants and the open decision ledger. It did not claim future product policies were approved.

## 17. IT1 closure

IT1 is **CLOSED**. The authorization registry includes the `it` domain and exactly the five approved Dashboard capabilities. The IT adapter composes role-neutral defaults (`read/create/comment OWN`) with the central resolver; `manage` and analytics have no defaults. Administration runtime and Thai presentation metadata cover every capability. The resource policy maps OWN only to `requesterUserId === actor.userId`, and assignee eligibility requires active workforce plus configured read/comment/manage ALL.

`modules/it/index.ts` is the supported server entry. There is no Ticket persistence or runtime, no UI/client entry, no production IT Team/grant configuration, and no Department-to-Team mapping. Email Request remains on its current implementation pending IT8; existing historical `TICKET_*` compatibility values are unchanged. IT2 owns Ticket persistence and workflow.
