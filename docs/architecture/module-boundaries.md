# Module boundaries

Status: Phase J3 CLOSED — LINE/LIFF identity integration and Auth Audit
producer migration complete; Auth / Session / Identity migration COMPLETE.
Phase I3 Audit producer integration and physical AuditLog persistence
exclusivity remains closed. Phase H3 Notification producer integration and
final migration audit remain complete. Phase G3 Department migration remains
complete.
Stock, Routine, Leave, and Employee are migrated examples; Employee
server/business and active presentation ownership are migrated as well.

The repository-wide K0 ownership audit, K1 closure, and deferred-boundary
inventory are historical records in [final-repository-audit.md](./final-repository-audit.md);
the current Email Request ownership overlay is recorded there separately.
K1 closed the three Stock findings. IT1 established the `modules/it` server
authorization foundation, IT2 added IT-owned Ticket persistence and domain
commands, IT3 added requester-only Ticket API and Dashboard presentation, IT4
added the separate read-ALL operator queue/API and processing surface, IT5A
added shared conversation and a bounded merged timeline, IT5B added
comment-owned private image attachments, IT6 implements in-app Ticket
notifications, and IT7 adds an aggregate-only analytics query and Dashboard.
IT8 moved the existing structured Email Request subdomain into IT and is
closed; IT9A adds requester-only LIFF authorization and API adapters over the
same IT application and is CLOSED as the requester-only authorization/API
foundation. IT9B requester presentation exists at `/liff/it` and
`/liff/it/[ticketId]` and is **CLOSED** after independent review and final
verification. IT9C is **CLOSED** after independent review and owns LIFF
Home/module projection, service card, shared navigation, canonical requester
deep links, and Unified Rich Menu integration. IT9D is **CLOSED** after
independent review and adds requester-facing Ticket LINE for the approved event
matrix. IT9E-A is **COMPLETE** for repository E2E/acceptance readiness; IT9E-B
Android/iPhone device acceptance is **NOT RUN / next human acceptance step**.
IT9E remains in progress. IT10 hardening remains **OPEN / deferred**.
Compatibility and verification records follow.

The authoritative Auth boundary record is
[auth-session-identity-migration.md](./auth-session-identity-migration.md).
Auth/Session/Account Identity is one cohesive server capability for
credentials, account fields, web token/session families, recovery, and generic
role checks. It must not own Employee lifecycle, Leave capability predicates,
Department data, Dashboard composition, or LINE Messaging transport. The
server capability now lives under `modules/auth/` with `@/modules/auth` as its
server entry and `@/modules/auth/client` as its browser entry. The production
client graph must not reach Prisma, secrets, JWT/password
implementation, or session persistence. Remaining `lib/auth/**` and route
locations are operational compatibility/adaptation paths where active
consumers still require them.

## What is a module

A module is the code ownership boundary for one business capability. It should
contain the rules, use cases, technical adapters, and feature-facing artifacts
that change together. A module is not merely a page, route folder, database
table, or collection of convenient helpers.

The test is ownership, not reuse:

> If the code changes because a business feature changes, keep it in that
> feature's module.

## Public module API

Each module should expose a deliberate server/application contract from its
root entry point:

```text
modules/<feature>/index.ts
```

Consumers use the public entry point:

```ts
import { something } from "@/modules/stock";
```

When a module owns client-facing presentation, that presentation may use the
separate client-safe entry point:

```text
modules/<feature>/client.ts
```

```ts
import { StockSection } from "@/modules/stock/client";
```

Routine follows the same split: server/application consumers use
`@/modules/routine`, while Dashboard and LIFF consumers use
`@/modules/routine/client`.

The Routine browser entry is enforced as a runtime boundary: its current graph
may use presentation, browser transport, schemas, and pure domain helpers, but
may not reach the Routine server entry, Routine application/infrastructure
code, or proven platform/auth server-only dependencies. H2A removed the Routine
Import application path, and H2A.2 subsequently removed its persistence
compatibility representation from Prisma and the database. Routine Dashboard
and LIFF route composition and Routine internal self-barrel imports are checked by
`npm run architecture:check`.

Leave server/application consumers use `@/modules/leave`. Leave Dashboard and
LIFF route composition use the explicit client-safe entry point
`@/modules/leave/client`; migrated module presentation internals use local
relative contracts.

Employee server/application consumers use `@/modules/employee`. Employee
Dashboard route composition uses `@/modules/employee/client`, whose route-facing
presentation exports are `EmployeeManagementSection`,
`EmployeeManagementSectionSkeleton`, `AddEmployeeSection`, and
`ImportEmployeeRouteContent`. The same client entry exposes the proven pure
`getEmployeeDisplayName` formatter required by Leave, Routine, and audit
presentation. The active feature presentation, provider/context, forms, local
types/formatters, and CSV browser flow live under
`modules/employee/presentation/**`; internals use relative/local contracts.
Server schema exports remain in `modules/employee/index.ts` for Employee API
routes; `modules/employee/client.ts` does not expose server schemas. The
former `lib/validations/employee.ts` compatibility facade was removed after
its production consumers were audited.

