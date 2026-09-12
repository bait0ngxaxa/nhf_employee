# Stock Authorization Migration — Phase 6A / Phase 6B

สถานะ: Phase 6A **server enforcement** และ Phase 6B **presentation projection** เสร็จสิ้น<br>
ขอบเขต: Stock เท่านั้น; ไม่รวม Leave, Employee, Audit หรือ Settings

เอกสารนี้บันทึกการย้าย authorization ของ Stock จาก role/boolean checks ไปยัง central authorization resolver โดยคงพฤติกรรมเดิมเป็น compatibility floor ชั่วคราวตาม [authorization-contract.md](authorization-contract.md), [authorization-resolver.md](authorization-resolver.md) และ [stock-migration.md](stock-migration.md)

## 1. Capability mapping

ใช้ registry เดิมเป็น source of truth และไม่ได้เพิ่มหรือเปลี่ยน capability key:

| Capability | Scope | Channel | Stock server usage |
|---|---|---|---|
| `stock.catalog.read` | `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | item/category/availability reads |
| `stock.inventory.manage` | `ALL` | `DASHBOARD` | item/category mutations, quantity adjustment, item/variant image upload |
| `stock.request.read` | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | request list/detail |
| `stock.request.create` | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` | create a request owned by the authenticated actor |
| `stock.request.cancel` | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | cancel pending requests |
| `stock.request.process` | `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | review/issue and LIFF processing queue |
| `stock.report.export` | `ALL` | `DASHBOARD` | Stock report export |

`modules/stock/application/authorization.ts` is the Stock adapter. It builds an `AuthorizationActor` from trusted server session identity (`userId`, database role, `employeeId` when available and the fixed route channel), calls the central resolver first, and translates only Stock's `OWN`/`ALL` scopes into Stock resource/query behavior. `StockCommandActor` continues to hold audit/request metadata; it is not the authorization authority.

The migration uses this decision order:

```text
central resolver
  -> allowed: honor resolved scopes
  -> NO_APPLICABLE_GRANT: use frozen Stock compatibility floor
  -> any other denial/configuration error: deny or propagate, never bridge
```

Unknown capabilities, unsupported channels and invalid persisted authorization data do not fall through to role compatibility.

## 2. Compatibility floor

The compatibility floor applies only when the resolver returns `NO_APPLICABLE_GRANT`.

### Dashboard

- USER: catalog `ALL`; request read/create/cancel `OWN`; inventory, process and report are denied.
- ADMIN: catalog `ALL`; request read has an `ALL` ceiling, but `scope=mine` remains requester-owned and `scope=all` may query all; create remains `OWN` and requires active workforce; cancel, inventory, process and report are `ALL`. Legacy Dashboard ADMIN eligibility for cancel, inventory and process requires an active account but does not require an Employee profile.

ADMIN is not used as the new policy source. A valid explicit grant can authorize a USER, for example `stock.request.process / ALL`.

### LIFF self-service

- USER: catalog `ALL`; request read/create/cancel `OWN`; process is denied. Dashboard-only inventory and report capabilities remain unsupported.
- ADMIN: catalog `ALL`; the normal requester list remains `mine`; request detail may read `ALL`; create is `OWN`; cancel and process are `ALL`.

LIFF Stock ADMIN is intentionally still a processor under the compatibility floor. This differs from Routine, where LIFF ADMIN is clamped to self-service behavior. The Stock distinction is preserved.

## 3. Request scope and resource translation

`getRequests` no longer accepts `isAdmin: boolean`. It receives the authenticated `userId` and effective capability scopes:

- requested `scope=all` plus effective `ALL` produces an organization-wide request query;
- requested `scope=all` with only `OWN` still produces `requestedBy = actor.userId`;
- requested `scope=mine` always produces the requester-owned query;
- the LIFF requester list explicitly requests `mine`, including for legacy-compatible LIFF ADMIN.

Stock owns the translation from `OWN` to `StockRequest.requestedBy`. The central authorization module does not know Stock request fields or statuses.

LIFF request detail is separate from the requester list. Read `ALL` can expose another user's request to an authorized processor/read actor, while an OWN-only unrelated request keeps the existing not-found response. Read `ALL` never implies `stock.request.process`; serialization exposes ISSUE only from the independent effective process decision. Cancel is likewise resolved independently.

## 4. Mutation enforcement and lifecycle

Routes authenticate and parse their inputs, then use the Stock adapter. Critical Prisma mutations revalidate authorization inside the transaction with `authorization.resolveInTransaction(...)` after locking and re-reading the active User identity. Active Employee status remains required for request creation and for USER/LIFF actors. The legacy Dashboard ADMIN path for inventory, process and cancel preserves the existing Admin eligibility boundary and resolves with `employeeId = null`, so an Admin without an Employee profile remains operational for those capabilities.

- request creation resolves `stock.request.create`; `requestedBy` is derived from the trusted actor, and active workforce, availability, variant, idempotency, rate-limit, outbox and audit behavior remain unchanged;
- cancellation resolves `stock.request.cancel`; `OWN` requires the request owner and `ALL` may cancel an eligible pending request. After loading the request, Stock derives notification mode from legacy ADMIN semantics and the effective scope/resource relationship: ADMIN uses the processor result path, an actor cancelling their own request uses requester notification, and an explicit USER `ALL` actor cancelling another user's request uses the processor result path. Notification mode is not supplied by the route and is never authorization authority;
- processing/issue resolves `stock.request.process` at the application transaction boundary before the atomic pending claim, inventory locks, active item/variant checks, stock transaction and notifications;
- inventory item/category/quantity mutations resolve `stock.inventory.manage` in their transaction before existing locks and domain invariants.

The LIFF processor guard verifies the active linked LIFF workforce first, then resolves `stock.request.process` for `LIFF_SELF_SERVICE`. It no longer uses `isAdminRole()` as its authorization source. Dashboard inventory, processor and cancellation transactions preserve the legacy ADMIN account-only eligibility even when no Employee profile exists; request creation and all USER/LIFF operational paths still require an active workforce actor. Every transaction-backed Stock route maps lifecycle revocation to HTTP 403.

Catalog reads use `stock.catalog.read` and retain catalog-wide visibility; request ownership predicates are not applied to catalog data. Image upload remains limited to the existing `scope=item|variant` Stock workflow and is authorized by `stock.inventory.manage`, not a generic upload capability. Report export uses `stock.report.export`, remains Dashboard-only, and preserves filters, row limits, XLSX behavior and error mapping.

All Stock domain invariants remain in Stock application/domain/infrastructure code: pending-state transitions, inventory availability, active references, locking, concurrency, idempotency, audit, email, LINE notification and outbox behavior are not encoded in the generic authorization module.

## 5. Presentation boundary — Phase 6B

สถานะ: **เสร็จสิ้นสำหรับ Stock presentation projection**

Phase 6B adds the immutable `StockPresentationCapabilities` projection in
`modules/stock/application/authorization.ts`. It uses one centralized
`authorization.resolveMany()` call and the same
`buildStockCapabilityAuthorization()` compatibility translation as Phase 6A.
Expected capability denials become `false`; unknown capabilities, invalid
configuration and structural resolver failures remain fail-closed or propagate
according to the shared authorization architecture.

The projection keeps these decisions independent:

| Presentation capability | Source decision |
|---|---|
| `canReadCatalog` | `stock.catalog.read / ALL` |
| `canReadOwnRequests`, `canReadAllRequests` | `stock.request.read / OWN`, `/ ALL` |
| `canCreateRequests` | `stock.request.create / OWN` |
| `canCancelOwnRequests`, `canCancelAnyRequests` | `stock.request.cancel / OWN`, `/ ALL` |
| `canProcessRequests` | `stock.request.process / ALL` |
| `canManageInventory` | `stock.inventory.manage / ALL` |
| `canExportReports` | `stock.report.export / ALL` |

### Dashboard flow

```text
trusted Dashboard account + active Employee projection
  -> getStockPresentationCapabilities(..., DASHBOARD)
  -> CurrentUserProjection.stockCapabilities
  -> Dashboard menu/direct-route guard
  -> StockProvider tabs, queries and action controls
