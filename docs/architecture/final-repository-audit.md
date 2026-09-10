# K0 — Final Repository Audit and Deferred-Boundary Inventory

Status: K0 audit record
Repository: bait0ngxaxa/nhf_employee
Scope: discovery, classification, and documentation only

This document is the authoritative repository-wide ownership map for K0. It is
based on the current production tree, import/caller searches, direct Prisma
access searches, the architecture checker, the architecture tests, and the
completed migration records. Historical migration documents remain useful
evidence of sequence and intent, but current code takes precedence where the
two differ.

The audit treats tests, fixtures, generated output, Prisma migrations, and
operator tooling as non-production surfaces unless they affect a production
contract or reveal an ownership exception.

## 1. Executive Summary

The repository remains one Next.js modular monolith with one deployment/runtime
boundary and the existing Prisma/database infrastructure. J3 is closed. The
completed server and Dashboard capability migrations remain structurally
coherent, and the architecture checker passes.

No Critical or High modular-boundary violation was found. The audit did find
three Medium ownership findings that should be handled in later corrective
slices:

1. Active Stock LIFF presentation still lives in components/liff/stock,
   lib/client/liff-stock.ts, and lib/types/stock-liff.ts rather than behind the
   Stock browser entry. This is a remaining presentation-boundary gap, not a
   reason to create another capability.
2. Stock-specific email and LINE payload composition remains in generic
   provider facades/templates under lib/email and lib/line. Generic transport
   infrastructure is correctly platform-owned, but Stock payload meaning and
   delivery semantics should eventually be owned by Stock.
3. components/dashboard/shared/RequestStatusBadge.tsx contains Leave and Stock
   workflow/status semantics. The visual badge primitive is generic; the
   feature-specific status mapping is not.

These findings do not invalidate the modular-monolith structure. They mean that
the repository-wide ownership map is not completely closed for those remaining
surfaces. The evidence-backed post-K0 roadmap is a small Stock boundary
completion phase, followed by the separately approved future IT boundary when
Email Request is ready to move. No new capability module is created in K0.

Email Request remains intentionally deferred to a future modules/it bounded
context. It must not become modules/email-request. NotificationOutbox remains
shared/platform infrastructure. Email and LINE transports remain
platform/integration infrastructure. The Dashboard shell remains
application/delivery composition.

## Audit Method and Evidence

The audit reviewed:

- production runtime surfaces under app, modules, shared, lib, components,
  hooks, types, scripts, and prisma;
- the current public entries and import graphs of Stock, Routine, Leave,
  Employee, Department, Notification, Audit, Auth, and LINE;
- direct Prisma delegate access and model-level ownership;
- callers of compatibility adapters and legacy-looking paths;
- scripts/check-architecture.mjs and
  __tests__/architecture/check-architecture.test.ts;
- current architecture documents and migration histories;
- git history for the Stock Dashboard/LIFF migration boundary.

The architecture check scanned 982 repository source files and passed. The
repository currently contains no observed deep cross-module import, shared to
module import, client-to-server graph violation, or business-module import of
the global outbox processor.

### Documentation consistency result

The current-state references in modular-monolith.md, module-boundaries.md,
dependency-rules.md, modules/README.md, and shared/README.md now link to this
record and no longer describe Auth Audit producers as deferred. Historical
migration records intentionally retain their phase snapshots, including the
Audit I3/Auth-deferred wording and the J0 browser inventory. The J3 closure
sections and current production code supersede those historical snapshots.
The Stock migration status remains accurate: its documented Phase C scope
migrated server/business and Dashboard/client ownership, while the active Stock
LIFF presentation is recorded here as the remaining correction slice.

## 2. Current Capability Map

| Capability / responsibility | Authoritative owner | Server entry | Client entry | Persistence owner | Status |
| --------------------------- | ------------------- | ------------ | ------------ | ----------------- | ------ |
| Stock | modules/stock | @/modules/stock | @/modules/stock/client | Stock category, item, variant, transaction, request, and request-item persistence in modules/stock | Server and Dashboard migrated; Stock LIFF boundary remains a K0 finding |
| Routine | modules/routine | @/modules/routine | @/modules/routine/client | Routine persistence in modules/routine | Migrated |
| Leave | modules/leave | @/modules/leave | @/modules/leave/client | Leave persistence in modules/leave | Migrated |
| Employee | modules/employee | @/modules/employee | @/modules/employee/client | Employee persistence and Employee-owned workforce fields in modules/employee | Migrated |
| Department | modules/department | @/modules/department | None; server-only by design | Department persistence in modules/department | Migrated reference-data capability |
| Notification Inbox | modules/notification | @/modules/notification | @/modules/notification/client | Notification persistence in modules/notification | Migrated; Inbox semantics only |
| Audit | modules/audit | @/modules/audit | @/modules/audit/client | AuditLog persistence in modules/audit | Migrated |
| Auth / Session / Account Identity | modules/auth | @/modules/auth | @/modules/auth/client | Auth-owned User account fields, AuthRefreshToken, and PasswordResetToken in modules/auth | Migrated in J3; route adapters remain where contracts require them |
| LINE / LIFF identity | modules/line | @/modules/line | @/modules/line/client | LineAccountLink in modules/line | Migrated in J3; messaging transport remains platform-owned |
| Email Request | No capability module yet; current surfaces are app, lib, components, hooks, types | Route adapter at app/api/email-request; business service in lib/services/email-request | App/components/hook surfaces | EmailRequest and EmailRequestIdempotency in current lib service; NotificationOutbox event | Intentionally deferred to future modules/it |
| NotificationOutbox | Shared platform service at lib/services/outbox | Internal processor used by app cron and delivery wakeups | None | NotificationOutbox lifecycle in shared processor; business modules enqueue event rows | Correct shared/platform boundary; not part of modules/notification |
| Email transport | Shared platform/integration at lib/email/transport.ts | Internal transport facade | None | External SMTP/provider state | Correct platform boundary; business payload composition is not generic |
| LINE Messaging transport | Shared platform/integration at lib/line/messaging.ts and related config/signature code | Internal transport facade | None | External LINE provider state | Correct platform boundary; business Flex composition is not generic |
| Dashboard shell and delivery | app/components delivery composition | app/dashboard routes and layouts | App-owned composition and shared browser shell | No domain persistence owner | Correct application/delivery ownership |