Generic User/Employee display fallback projection is owned by the browser-safe
structural helper `shared/identity/display.ts` and is consumed through
`getUserDisplayName`; it does not depend on the Employee module. Employee
status values and presentation formatting are owned by Employee domain and
presentation-local contracts. Employee CSV parsing is owned by
`modules/employee/presentation/import/csv.ts`, while Leave report labels and
row mapping are owned by Leave report infrastructure.

Department server/application consumers use `@/modules/department`. Its root
entry exposes `listDepartments()` for the app Department route and the narrow
`listDepartmentReferences()` query for Employee import. Department owns its
server-side application and Prisma persistence; G2 confirms that it is
intentionally server-only and has no `client.ts` or Department-owned
presentation.

## IT module Ticket services, operator processing, notifications, analytics, and LIFF APIs (IT1/IT2/IT3/IT4/IT5A/IT5B/IT6/IT7/IT9A/IT9B)

`modules/it/index.ts` is the supported IT server entry. The application adapter
owns IT's role-neutral Default Domain Policy, requester-based Ticket resource
scope, presentation capability projection, and pure assignee-eligibility rule.
It delegates configured Team, TeamRole, and direct User authority to the
central `@/modules/authorization` resolver. `systemRole`, Department, Team
names, TeamRole names, and assignment do not create IT authority or requester
ownership.

IT1 adds the `it` authorization domain and five capabilities. IT9A makes
`it.ticket.read`, `it.ticket.create`, and `it.ticket.comment` available to
`LIFF_SELF_SERVICE`; `it.ticket.manage` and `it.analytics.read` remain
Dashboard-only, and all IT capabilities remain unsupported on `SYSTEM`.
IT2 adds new `it_*` Ticket, category, event, and creation-idempotency tables,
validated server commands, transaction-time workforce/configured-authority
checks, version concurrency, and the approved workflow. IT3 adds requester
list/detail queries whose database predicates always include the authenticated
requester, internal Dashboard API handlers, and a requester-safe DTO. IT4 adds
separate operator queue/detail/reference queries that require effective
`it.ticket.read / ALL` before broad Ticket reads. Its internal PATCH adapters
delegate to existing IT2 commands; those commands revalidate manage ALL,
expected version, workforce, and assignee eligibility transactionally.

IT4 consumes Authorization's configured-scope recipient query and Employee's
public `findCurrentEmployeeDisplayProjections()` contract for safe active
assignment candidates; it does not read either module's private persistence.
The root server entry exposes stable application contracts;
`@/modules/it/client` is the browser-safe Dashboard and LIFF presentation entry.
Dashboard navigation and route guards use the server-derived capability
projection, while API/query boundaries independently revalidate workforce and
authority.

IT5A adds immutable comments, actor-side classification, comment idempotency,
`firstRespondedAt`, and a bounded merged timeline in the IT application and
persistence layers. IT5B adds comment-owned immutable image metadata, bounded
multipart handling, private local storage, current-read-authorized download,
orphan cleanup, attachment-aware idempotency and Dashboard previews. Requester
conversation paths always include the authenticated requester predicate;
operator replies/uploads require read ALL and comment ALL, while downloads
require read ALL. The requester and operator routes select their authority
path server-side. Both Dashboard detail surfaces use the browser-safe IT client
entry. IT5B attachment storage does not create separate Ticket events, Audit
rows, or notification content; IT6 adds transactional notification intents for
the defined Ticket facts. IT-owned attachment code does not import Leave storage
or business logic. Attachments are images-only, normalized to WEBP, retained
with Ticket history; committed retention duration is deferred to IT10. IT5B
adds no category administration, production grant configuration, or Email
Request migration.

IT7 adds the server-only analytics application query and IT-owned persistence
aggregates, plus the Thai Dashboard presentation through `@/modules/it/client`.
Analytics independently requires current active workforce and configured
`it.analytics.read / ALL`; the presentation `canReadAnalytics` projection only
controls route/menu visibility. Ticket read/manage, ADMIN, Department, Team,
and TeamRole do not grant analytics. The query returns aggregate-only data and
does not expose Ticket IDs/content, requester identity, comment text,
attachment metadata, or raw events. Periods are 7D/30D/90D (default 30D),
bounded and bucketed in `Asia/Bangkok`, using one deterministic date helper.
Ticket and event aggregates are read inside one MySQL `REPEATABLE READ`
transaction snapshot. Department reporting groups by the immutable creation-
time requester Department name snapshot; active Employee display identity is
resolved only through the public projection contract, with a safe fallback
that preserves historical assignee counts. Analytics adds no schema or index;
the measured integration EXPLAIN is recorded in `it-module-design.md`.
Deferred metric policy and Email Request ownership remain outside IT7. See
[it-module-design.md](./it-module-design.md) for the phase contract and
[authorization-current-state.md](./authorization-current-state.md) for the
live authorization model.