```

Stock menu and `/dashboard/stock` access require at least one usable Stock
surface. Tabs and controls use the granular projection: catalog browsing,
request creation, own request history/cancellation, organization-wide request
read, processing, any-request cancellation, inventory management and report
export are separate gates. `scope=all` is requested only for
`canReadAllRequests`; processing does not make the organization list visible,
and read-all does not expose processing or cancellation controls.

### LIFF flow

```text
verified LIFF workforce session
  -> getLiffCapabilities(..., LIFF_SELF_SERVICE)
  -> /api/line/home stockCapabilities
  -> LiffHomeApp module state
  -> LiffStockApp capability-aware tabs/data/mutations
```

LIFF Stock waits for the trusted home projection before requesting catalog,
own-request or processing data. The module is usable when catalog, own-request
read or processing is available. The tabs map to those same three capabilities.
The legacy aliases remain temporarily, but are derived only from the
projection:

```text
canRequestStock = canReadCatalog && canCreateRequests
canProcessStockRequests = canProcessRequests
```

The LIFF channel preserves Phase 6A compatibility: LIFF USER is a requester,
LIFF ADMIN remains a processor, and an explicit USER process grant is honored.
The Routine LIFF ADMIN self-service clamp is intentionally not applied to
Stock. Dashboard-only inventory and report capabilities remain unavailable in
LIFF because those registry entries do not support `LIFF_SELF_SERVICE`.

Capability changes during an open UI close or disable stale Stock controls,
normalize stale tabs/deep links to a usable surface, and refresh the home
projection after ambiguous mutation session recovery. No automatic retry uses
an old capability snapshot. All of these are presentation safeguards; Phase
6A route guards, resource relationships, domain state and transaction-time
authorization remain authoritative.

No Prisma authorization schema or migration was added. DENY grants, wildcards,
ABAC, Department/Team semantics, a policy DSL and authorization administration
UI are out of scope. Leave, Employee, Audit, Settings and Routine behavior are
not migrated by this phase.

## 6. Verification record

Focused Stock projection, Dashboard, LIFF home, LIFF bootstrap/order,
capability/tab/action and recovery tests cover compatibility, explicit grants,
channel denial, batching, OWN/ALL separation and stale presentation state.
The repository-wide `npm run check` command is the final verification gate for
architecture, lint, typecheck and the full test suite.