## 3. Remaining Production Surface Inventory

Classification uses A-F from the K0 brief:

- A — Correct application/delivery ownership
- B — Correct shared/platform ownership
- C — Intentional compatibility seam
- D — Intentionally deferred business boundary
- E — Proven obsolete migration residue
- F — Remaining ownership violation

| Path / area | Responsibility | Current owner | Evidence / consumers | Classification | Correct disposition |
| ----------- | -------------- | ------------- | -------------------- | -------------- | ------------------- |
| app/api routes for migrated capabilities | Authentication, parsing, route delivery, response compatibility, and delegation to module entry points | app delivery | Stock, Routine, Leave, Employee, Department, Notification, Audit, Auth, and LINE route adapters call supported module entries | A | Keep route adapters thin and app-owned |
| app/dashboard, app/liff shell, layouts, loading, navigation, and generic feedback | Page composition, route selection, shell, navigation, generic access/loading behavior | app/components delivery | Current Dashboard and LIFF shell composition; feature entries are module-owned where migrated | A | Keep in app/delivery; do not move the shell into a capability |
| components/dashboard/shared/YearlyReportExportPanel.tsx and generic UI primitives | Props-driven presentation and generic controls | shared/application presentation | No capability persistence or workflow policy; callers provide data and callbacks | A | Keep generic and props-driven |
| app/_lib/auth/current-user.ts and related session composition | Delivery-level current-user and cross-capability page projection | app/auth composition | Combines Auth account identity with Employee and Leave display/projection data | A | Keep as composition; authoritative account/workforce rules remain in modules |
| app/api/cron/notification-outbox and app/api/line/webhook | Cron/webhook delivery adapters | app/platform boundary | Cron invokes the global outbox processor; webhook verifies the LINE boundary and returns a delivery response | A | Keep as delivery adapters |
| hooks/useDebouncedValue.ts, hooks/use-mobile.ts, hooks/useTitle.ts, types/dashboard.ts, Dashboard context/session-management/feedback components | Generic browser state, page metadata, Dashboard session presentation, and loading/feedback composition | app/shared delivery | No domain persistence or capability workflow; session-management calls existing Auth HTTP contracts | A | Keep as application/shared presentation; preserve Auth compatibility contracts |
| lib/db, lib/network, lib/security, lib/server/request-body, lib/server/csv/xlsx, lib/helpers, lib/uploads, lib/ui/utils, and generic lib/client utilities | Database lifecycle, transaction/lock helpers, request limits, security primitives, file/export mechanics, and browser infrastructure | shared/platform | Used by multiple boundaries without domain policy; Prisma access is restricted by capability ownership where required | B | Keep shared; do not turn shared into a domain service |
| lib/ssot and route/permission/request-limit constants | Stable application source-of-truth for route, permission, request, export, and feature-flag contracts | application/platform | Referenced by route guards and delivery code; not a capability persistence owner | A | Keep centralized where cross-route application ownership is evidenced |
| shared/identity/display.ts | Neutral browser-safe identity display/fallback helpers | shared/platform | Deliberately avoids importing Employee or persistence; consumed by shared presentation | B | Keep neutral and dependency-safe |
| lib/email/transport.ts and generic email primitives | SMTP/provider connection, retry-safe transport concerns, and generic message delivery | platform/integration | No Stock, Leave, Routine, or Email Request business policy in the transport itself | B | Keep platform-owned |
| lib/line/messaging.ts, config, verify-signature, errors, and generic app notification adapter | LINE provider transport, signature verification, credentials, errors, and generic recipient delivery | platform/integration | Used by capability-owned notification orchestration; app-notification resolves the narrow LINE identity contract | B | Keep platform-owned; retain capability-owned payload semantics elsewhere |
| lib/services/outbox/processor.ts and lib/services/outbox/provider-key.ts | Claim lifecycle, retry/backoff, stale recovery, dead-lettering, superseding, scheduling, and provider dispatch | shared/platform | Directly owns NotificationOutbox lifecycle; no business module imports the processor | B | Keep outside modules/notification; capability modules own event meaning and enqueue contracts |
| lib/auth/** | Session/JWT/cookie primitives, API session adapters, employee eligibility guards, CSRF/rate-limit and compatibility behavior | Auth/platform delivery seam | Active consumers include app API/page routes; authoritative account/session behavior is modules/auth, with Employee/LINE contracts where needed | C | Keep until route contracts are intentionally narrowed; do not duplicate Auth domain behavior |
| lib/server/audit.ts | Best-effort audit adapter preserving the existing server call contract | Audit compatibility seam | Current consumers are app/api/email-request/route.ts, app/api/employees/export/route.ts, app/api/leave/export/route.ts, and app/api/audit-logs/export/route.ts; migrated Auth producers call modules/audit directly | C | Remove only after those consumers adopt the supported Audit contract |
| lib/services/notifications/in-app.ts | Explicit-user/idempotent in-app notification compatibility helper | Notification compatibility seam | Current production consumer is Email Request; authoritative Inbox persistence and commands are modules/notification | C | Remove or relocate with the future IT migration |
| lib/validations/stock.ts | Type-only compatibility facade for Stock schemas | Stock compatibility seam | Used by lib/client/liff-stock.ts and modules/stock/presentation/dashboard/components/stockRequestSubmission.ts; runtime schemas are exported by modules/stock | C | Remove when remaining callers consume the module browser/public contract |
| lib/validations/auth.ts | HTTP-boundary parsing schemas for Auth route contracts | app/Auth delivery seam | Used by signup, forgot-password, and reset-password route adapters; not a persistence owner | C | Keep while those route contracts remain; move only with an approved public Auth route contract |
| lib/line/rich-menu.ts and legacy rich-menu scripts | Operator-facing LINE rich-menu provisioning and compatibility command names | platform/operator integration | scripts/line-rich-menu.ts, scripts/generate-nhf-rich-menu.ts, and legacy aliases compose module URLs | C | Preserve operator contracts; retire aliases only after an explicit operational cutover |
| components/liff/stock/**, lib/client/liff-stock.ts, and lib/types/stock-liff.ts | Stock LIFF UI, browser API helper, and Stock LIFF DTOs | Legacy/deferred Stock presentation surface | app/liff/stock/page.tsx imports components/liff/stock/LiffStockApp.tsx; helper/types are active and Stock-specific | F | Complete the Stock browser boundary in a later Stock correction slice; do not change in K0 |
| lib/email/index.ts and lib/email/templates/stock-request-result.ts Stock portions | Stock request-result subject, template, status, item, and cancellation meaning mixed into the generic email facade | Generic provider facade | sendStockRequestResultNotification and Stock HTML/text template are active from Stock/outbox paths | F | Keep transport generic but move Stock payload/template composition behind the Stock boundary later |
| lib/line/index.ts and lib/line/flex-messages/stock*.ts Stock portions | Stock request/low-stock/result Flex composition and Stock-specific send functions | Generic provider facade | modules/stock/infrastructure/notifications imports Stock functions/composers; outbox processor dispatches Stock events | F | Move Stock payload composition and capability-facing send contract to Stock later; retain LINE transport in platform |
| types/api.ts Stock payload types | Stock-specific line payload DTOs mixed with generic LINE Flex types and deferred Email Request data | Mixed shared type surface | Stock notification code and provider facades import StockRequestLineData and StockLowLineData | F | Split capability payloads from generic provider message types in the same later Stock correction |
| components/dashboard/shared/RequestStatusBadge.tsx | Status-to-label/color mapping for Leave and Stock workflows | Shared UI location | Imports from Leave/Stock presentation use it, but the component itself defines PENDING, APPROVED, REJECTED, NOT_TAKEN, ISSUED, and related business semantics | F | Keep the visual primitive generic; move feature status metadata into Leave/Stock or pass feature-owned metadata |
| lib/services/email-request/**, app/api/email-request/**, components/email/**, dashboard Email Request surfaces, hooks/useEmailRequestHistory.ts, types/email-request.ts, and lib/line/flex-messages/email-request.ts | Email Request business workflow, UI, persistence access, recipient policy, Audit production, and delivery payloads | Transitional application/lib surface | Active API, UI, outbox, in-app, Audit, and LINE consumers; no modules/email-request exists | D | Preserve as-is in K0 and define the complete future modules/it boundary before migration |
| lib/line/index.ts `sendLineWebhook`, lib/line/types.ts `LineWebhookData`, and `LINE_WEBHOOK_URL` | Retained legacy outbound webhook compatibility integration | Shared/platform compatibility seam | No repository-local production caller; README, `.env.example`, `docs/line-routine.md`, and the local ignored environment still advertise the outbound contract; `app/api/line/webhook` is a separate inbound signature-verification route | C | FORMALLY RETAINED in L6; remove only after every active deployment and external integration confirms the variable/path is unused |
| scripts/stock-inventory-audit.ts, scripts/stock-default-variant-backfill.ts, and MySQL test runner | Operator/data-maintenance/test tooling | tooling/application boundary | Explicit scripts, fixtures, and integration harnesses; not runtime business ownership | A | Keep outside modules unless a future operational design requires otherwise |
| prisma/schema.prisma, prisma/migrations/**, and prisma/seed.ts | Single physical schema, migration history, and seed/support code | shared persistence/tooling | User, capability, deferred Email Request, and outbox models remain in one Prisma boundary; seed is an explicit support exception | B | Preserve the single schema and migration boundary; no K0 schema changes |

The F rows are the only current ownership findings. The D row is intentional
deferment, not a violation. The former E rows were L6 candidates; their
current dispositions are recorded in Sections 11 and the L6 closure below.

## 4. Compatibility Seam Ledger

| Seam | Authoritative owner | Remaining consumers | Preserved contract | Removal condition | Guard status |
| ---- | ------------------- | ------------------- | ------------------ | ----------------- | ------------ |
| lib/auth/server.ts, lib/auth/api.ts, lib/auth/workforce.ts, and related auth adapters | modules/auth, with modules/employee and modules/line for their supported projections | App API/page routes and legacy delivery callers | Existing session/cookie/API response shape and employee eligibility behavior | All consumers use explicitly supported Auth/Employee/LINE public contracts and no legacy response shape is required | Partially protected: Auth public-entry and browser graph guards exist; exact adapter consumer allowlist is not enforced |
| lib/server/audit.ts | modules/audit | Email Request API and Employee, Leave, and Audit export routes | Existing best-effort appendAudit call shape and export compatibility | Email Request and all export routes adopt the supported modules/audit contract | Guard blocks migrated producers but does not enforce the exact remaining consumer set |
| lib/services/notifications/in-app.ts | modules/notification | Email Request notification integration | Explicit-recipient, idempotent Inbox creation contract | Future IT owns Email Request notification semantics and uses the supported Notification entry | No exact-consumer guard; current architecture relies on caller audit |
| lib/validations/stock.ts | modules/stock | Stock Dashboard submission code and Stock LIFF API helper | Existing type imports without moving runtime validation ownership | Stock LIFF and remaining dashboard callers consume modules/stock public schema/client contracts | No exact-consumer guard; Stock public entry is enforced, but this facade is not narrowed |
| lib/validations/auth.ts | modules/auth plus app route contracts | Auth signup and password recovery route adapters | Existing HTTP input schemas and error behavior | Auth route contract is intentionally exposed from the supported Auth boundary | Documentation-led; route parsing is not duplicated in module persistence |
| lib/line/rich-menu.ts and legacy script aliases | LINE integration plus module-provided LIFF URLs | Operations/scripts and existing command names | Rich-menu provisioning command names and generated URL shape | Operations explicitly retire legacy command names and verify deployed menus | Script/path existence is visible, but retirement conditions are operational rather than checker-enforced |
| Dashboard legacy URL/query compatibility in app/lib/ssot routes | app delivery | Existing inbound links/bookmarks and dashboard navigation | Redirects/query aliases and route-level access behavior | Inbound compatibility demand ends and redirects/aliases are deliberately removed | App route checks exist; no automatic external-link inventory |

Compatibility code is not removed merely because the authoritative capability
has moved. Each seam above has a concrete remaining consumer or contract. The
L6 removed the Audit re-export seam only after package/deployment evidence
showed that the private source path was not a supported repository-visible
consumer. The outbound LINE compatibility contract remains listed as a seam
because current configuration/documentation and unavailable live deployment
evidence do not justify deleting it.

## 5. Deferred Boundary Inventory

| Deferred boundary | Current surfaces | Why deferred | Future owner | Migration trigger | Risks / prerequisites |
| ----------------- | ---------------- | ------------ | ------------ | ----------------- | --------------------- |
| Email Request / future IT | app/api/email-request/route.ts; lib/services/email-request/**; lib/validations/email-request.ts; lib/constants/email-request.ts; lib/types/email-request.ts; components/email/**; components/dashboard/context/email-request/**; components/dashboard/sections/EmailRequestSection.tsx; hooks/useEmailRequestHistory.ts; app/dashboard/email-request/**; lib/line/flex-messages/email-request.ts; Email Request branches in lib/services/outbox/processor.ts; lib/server/audit.ts and lib/services/notifications/in-app.ts consumers | Product and bounded-context approval is not part of K0. Existing behavior spans workflow, persistence, UI, Audit, Inbox notification, LINE payloads, and outbox delivery and should move as one coherent IT boundary | Future modules/it; never a standalone modules/email-request capability | Approval of the IT bounded context and a migration slice covering API, persistence contract, presentation, event semantics, and compatibility plan | EmailRequest and EmailRequestIdempotency schema; current direct Prisma service; Audit and Inbox contracts; User recipient policy; Auth route/session adapters; Employee/User projections; Department is currently a free-text snapshot, not a relation; at-least-once outbox/provider behavior; existing API/UI compatibility |

No other deferred business capability was invented. Stock LIFF and Stock
provider composition are corrective ownership slices for an already migrated
capability, not new future business modules. NotificationOutbox and provider
transports are intentionally shared/platform boundaries, not deferred
capabilities.

### Future IT Evidence Boundary

The current Email Request service owns creation/query/idempotency behavior,
direct EmailRequest and EmailRequestIdempotency persistence access, recipient
selection for Inbox notifications, outbox event creation, and business
payload meaning. The route owns request-size protection, authentication,
validation, Audit production, outbox wakeup, and response compatibility. The
UI owns the current form/history presentation and dashboard composition.
LINE Flex composition and the Email Request branch of the global processor
carry delivery-specific representations of the same business event.

A future modules/it migration should therefore define, at minimum:

- the Email Request application and persistence-facing contract;
- the API and UI/browser contract;
- event names/payloads and idempotency behavior;
- Audit and Notification integration contracts;
- Email/LINE payload ownership while retaining generic transports;
- the relationship between Auth identity, User/Employee projections, and
  Department display data;
- the compatibility/removal plan for lib/server/audit.ts and
  lib/services/notifications/in-app.ts.

The global outbox claim/retry/dead-letter/scheduling lifecycle, generic SMTP
transport, generic LINE transport/config/signature code, database/transaction
primitives, and supported Auth/Employee/Department contracts should remain
outside IT unless a future approved design proves otherwise.

## 6. Shared / Platform Boundary Inventory

| Responsibility | Current location | Why it is shared/platform or application-owned | Boundary rule |
| -------------- | ---------------- | ----------------------------------------------- | ------------- |
| Database client, transactions, row locks, and generic persistence helpers | lib/db/** and Prisma runtime setup | Stable infrastructure used by multiple capabilities; capability repositories still own domain delegates and invariants | Shared code may provide mechanics, not domain policy |
| NotificationOutbox processor | lib/services/outbox/processor.ts | Owns reliable asynchronous delivery lifecycle: claim, retry/backoff, stale recovery, dead-letter, supersede, wakeup, and provider dispatch | Business modules own event meaning/recipient policy and enqueue rows; no module imports the processor |
| SMTP/email transport | lib/email/transport.ts and generic email primitives | Owns provider connection and delivery mechanics | Stock, Leave, Routine, and future IT own payload meaning; transport remains generic |
| LINE Messaging transport and security boundary | lib/line/messaging.ts, config.ts, verify-signature.ts, errors.ts | Owns provider calls, credentials, signature verification, and integration errors | Capabilities own event meaning and Flex payload composition; provider transport remains generic |
| Generic LINE recipient/application notification adapter | lib/line/app-notification.ts | Provides neutral recipient eligibility and delivery composition across capabilities | Must consume supported LINE identity contracts and not own business event semantics |
| Auth/session/security/request infrastructure | lib/auth/**, lib/security/**, lib/network/** | Framework and security boundary behavior is reused across route families | Auth capability owns account/session policy; adapters preserve delivery contracts |
| Dashboard and LIFF shell | app/** and generic components/liff/**, components/dashboard/** | Route composition, navigation, loading, feedback, and generic shell behavior are delivery concerns | Feature presentation uses module client entries where a contract exists |
| Neutral identity/UI primitives | shared/identity/** and components/ui/** | Stable primitives with no capability persistence or workflow meaning | Keep dependencies browser-safe and domain-neutral |
| Export/request/file mechanics | lib/server/**, lib/uploads/**, lib/client/** generic utilities | Generic request parsing, file/export, and browser transport mechanics | Feature schemas and policy remain with the owning capability |

The word lib does not by itself indicate architectural debt. The findings
above are based on responsibility: generic transport and runtime mechanics stay
platform-owned, while Stock-specific and Email Request-specific message
meaning remains with the business boundary.

## 7. Persistence Ownership Matrix

| Prisma model / persistence area | Authoritative owner | Direct production access locations | Exceptions | Status |
| ------------------------------- | ------------------- | ---------------------------------- | ---------- | ------ |
| User account fields and account identity | modules/auth for account/session fields; modules/employee for workforce linkage and Employee-owned fields | modules/auth/infrastructure/persistence/account-repository.ts; Employee repositories and lifecycle code; capability projections where policy requires them | User is intentionally field-level/shared; no whole-model ownership claim | Consistent with established field-level architecture |
| LineAccountLink | modules/line | modules/line/infrastructure/persistence/account-link.ts | None found in production capability code | Exclusive direct owner; checker enforces it |
| AuthRefreshToken | modules/auth | modules/auth/infrastructure/persistence/refresh-token-repository.ts | Tests/support code only | Exclusive direct owner; checker enforces it |
| PasswordResetToken | modules/auth | modules/auth/infrastructure/persistence/password-reset-repository.ts | Tests/support code only | Exclusive direct owner; checker enforces it |
| Employee | modules/employee | modules/employee infrastructure/application code and supported projections | Auth and Leave consume supported Employee contracts/projections; they do not own Employee persistence | Consistent; no app route direct delegate bypass found |
| Department | modules/department | modules/department/infrastructure/persistence/department-repository.ts | prisma/seed.ts is an explicit seed/support exception | Exclusive runtime owner; checker allows seed/support exception |
| AuditLog | modules/audit | modules/audit/infrastructure/persistence/audit-log-repository.ts | Tests/support code only | Exclusive direct owner; checker enforces it |
| Notification | modules/notification | modules/notification/infrastructure/persistence/repository.ts | Business modules use supported Notification commands; they do not access the delegate | Exclusive direct owner; checker enforces it |
| NotificationOutbox | Shared platform processor plus capability-owned enqueue/claim contracts | lib/services/outbox/processor.ts for lifecycle; modules/stock, modules/routine, and modules/leave for transactional event enqueue and capability-specific recheck/claim contracts | Notification is not the owner of this model or processor | Intentional shared/platform boundary |
| EmailRequest | Future modules/it | lib/services/email-request/queries.ts and mutations.ts | Current transitional ownership is intentionally outside modules/** | Deferred; no migration in K0 |
| EmailRequestIdempotency | Future modules/it | lib/services/email-request/mutations.ts | Idempotency is part of the deferred Email Request workflow | Deferred with Email Request |
| Stock capability persistence | modules/stock | modules/stock infrastructure/application repositories | Provider/outbox rows remain shared; projections are read through supported contracts | Consistent |
| Routine capability persistence | modules/routine | modules/routine infrastructure/application repositories | NotificationOutbox remains shared | Consistent |
| Leave capability persistence | modules/leave | modules/leave infrastructure/application repositories | NotificationOutbox remains shared | Consistent |

The direct delegate audit found no accidental production access to AuditLog,
Notification, LineAccountLink, AuthRefreshToken, PasswordResetToken, or
Department outside their established owners. Direct User/Employee reads by
capabilities are not automatically violations: the established architecture
allows field-level ownership and policy-specific projections.

## 8. Cross-Module Dependency Findings

### Finding F-1 — Stock LIFF presentation is outside the Stock browser boundary

Severity: Medium
Exact location: app/liff/stock/page.tsx; components/liff/stock/**;
lib/client/liff-stock.ts; lib/types/stock-liff.ts
Current behavior: The Stock LIFF route imports LiffStockApp from
components/liff/stock. That active client graph imports modules/stock/client
and modules/line/client, but its Stock browser API helper, DTOs, and
feature-specific UI remain outside modules/stock/client.
Why it is a boundary problem: Stock has an established browser entry and other
migrated LIFF capabilities use their module client entries. The active Stock
presentation is therefore an exception to the documented capability boundary,
even though its current imports are browser-safe.
Runtime/regression scenario: A future Stock contributor can add server-only
imports or business policy to the legacy LIFF graph without the Stock client
boundary being checked. The same Stock presentation contract is also split
between module and legacy paths.
Smallest future correction: Move or explicitly re-home the Stock LIFF
presentation, browser helper, and DTO contract behind the existing
modules/stock/client entry, preserving the modules/line/client integration and
the current route/API contract. Do not create a new capability.
Recommended phase: K1 — Stock browser-boundary completion.
Verification after correction: Add a focused Stock client-graph architecture
test, verify no server/Prisma dependency is reachable, run the Stock LIFF
component/API tests, and run the aggregate architecture/lint/type/test checks.

### Finding F-2 — Stock channel composition is mixed into generic provider facades

Severity: Medium
Exact location: lib/email/index.ts; lib/email/templates/stock-request-result.ts;
lib/line/index.ts; lib/line/flex-messages/stock.ts;
lib/line/flex-messages/stock-low.ts;
lib/line/flex-messages/stock-request-result.ts;
modules/stock/infrastructure/notifications/line-notifications.ts;
modules/stock/infrastructure/notifications/notifications.ts
Current behavior: Generic email/LINE facades contain Stock-specific subjects,
templates, Flex payload composition, statuses, item fields, and send functions.
The global outbox processor dispatches those provider-specific Stock functions.
Why it is a boundary problem: SMTP and LINE transport mechanics are correctly
platform-owned, but the business meaning and channel payload composition are
Stock policy. The current layout makes generic provider modules a second home
for Stock semantics.
Runtime/regression scenario: Changes to Stock event meaning or status mapping
can bypass the Stock public contract and diverge between email, LINE, and Inbox
delivery while still passing generic provider checks.
Smallest future correction: Keep transport/configuration in lib/email and
lib/line, but move Stock templates/Flex composers and the Stock-facing delivery
contract behind modules/stock. Preserve outbox event semantics and at-least-
once delivery behavior.
Recommended phase: K1 or a directly sequenced K1b after the Stock browser
boundary slice.
Verification after correction: Add contract tests for Stock channel payloads,
verify the generic transport has no Stock imports, exercise outbox dispatch for
Stock events, and run the aggregate checks.

### Finding F-3 — Shared RequestStatusBadge owns capability status semantics

Severity: Medium
Exact location: components/dashboard/shared/RequestStatusBadge.tsx
Current behavior: The component maps Leave and Stock workflow statuses to
labels, colors, and display behavior, including Leave-specific and
Stock-specific values. It is consumed by feature presentation.
Why it is a boundary problem: A shared visual primitive is appropriate, but
feature-specific status semantics and labels belong to the owning capability.
The component currently combines multiple domain vocabularies under a shared
path.
Runtime/regression scenario: A Leave or Stock workflow status can be added or
renamed without the owning module's policy and presentation contract being the
single source of truth.
Smallest future correction: Keep a generic badge component and move status
metadata/translation/mapping into Leave and Stock presentation, or pass
feature-owned label/color metadata into the generic component.
Recommended phase: K1, coordinated with the Stock boundary correction and
Leave/Stock presentation review.
Verification after correction: Test feature status mappings at module level,
verify the shared component has no capability-specific status constants, and
run UI/type/lint tests.

### No current Critical/High cross-module violation

The architecture checker passed without deep module imports, shared-to-module
imports, prohibited module-to-processor imports, or client graphs reaching
Prisma/Node/server capability entries in the checked capability set. Manual
inspection also found no prohibited cross-module cycle. These are findings
about current observed behavior, not a claim that every possible dependency
cycle is automatically detected.

## 9. Architecture Checker Coverage

| Invariant | Currently enforced? | Enforcement location | Gap | Recommended action |
| --------- | ------------------- | -------------------- | --- | ------------------ |
| Modules expose supported server root entries and reject cross-module deep imports | Yes | scripts/check-architecture.mjs; architecture tests | No material gap observed | Keep |
| Browser consumers use client entries and cannot reach server capability entries | Yes for Leave, Employee, Department, Notification, Audit, Auth, and LINE | scripts/check-architecture.mjs; architecture tests | Stock and Routine client graphs are not walked with the same explicit guard | Add focused guards only in a later corrective slice after confirming the stable invariant |
| shared/** cannot import modules/** | Yes | scripts/check-architecture.mjs and tests | No material gap observed | Keep |
| Business modules cannot import the global outbox processor | Yes | scripts/check-architecture.mjs | Processor ownership is not otherwise modeled as a public module contract | Keep the negative guard; document the platform boundary |
| Notification persistence is exclusive to modules/notification | Yes | Notification delegate scan in checker and tests | No material gap observed | Keep |
| AuditLog persistence is exclusive to modules/audit | Yes | Audit delegate scan in checker and tests | No material gap observed | Keep |
| LineAccountLink persistence is exclusive to modules/line | Yes | LINE delegate scan in checker and tests | No material gap observed | Keep |
| Auth token persistence is exclusive to modules/auth | Yes | Auth token delegate scans in checker and tests | User field-level ownership is not mechanically modeled | Keep narrow guards; retain documentation for User field ownership |
| Department persistence is exclusive to modules/department except seed/support | Yes | Department delegate scan in checker and tests | No material gap observed | Keep |
| Completed capability route/deleted-path regressions are rejected | Yes for the migrated capability-specific paths | Explicit route and deleted-path guards | It does not cover all legacy-looking ownership paths | Keep evidence-backed guards; avoid broad path purity rules |
| Exact remaining consumers of lib/server/audit.ts and in-app compatibility adapters | No | Current docs and caller searches only; checker only blocks selected migrated producers | New generic consumers could be added without a targeted failure | Consider a narrow allowlist guard after the remaining consumer set is intentionally finalized |
| Stock-specific provider composition stays with Stock | No | Documentation and current import evidence | Generic provider facades can regain business semantics | Add only with the future Stock correction, not speculatively in K0 |
| Email Request remains deferred to future modules/it | No | Current docs and this audit | No modules/it exists yet and no stable checker rule can be applied | Revisit when IT is approved; do not add a placeholder rule/module |
| General dependency-cycle detection | No | No repository-wide cycle rule in the current checker | Current manual/public-entry review found no prohibited cycle | Add only if a stable cycle invariant and practical regression test are defined |
| Direct Prisma access for every model outside an explicit owner | Partial | Narrow model-specific guards plus documentation | Legacy Email Request and shared outbox ownership are intentional exceptions; not every model has a guard | Extend only when a concrete ownership invariant and regression path justify it |

The audit does not change the checker in K0. The gaps above are recorded as
future guard candidates only where a stable invariant and realistic regression
path exist.

## 10. Deferred Technical Debt

| Item | Type | Current impact | Why not K0 | Trigger / future action |
| ---- | ---- | -------------- | ---------- | ----------------------- |
| Notification history cursor uses timestamp-only ordering/continuation semantics | Technical debt / query compatibility risk | Equal timestamps can make history continuation ambiguous | It does not change module ownership and a cursor redesign would alter API/query behavior | Define a stable unique cursor contract, then add focused query/API tests |
| Historical TICKET_* enum/storage values | Data compatibility constraint / intentional legacy compatibility | Old rows and historical display/filter behavior depend on retained values | Removing or rewriting values would be a data migration and behavior change | Only revisit with an explicit data-compatibility plan and migration |
| Auth refresh replay/race, process-local rate limits, and related hardening notes | Security/technical debt | Narrow operational and concurrency risks remain documented by the Auth migration | K0 is not an Auth behavior hardening phase and changing it would alter security/runtime behavior | Separate security hardening review with threat model and tests |
| LINE account-link reread and refresh/audit metadata hardening notes | Security/technical debt | Operational consistency and audit detail can be improved | No current boundary violation or required migration | Address through a focused Auth/LINE security slice |
| Legacy Audit export/Leave entity-id/detail compatibility | Data compatibility constraint | Existing exports and historical rows retain older representations | K0 must preserve the contract and does not redesign persistence | Revisit only with explicit export/data compatibility acceptance criteria |
| Email Request Department free-text snapshot and lack of Department relation | Deferred-boundary/product compatibility | Future IT must preserve what users currently see/send | This is part of the future IT decision, not an accidental Department persistence bypass | Decide future IT representation before migration; preserve historical snapshots |
| At-least-once provider delivery and external idempotency behavior | Intentional reliability tradeoff / technical debt candidate | Provider dispatch can require retry and deduplication semantics | Redesigning outbox/provider behavior is explicitly out of K0 scope | Revisit only as a reliability design, without moving the shared processor into Notification |
| No organization/tenant model | Intentional product constraint | NHF remains single-organization | Reviving Organization would contradict the established decision | No action unless product scope explicitly changes |

Runtime/security/reliability hardening is a separate L-series track from the
historical K0/K1 modular-boundary work. Its authoritative current-state record
is [`docs/architecture/runtime-hardening.md`](./runtime-hardening.md). Email
Request / future IT remains deferred and is not part of that hardening track.

## 11. Obsolete-Code Candidates

This section preserves the historical K0 candidate inventory. “Obsolete
candidate” means no legitimate repository production consumer was found; the
L6 action column records whether the candidate was removed or formally
retained after external/operator evidence review.

| Path | Evidence it is obsolete | Removal risk | Recommended future action |
| ---- | ----------------------- | ------------ | ------------------------- |
| lib/services/audit-log/index.ts, mutations.ts, queries.ts, and types.ts | Repository-wide production search found no consumer; current app routes use modules/audit directly; files were re-exports/types from the migrated location | Low inside the repository; package is private, has no export map, deployment instructions build from source, and no repository deployment/operator consumer was found | **REMOVED in L6** after the repository/package/deployment/build-source evidence review; the duplicate legacy `UserContext` was not moved |
| lib/line/index.ts `sendLineWebhook` export and lib/line/types.ts `LineWebhookData` | No production caller found; `app/api/line/webhook` verifies the incoming signature and does not send a webhook payload; current docs/config still advertise `LINE_WEBHOOK_URL` | External deployment/integration usage is not observable from the repository | **FORMALLY RETAINED in L6**; remove only after deployment owner and every external integration confirm `LINE_WEBHOOK_URL` and the outbound helper are unused |
| lib/line/types.ts duplicate `VerifiedLineIdentity` type | Current authoritative identity type is `modules/line/application/types.ts`; no repository consumer, package export, or runtime use of the legacy type was found | No runtime transport dependency; a direct external source import cannot be observed | **REMOVED in L6** independently; `modules/line` exports the authoritative type and LIFF verification remains unchanged |

No other runtime artifact was classified as obsolete solely because its path
looks legacy. In particular, lib/auth, lib/email/transport, lib/line
transport/configuration, lib/services/outbox, and compatibility adapters with
active callers are not obsolete migration residue. Email Request remains
deferred and was not migrated as part of L6.

## 12. Recommended Post-K0 Roadmap

### K1 — Complete the remaining Stock ownership boundary

This is justified by F-1 through F-3. Sequence the smallest coherent slices:

1. establish the Stock LIFF browser contract under the existing
   modules/stock/client entry;
2. move Stock-specific email/LINE payload composition behind Stock while
   preserving generic transports and outbox lifecycle;
3. remove capability-specific status mapping from shared UI.

Do not create a new capability module or deployment boundary. Add architecture
guards only for the stable Stock client/provider invariants confirmed during
the implementation.

### Future IT — Migrate Email Request into modules/it

Begin only after the IT bounded context, public contracts, persistence/event
compatibility, and migration sequencing are approved. Email Request must move
as one coherent business boundary and must not become a standalone
modules/email-request capability.

### No additional K2 phase is currently justified

The audit found no second independent remaining business capability outside
the boundaries above. Generic platform/application surfaces should remain
where they are. Obsolete candidates can be cleaned up separately after
external-consumer verification and are not a capability migration.

### Explicit dispositions

- Email Request -> deferred future modules/it
- NotificationOutbox -> shared/platform
- LINE Messaging transport -> platform/integration
- Email transport -> platform/integration
- Dashboard shell -> app/delivery

## K0 Conclusion

The modular-monolith migration is structurally coherent and has no observed
Critical or High boundary violation. It is not accurate to claim that every
feature-specific production surface is already behind a capability entry:
the Stock presentation/provider findings remain. Therefore K0 concludes
PASS WITH FINDINGS, with a narrowly scoped K1 Stock correction and a
product-driven future IT migration as the only evidence-backed roadmap items.

No production code, API, UI behavior, authorization behavior, persistence
behavior, Prisma schema, migration, or runtime integration was changed by this
audit.

## K1 closure — current state after the K0 audit

Phase K1 is closed against the three evidence-backed K0 Medium findings:

- K0 F-1 CLOSED by K1: Stock LIFF presentation, browser transport, and neutral
  LIFF contracts are under `modules/stock/**`; the App Router route consumes
  only `@/modules/stock/client`.
- K0 F-2 CLOSED by K1: Stock email and LINE message meaning is under Stock;
  generic SMTP/LINE transports remain platform-owned. The Stock operational
  channel still uses `LINE_STOCK_CHANNEL_ACCESS_TOKEN`, while personal result
  LINE still uses `LineAccountLink` and the LINE_APP path.
- K0 F-3 CLOSED by K1: `RequestStatusBadge` is a neutral renderer. Leave and
  Stock own their separate status metadata sources with the existing labels,
  icons, classes, and colors.

The global Outbox Processor remains shared/platform infrastructure and now
dispatches all four Stock event types through `@/modules/stock`. Stock owns
payload validation, business/channel interpretation, in-app-before-channel
ordering, Stock composition, and Stock supersede behavior; the processor still
owns generic claim/retry/backoff/stale/dead-letter lifecycle and final state
transitions.

K1 removed the obsolete Stock LIFF/provider compatibility paths and the
zero-consumer `lib/validations/stock.ts` facade. No Email Request/IT migration,
Prisma schema change, database migration, API URL change, or UI redesign is
part of K1.

Stock modular-monolith ownership boundary COMPLETE.
No additional K2 modular-boundary phase is currently justified.
Future IT / Email Request remains deferred.

## L6 closure — compatibility and obsolete residue cleanup

L6 is closed for the two candidate groups named by the runtime hardening
audit. The current source tree and compatibility ledger now distinguish
removed residue from a retained external contract:

- `L0-COMPAT-01`: **REMOVED** — all four files under
  `lib/services/audit-log/`.
- `L0-COMPAT-02`: mixed symbol-level result — `sendLineWebhook`,
  `lineNotificationService.sendLineWebhook`, `LineWebhookData`, and
  `LINE_WEBHOOK_URL` are **FORMALLY RETAINED**; the duplicate legacy
  `VerifiedLineIdentity` type is **REMOVED**.

The inbound `/api/line/webhook` route, signature verification, active LINE
channel secrets, LINE/LIFF identity contract, Email Request delivery,
Outbox retry keys, Stock legacy broadcast, and NHFapp personal LINE paths were
not redesigned or removed. No Prisma schema or migration changed. Live
deployment variables, Cloudflare/LINE Console configuration, and external
operator consumers were not accessible from this repository, so the retained
outbound contract must not be removed based on repository-local unused status.