IT9A adds requester-only `/api/line/it/**` adapters that authenticate through
`requireLiffWorkforceSession()` and reuse the same IT commands, requester
queries, timeline, comment/attachment, and download operations. Its IT-owned
channel policy clamps effective LIFF read/create/comment authority to OWN for
USER and ADMIN even when configured authority is ALL; configured decision
evidence remains distinct, Dashboard configured ALL remains unchanged, and
SYSTEM plus LIFF manage/analytics are unsupported. These adapters may compose
the public IT/LINE boundaries and shared HTTP/security infrastructure, but do
not reach IT/Notification/Audit persistence, Dashboard private API helpers, or
the global Outbox Processor. Accepted non-replayed mutations keep IT6's
transactional in-app outbox behavior and use the shared route-layer wakeup.
Ticket creation uses the dedicated process-local `it-ticket-create` limit;
attachment comments reuse `it-ticket-comment-attachment`. IT9A adds no schema
or migration, UI, shell/Rich Menu changes, operator LIFF API, or Ticket LINE
delivery. Ticket LINE is deferred to IT9D; Ticket Email remains a product
decision/deferred.

### IT9B requester LIFF presentation — IT9B closure record

IT9B implements requester list, creation, detail, conversation, and private
attachment presentation at `/liff/it` and `/liff/it/[ticketId]`. The App Router
pages use `@/modules/it/client`; IT-specific presentation is owned by
`modules/it/presentation/liff/**` and calls only the existing requester
`/api/line/it/**` routes. IT9B is **CLOSED** after independent review and final
verification. At the IT9B closure boundary, IT9A was CLOSED as the
requester-only authorization/API foundation and IT9B was CLOSED as the
requester LIFF presentation phase. IT9C was then **OPEN / next phase** for LIFF
Home/module registration, shared navigation, external requester deep links, and
Rich Menu integration; that work was not included in IT9B. IT9D was OPEN for
Ticket LINE delivery; IT9E was OPEN for full product/device acceptance; IT10
was OPEN/deferred. This is the historical IT9B boundary; the following IT9C
section records the current implementation state.

### IT9C shared LIFF integration — closure record

IT9C is **CLOSED** after independent review. The shared LINE
Home composition consumes IT's public capability projection from a trusted
`LIFF_SELF_SERVICE` context; Home visibility is presentation-only and the IT
server APIs remain authoritative. The shared shell owns Home card and
Bottom Navigation presentation. IT exports its requester root and Ticket
detail LIFF URL builders through `@/modules/it`. The platform-owned Unified
Rich Menu source adds a fourth requester destination. No IT capability, Ticket
workflow, notification delivery, or schema change was added. Independent review
covered the fixed `LIFF_SELF_SERVICE` capability projection, Home requester
visibility, shared Home/card/header/Bottom Nav integration, canonical requester
LIFF root/detail destinations, the Unified Rich Menu four-area contract, the
retained Dashboard Inbox destination, and no IT9D delivery leakage.
At the IT9C closure boundary, IT9D was OPEN / next phase; IT9E remained OPEN;
IT10 remained OPEN/deferred.

### IT9D requester Ticket LINE — closed phase

IT9D is **CLOSED** after independent review of implementation commit
`9474a54aefd86014fbd77cfdfed542bd049fb1e9`; no P1/P2 blocker was found. The
Ticket mutation transaction enqueues the existing `IT_TICKET_IN_APP` row and
an `IT_TICKET_LINE` row only for requester `OPERATOR_COMMENTED`,
`WAITING_REQUESTER`, and `RESOLVED` facts. Both rows use the same strict IT
semantic payload and distinct channel event keys. The global processor keeps
ownership of claim/retry/dead-letter and delegates both Ticket types to the IT
dispatcher. IT revalidates source,
requester ownership, workforce eligibility, self-suppression, and the current
`WAITING_REQUESTER` generation before composing the message and using
`sendAppLineNotification()`.

Personal LINE uses `LineAccountLink` and the shared `LINE_APP_CHANNEL_ACCESS_TOKEN`
transport. Its CTA is built by `buildITTicketLiffUrl(ticketId)` and opens the
requester's `/liff/it/[ticketId]` surface. Operator-facing `CREATED`, `ASSIGNED`,
and `REQUESTER_COMMENTED` events remain in-app only because operator LIFF does
not exist. Existing requester/operator Dashboard Inbox destinations remain
unchanged. Unlinked or ineligible users are superseded without retry; provider
errors use the shared at-least-once retry/dead-letter lifecycle. No live LINE
provider or smartphone/device acceptance was performed; IT9E is OPEN / next phase.

## IT8 Email Request ownership — CLOSED

Email Request is a structured IT service-request subdomain and remains a
separate model from `ITTicket`. IT owns its application commands and queries,
authorization adapter, validation and contracts, production Prisma delegates,
Dashboard form/history/provider, Inbox meaning, LINE Flex/destination, outbox
payload interpretation, and Audit event construction. Existing IDs and rows
remain in `EmailRequest` and `EmailRequestIdempotency`; no schema migration,
backfill, Ticket conversion, or capability mapping is part of IT8.

The public server entry is `@/modules/it`; browser presentation and safe
contracts use `@/modules/it/client`. `/api/email-request` and
`/dashboard/email-request` remain unchanged. Capability keys remain
`email.request.read` (`OWN|ALL`) and `email.request.create` (`ALL`), with empty
defaults. OWN is enforced in the database by `requestedBy`; create requires
effective ALL. The API keeps the current session and Employee eligibility
boundary, and the Email Request actor remains `DASHBOARD` with
`employeeId: null`. Ticket and analytics authority, role names, Department,
Team, and TeamRole do not imply Email Request authority.

New request rows, idempotency rows, and the `EMAIL_REQUEST` outbox intent commit
together. IT dispatches both new and historical `EMAIL_REQUEST` payloads through
its public server contract; the shared processor retains claim/retry/backoff,
stale recovery, and terminal state changes. Notification Inbox persistence,
Audit persistence, shared outbox lifecycle, generic LINE provider transport,
and App Router request metadata remain with their existing owners. The small
Dashboard section wrapper remains only to bind shared Dashboard navigation.

Closure verification passed `npm run architecture:check` (1,248 source files),
`npm run lint:strict`, `npm run typecheck`, the dedicated MySQL Email Request
integration suite (22 files; 153 tests), and the final `npm run test`
(365 files; 3,515 passed, 1 skipped) before the retained LINE webhook
correction. IT8 preserves `sendLineWebhook`,
`lineNotificationService.sendLineWebhook`, `LineWebhookData`, and
`LINE_WEBHOOK_URL` outside IT as a formally retained legacy integration seam.
The active Email Request outbox continues through IT's dispatcher/Flex and
generic LINE push/broadcast. The type-only legacy bridge points to IT's single
authoritative payload contract. Focused LINE (16 tests), IT Email Request
LINE/dispatcher (7 tests), architecture, lint, and typecheck checks passed;
the correction's final repository suite passed (365 files; 3,515 passed,
1 skipped). The earlier dedicated MySQL result remains valid because this
correction did not touch persistence. No Prisma schema or migration changed.

## Authorization Administration boundary (Phase 10C + Phase 12E)

`modules/authorization/` owns the Authorization Administration application
contract. Its capability administration catalog is a projection of the
code-owned `CAPABILITY_REGISTRY`; operational grantability is explicit
administration metadata and is not a second capability registry. The
administration application exposes safe Team, TeamRole, membership, grant,
User directory/detail, and effective-permission read models plus narrow command
use cases for the Phase 10B lifecycle and additive grant operations. Mutation
persistence uses a separate command-specific repository and does not expose
generic Prisma CRUD.

The app API and Dashboard route boundaries authenticate through the existing
server session/workforce checks, then require the explicit Phase 10A
Authorization Administration `ADMIN` system boundary. They import only the
public `@/modules/authorization` contract; they must not query authorization
delegates directly or accept role/ownership data from the client. Phase 10B
routes call the same ADMIN boundary, parse request input, and delegate to
application commands. Commands perform readiness and indirect applicability
guards before a serializable transaction writes configuration and appends
strict audit through the public `@/modules/audit` contract. Phase 10B permits
only explicit ADMIN mutations for `GRANTABLE` capabilities; it does not seed
policy, infer Teams from Department, retire compatibility floors, or add hard
delete semantics.

Phase 10C adds the operator-facing Dashboard workspace at
`/dashboard/authorization`. The server page remains the composition and
`requireDashboardAuthorizationAdministration()` boundary, while the browser
loads read models and sends commands only through the client-safe
`@/modules/authorization/client` entry and the bounded
`/api/authorization/administration/users` directory route. The browser must
not import Prisma, authorization persistence, server session helpers, audit
infrastructure, or mutation implementations. The menu item is an ADMIN-only
presentation filter; direct route and API checks remain authoritative.

The workspace preserves exact Team, TeamRole, membership, and direct User grant
operations, exposes registry readiness and invalid persisted configuration,
and labels resolver-effective permissions as central-resolver output rather
than universal final runtime access. `CENTRAL_WITH_COMPATIBILITY` remains a
historical/future-safe catalog contract; the current live catalog has no active
compatibility capability. Phase 10C does not activate Team policy, retire
compatibility floors, add delegated authorization capabilities, or infer Team
membership from Department, manager, position, or employee state.

Phase 12E adds the effective-access inspection without changing that boundary.
The consuming Administration contract defines the structural
`AuthorizationAdministrationEffectiveAccessProvider` port. Domain-owned
inspectors for Department, Notification, Employee, Routine, Stock, Leave, and
Audit are exported through their public module entries and are bound only in
the outer `app/api/authorization/administration/_lib/effective-access.ts`
composition. The generic authorization module and its React presentation must
not import every business domain or reproduce a default-scope matrix.

The provider receives trusted server-side actor/context state and bounded
batched resolver results. It emits only registered `DASHBOARD` and
`LIFF_SELF_SERVICE` inspection contexts. Raw resolver evidence remains in the
User read model alongside the domain-composed Default + Additional + Effective
projection. Resource, relationship, lifecycle, and workflow checks remain
owned by the domain runtime paths.

## Notification boundary (H0/H1/H2/H3)

The `modules/notification/` module now owns the user-facing in-app
Notification/Inbox capability. It owns the `Notification` repository and
persistence boundary, strict and idempotent explicit-user create mechanics,
strict explicit-user batch create, business-driven unread reference
transitions, dedupe handling, latest/history/unread queries,
mark-one/mark-all-read commands, and the public server/application contract.
Notification-specific Dashboard
presentation is now owned under
`modules/notification/presentation/dashboard/**` and is exposed only through
the browser-safe `@/modules/notification/client` entry.

The module must receive explicit recipients and semantic payloads. Leave,
Stock, Routine, and Email Request retain ownership of their current triggering
events, recipient policy, notification type, title/message, action URL,
reference ID, channel choice, and event-specific dedupe or supersede semantics.
IT owns Ticket event meaning, recipient policy, strict payload, destination,
event identity, and stale-domain validation. IT6 implements in-app Ticket
notifications. IT9A adds the requester LIFF API foundation. IT9D delivers
personal NHFapp LINE only for requester `OPERATOR_COMMENTED`,
`WAITING_REQUESTER`, and `RESOLVED`; operator-facing events remain in-app
because operator LIFF does not exist. Ticket Email remains a product
decision/deferred. Notification must not
grow audience APIs such as “notify all Stock
admins” or become a workflow owner for another module. Leave, Stock, Routine,
and IT use only `@/modules/notification` for Inbox persistence; physical
Prisma `Notification` delegate operations are owned exclusively by
`modules/notification/infrastructure/**` in production. Phase 13A/13A.1
updates Routine, Stock, and Email Request audience selection to configured
capabilities; each producer still owns its event and recipient policy. IT8
removed the Email Request-only generic `createInAppNotificationOnce` adapter;
Email Request calls the public Notification command directly.

`NotificationOutbox` is a separate shared/platform boundary. The global
outbox owns reliable asynchronous delivery, event claim and status lifecycle,
retry/backoff/dead-letter/stale recovery, scheduling/wakeup, and provider
dispatch composition. Business modules may enqueue outbox rows transactionally
but must not import the global Outbox Processor. For business-owned outbox
events, the global processor calls the producing business module's supported
public dispatch contract. That module revalidates domain state, resolves
recipients and semantics, makes stale/defer/supersede decisions, and invokes
Notification's public command when an in-app entry is needed. The business
dispatch contract owns any transaction context; the global processor does not
pass a transaction client directly to Notification. A direct
processor-to-Notification dispatch is reserved for a future generic
Notification-owned event with a fully resolved command payload, not current
Leave, Stock, Routine, IT Ticket, or Email Request events. IT enqueues
`IT_TICKET_IN_APP` and eligible `IT_TICKET_LINE` rows with the same Ticket
mutation transaction and `EMAIL_REQUEST` with the Email Request creation
transaction. The public IT server entry exports the Ticket dispatcher for both
Ticket channel types and the separate Email Request dispatcher for the global
processor.
The outbox wakeup remains in the API adapter after the business transaction.

The four existing `app/api/notifications/**` routes remain app HTTP delivery
composition and now delegate their query/read behavior through
`@/modules/notification`. The notification page and loading route consume
`@/modules/notification/client`; `DashboardNavbar` remains generic Dashboard
shell ownership and mounts `NotificationDropdown` through that entry. The
obsolete `components/dashboard/notifications/**` path is deleted, while the
generic Dashboard navbar, route/page composition, menu constants, and session/auth
infrastructure remain outside the module. The complete H0 evidence and ledger
are in [notification-migration.md](./notification-migration.md).

Employee and Leave have one deliberate server dependency direction. Leave may
consume the public Employee hierarchy contract to mutate the Employee-owned
`managerId` inside Leave's transaction. Employee lifecycle code must not import
`@/modules/leave` or any Leave internal. Instead, Employee defines the narrow
structural `EmployeeOffboardingDependencyProvider` port; the outer application
composition binds Leave's blocker implementation to that port. The provider
must receive and use the same `Prisma.TransactionClient` as the Employee
serializable lifecycle operation.

The root barrel remains server/application-oriented. Where a client entry
exists, it must export only client-safe presentation contracts; a server-only
module intentionally has no client entry. Notification's client graph remains
HTTP-based through `API_ROUTES.notifications.*` and may not reach Prisma,
server-only Next.js modules, Email/LINE infrastructure, the Outbox Processor,
or Notification application/infrastructure code.

The Employee client entry is browser-safe: its runtime graph contains no
Prisma runtime, database/session/secret implementation, server-only Next.js
modules, or Employee application/infrastructure code. Employee browser API
traffic continues through `/api/employees/**` and `/api/departments`; the
architecture checker walks this graph and guards the route/client boundary.

Files below the module root are internal implementation. Consumers must not
turn paths such as the following into an accidental public API:

```ts
import { something } from "@/modules/stock/application/internal/foo";
```

The public entries should export only contracts that another layer or module
is intended to rely on. Avoid exporting an entire internal tree through broad
barrel files; small explicit entry points are easier to evolve and keep
dependency direction visible. Only the module root and, when present, its
`client.ts` entry are public; arbitrary subpaths remain private.

## Audit boundary (I1/I2/I3)

Phase I0 remains the historical discovery and boundary-definition record. The
current owner is the first-class `modules/audit/` capability module, not
`shared/audit/`. I1 established its server/application and generic persistence
boundary, I2 owns its Dashboard presentation, and I3 now owns the final
producer/read seam and physical persistence exclusivity. The
decision follows the ownership principle: Audit has a cohesive persistence,
generic query/pagination, retention, and serialization capability, while the
events it records remain owned by their producing capabilities.

The cohesive `modules/audit/` capability owns generic Audit application
behavior, generic query/retention behavior, physical AuditLog persistence, and
Audit-specific Dashboard/browser presentation. Its layer ownership is:

- `modules/audit/application/**` for generic Audit use cases, orchestration,
  serialization/parsing, query/pagination/retention behavior, and neutral
  contracts;
- `modules/audit/infrastructure/**` for physical AuditLog persistence only;
- `modules/audit/presentation/**` for Audit-specific browser/UI presentation.

Auth, Employee, Leave, Stock, and Routine own their current event meaning,
AuditAction, entity meaning/identifiers, snapshots, event metadata, actor
semantics, and the decision and failure policy for each write. IT will own
Ticket audit producers when Ticket mutations exist; IT1 adds none. Transaction-bound writes must
keep the same business transaction; current best-effort and after-response
writes must not be normalized. Leave's CUID-in-details fallback and all
historical enum/storage values remain compatibility constraints.

The supported server entry is `@/modules/audit`. It exposes generic
`appendAuditInTransaction`, `appendAuditBestEffort`, `getAuditLogs`, the narrow
`getAuditEntityHistory`, and retention cleanup capabilities plus neutral
contracts. Physical AuditLog access is owned exclusively by
`modules/audit/infrastructure/persistence/audit-log-repository.ts`.
`lib/server/audit.ts` remains a compatibility adapter for deferred producers
and export delivery; the former `lib/services/audit-log/**` query/retention
compatibility paths were removed in L6 and no longer own or expose Audit
behavior. Employee, Leave, Stock, and Routine use only the public Audit server
entry for their producers/read seam;
their feature-specific detail contracts remain in their own modules. The
browser-safe `@/modules/audit/client` entry exposes the Audit Dashboard section
and loading skeleton; its implementation is under
`modules/audit/presentation/dashboard/**`. The routes retain App Router
composition and use only that client entry for Audit presentation. The
architecture checker rejects all production direct AuditLog delegate access
outside Audit infrastructure; tests, fixtures, Prisma support, and migrations
remain narrow non-production exceptions. See audit-migration.md for the final
inventory and deferred compatibility boundaries.

The full producer, reader, retention, presentation, action, identity,
transaction, metadata, compatibility, and phased I1-I3 ledger is in
audit-migration.md. The I3 source record explicitly kept Auth/Session/Identity
and Email Request deferred; IT1/IT2 later added the IT authorization foundation
and Ticket server/domain persistence, while API/UI and delivery remain deferred.
No Prisma schema or AuditAction taxonomy change occurred in I3.

## Larger feature shape

A feature with substantial domain rules, workflows, persistence, or external
integrations may evolve toward:

```text
modules/<feature>/
├── domain/
├── application/
├── infrastructure/
├── presentation/
└── index.ts
```

The layers have these responsibilities:

- `domain/`: pure business concepts, policies, invariants, domain errors, and
  calculations. Avoid framework and database dependencies where reasonably
  possible.
- `application/`: cohesive use cases and orchestration such as
  `create-item`, `approve-request`, `generate-routine`, or `complete-task`.
  Prefer use-case cohesion over increasingly large generic buckets such as
  `queries.ts`, `mutations.ts`, `utils.ts`, or `helpers.ts`.
- `infrastructure/`: technical adapters such as Prisma repositories,
  external-service clients, storage integration, and workbook/file
  implementations.
- `presentation/`: feature-facing schemas, components, hooks, API adapters,
  and other artifacts that translate to or from delivery concerns.
- `index.ts`: the supported public module API.

These folders are guidance, not a requirement to add ceremony before the
feature needs it.

## Smaller feature shape

A small feature should remain small:

```text
modules/<feature>/
├── server/
├── components/
├── schemas.ts
└── index.ts
```

Do not create domain, application, infrastructure, and presentation layers
with no distinct responsibility. Complexity should be added when the feature
has a real boundary or use case that benefits from it.

## Cross-module communication

When module A needs module B, module A may consume only B's documented public
API. Prefer a narrow command, query, type, or result contract over reaching
into B's repository, database model, UI component, or internal helper.

```text
module A -> module B/index.ts or module B/client.ts -> module B internals
```

The target module owns the meaning and compatibility of its public contract.
If two modules appear to share a business rule, first determine which module
owns that rule. Move it to `shared/` only when it is truly cross-domain and
platform-level; reuse alone is not enough.

## Organization / Department boundary (G1)

Phase G0 remains preserved as a historical discovery record in
[organization-department-migration.md](./organization-department-migration.md).
The current product invariant is permanent single-NHF organization: there is
no Organization domain or tenant architecture. Department is an independent
NHF-wide reference-data capability in `modules/department/`.

Employee owns `Employee.departmentId`, its association semantics, current import
mapping, and Employee-facing projections. Department owns Department identity,
reference queries, and Department Prisma persistence. Employee consumes the
Department server contract only through `@/modules/department`; Department does
not depend on Employee. `Employee.affiliation` remains free text, and
`Employee.managerId` remains Employee-owned hierarchy rather than a Department
head.

The current `/api/departments` URL remains app delivery. It authenticates,
delegates to `listDepartments()`, and preserves the existing response/order/error
contract. Employee owns the selector, `departmentId` form state, import mapping,
and Employee-specific Department display behavior. Department has no CRUD,
lifecycle, hierarchy, head, or client-owned presentation behavior in the final
G3 architecture.
The G3 final audit confirmed that this remains the final boundary; no obsolete
Department compatibility artifact or runtime deletion was identified.

The browser contract is intentionally HTTP-based:

```text
Employee client -> GET /api/departments -> app route -> @/modules/department
```

Client-reachable runtime code must not import `@/modules/department` directly
or transitively. The architecture checker enforces this server-only boundary;
it permits the app route and Employee application server consumers. Auth and
Dashboard keep Department as an Employee/session display projection, Leave
keeps Employee projections, Routine carries an opaque Employee `departmentId`,
Stock has no Department dependency, and Email Request keeps free-text
`department`/`สังกัด`.

Department migration G0-G3 is complete. Department remains a server-only
reference-data owner with the minimal public server API
`listDepartments()`/`listDepartmentReferences()`; Employee owns association,
import, selector, and display compatibility behavior.

## Auth / Session / Account Identity server boundary (J1)

`modules/auth/` owns the Auth field slice of `User`, credential authentication,
access-token issue/verification semantics, refresh-token family lifecycle,
refresh-session persistence, logout/session management/cleanup, signup,
password recovery/reset, and the transaction-aware account lifecycle provider
used by Employee. The structure is intentionally proportional:

```text
modules/auth/
├── application/
├── domain/
├── infrastructure/persistence/
└── index.ts
```

The root exports the server application contracts for login, refresh, principal
resolution, logout/session operations, signup, recovery/reset, cleanup, and the
Employee account-lifecycle provider. Routes retain HTTP/security/cookie/response
adaptation, while Auth producers append through the public Audit capability.
Auth infrastructure is the
exclusive production owner of physical `AuthRefreshToken` and
`PasswordResetToken` delegate access.

Employee does not runtime-import Auth. It owns a structural account-lifecycle
port; the outer Employee route binds the implementation from `@/modules/auth`
and passes the existing serializable transaction client through it. Employee
continues to own workforce identity/profile rules, while Auth owns the account
field persistence operation.

The `/api/auth/me` broad account/Employee/Department/Leave projection is now
composed at `app/_lib/auth/current-user.ts`. No Leave predicates or Department
projection were pulled into generic Auth. Auth presentation is under
`modules/auth/presentation/**` and external browser consumers use only
`@/modules/auth/client`. The final LINE/LIFF and Auth Audit boundary is
recorded below.

## LINE / LIFF integration boundary (J3)

`modules/line/` is the cohesive integration capability for LINE account-link
identity, `LineAccountLink` persistence, verified LINE Login identity, LIFF
session issuance/verification, LIFF workforce-session composition, bootstrap
and recovery contracts, and LINE-specific DTOs. Its proportional structure is:

```text
modules/line/
├── application/
├── infrastructure/
├── presentation/
├── client.ts
└── index.ts
```

`@/modules/line` is the server entry and `@/modules/line/client` is the
browser-safe entry. The browser entry contains only LIFF SDK/browser HTTP
transport, DTO types, and `LiffBootstrap`; it cannot reach Prisma, Next
server APIs, Node built-ins, server secrets, mixed LINE configuration,
verification, signing, or the server barrel. External consumers cannot deep
import LINE internals, and LINE internals cannot import their own public
barrels.

Auth exposes the narrow account identity lookup required by LIFF. Employee
owns the active/non-deleted Employee and User-link predicates and the
expected-Employee-ID check. Leave owns the exact actionable assigned-approver
capability query used by the LIFF Home projection. IT owns its authorization
policy and presentation capability projection; LINE composes it from the
verified LIFF workforce identity with the fixed `LIFF_SELF_SERVICE` channel.
This Home projection only controls presentation; the IT server APIs remain
authoritative. LINE does not own Employee lifecycle,
Leave/Stock/Routine/IT policy, notification meaning, or Messaging transport.

LINE infrastructure exclusively owns production `LineAccountLink` delegate
access. Routine recipient/reminder code and the provider recipient adapter use
the narrow LINE read contract and preserve existing transaction contexts.
One-to-one/idempotent/conflict/race behavior, no reassignment/unlink policy,
LINE ID-token verification, LIFF JWT/cookie semantics, and provider/outbox
delivery semantics remain unchanged. Protected LIFF requests reread current
User/Employee state and the current `LineAccountLink.lineUserId`, comparing it
with the identity-bound LIFF claim; bootstrap and fresh ID-token recovery also
re-read the link. A missing or changed current link therefore fails closed.

Auth producer routes now call `appendAuditBestEffort()` directly from
`@/modules/audit` for all seven existing Auth event surfaces. Refresh-security
and selected-session-revoke details use the truncated `familyCorrelation`
representation; new relevant Audit rows do not persist raw runtime
`familyId`. The generic Audit capability does not interpret Auth meaning.
`lib/server/audit.ts` remains the thin trusted-request-metadata and best-effort
Audit composition seam for Email Request and Employee, Leave, and Audit Log
export consumers; Email Request event meaning is constructed by IT.

## Shared/platform ownership

Appropriate future `shared/` responsibilities may include authentication and
session infrastructure, database adapters, HTTP/security primitives, trusted
network/request metadata primitives, notification or LINE delivery, uploads,
and generic UI primitives. Phase I1 resolves the cohesive Audit capability's
physical persistence and generic query/retention owner as `modules/audit/`,
not `shared/audit/`; existing lib/ Audit code remains only as compatibility
adapters for Email Request and export consumers. Audit producer and
presentation migrations are complete.

Feature-specific validation, policies, calculations, status semantics,
workflow orchestration, and feature UI remain feature-owned. For example, code
whose behavior changes with Routine rules belongs to Routine, even if multiple
Routine screens use it.

## Correct and incorrect placement

| Concern | Preferred owner | Avoid |
| --- | --- | --- |
| Approving a leave request | Leave application/domain | A generic global service or shared helper |
| Stock inventory invariant | Stock domain/application | `shared/` because two Stock screens use it |
| Prisma client adapter | Shared/platform infrastructure or a feature infrastructure layer | Direct Prisma handling in a new client component |
| Generic request parsing/security primitive | `shared/http` or `shared/security` | Copying it into every feature |
| Routine-specific schema | Routine module | `lib/validations/` for new Routine code |
| Feature-to-feature call | Target module public API | Importing the target's internal file |

## Legacy coexistence

The current `app/`, `components/`, `hooks/`, `lib/`, and `lib/validations/`
structure remains operational for features that have not migrated. Existing
imports are not rewritten merely to make the target diagram look complete. A
migration must preserve behavior unless a separate change explicitly requests
a behavior change.

### Historical K0 Stock finding — closed by K1

At the K0 audit, the Stock server and Dashboard boundary was migrated, while
the active Stock LIFF presentation still used `components/liff/stock/**`,
`lib/client/liff-stock.ts`, and `lib/types/stock-liff.ts`. K1 moved that
presentation, browser transport, and neutral contracts under `modules/stock/`;
the current boundary is recorded below.

Leave is a completed incremental migration: `modules/leave/` owns server,
Dashboard presentation, and LIFF presentation behavior. No Leave compatibility
facades remain. The architecture checker rejects deleted Leave ownership paths,
requires API routes to use `@/modules/leave`, requires Dashboard/LIFF routes to
use `@/modules/leave/client`, and walks production Client Component graphs so a
generic helper cannot transitively import the Leave server entry.

Employee F0-F3 is complete. Employee API routes use the module root, Auth
signup uses its transaction-aware Employee lookup/recheck interface, and Leave
uses its hierarchy mutation interface. Employee lifecycle composition binds the
Leave offboarding blocker provider at the route boundary; there is no Employee
→ Leave runtime dependency. Generic Dashboard shell/context/navigation remain
outside Employee. The former legacy Employee validation facade, mixed Employee
helpers/types, duplicate CSV helper, and confirmed orphan presentation files
were removed after production-consumer audits.

G1 added Department server ownership without changing the Employee
presentation boundary or the other module projections. G2 re-audited the
presentation boundary and confirmed that no Department client entry is needed.
Department internals remain private; the Department root is the only supported
server entry.

## Stock K1 boundary — current

`modules/stock/` owns Stock server/business behavior, Dashboard and LIFF
presentation, browser transport, Stock contracts, and Stock notification
semantics. The only supported App Router composition entry for Stock LIFF is
`@/modules/stock/client`; the route remains delivery-owned.

Stock owns Stock payload parsing, email subjects/templates/Message-ID and
LINE Flex/message meaning. Generic SMTP and LINE HTTP/channel transport remain
platform-owned. The global Outbox Processor keeps lifecycle orchestration and
delegates Stock event interpretation through `@/modules/stock`.

The shared request status badge is a neutral renderer. Leave status metadata is
Leave-owned and Stock status metadata is Stock-owned; the shared UI does not
import either capability or contain their workflow taxonomy.
