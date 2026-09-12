# Stock Authorization Migration — Phase 6A / Phase 6B / Phase 6C

สถานะ: Phase 6A **server enforcement**, Phase 6B **presentation projection** และ Phase 6C **migration closure / regression hardening** เสร็จสิ้น<br>
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

## 6. Phase 6C closure audit and hardening

สถานะงานย้าย Stock authorization: **CLOSED**

Phase 6C ตรวจเส้นทาง production และ tests ของ `app/api/stock/**`,
`app/api/line/stock/**`, Stock image upload, Dashboard Stock route/menu/provider,
LIFF Stock/home/session projection, `modules/stock/**`, Stock-related
`modules/line/**` และ current-user projection ตั้งแต่ authentication ไปจนถึง
resolver, adapter, query/resource predicate, transaction และ presentation
consumer โดยไม่เปลี่ยน capability registry หรือ policy ที่อนุมัติไว้

ผล audit ของ role/boolean/resource decisions:

- ไม่พบ `requireAdminSession`, `isAdminRole` หรือ literal ADMIN เป็น authoritative
  decision ใน Stock routes หรือ Stock use cases ที่ migrate แล้ว ทุก HTTP Stock
  operation ในขอบเขต Phase 6 ผ่าน `modules/stock/application/authorization.ts` และ central
  resolver ก่อนใช้ Stock-owned resource/workflow rules
- `isAdmin` ใน Dashboard Stock ถูกเก็บไว้เฉพาะ role badge ซึ่งเป็น
  presentation identity; tab, query, dialog, button และ mutation guard ใช้
  `StockPresentationCapabilities`
- `systemRole === "ADMIN"` ใน Stock adapter ถูกเก็บไว้เฉพาะ compatibility
  floor, legacy Dashboard Admin workforce exception และ cancellation
  notification classification ที่ freeze ไว้ ไม่ได้กระจายกลับไปยัง route/UI
- `requestedBy` เป็น Stock-owned ownership predicate และ audit/notification
  relationship โดย derive จาก trusted actor; ไม่มี client owner/user/team/scope
  value กลายเป็น authority
- `isAdministrative` ใน adapter เป็น descriptive decision metadata และไม่ถูกใช้
  เพื่อ authorize Stock persistence หรือ presentation action
- `canRequestStock` และ `canProcessStockRequests` ยังคงอยู่เฉพาะ LIFF
  cross-module response contract เพื่อ compatibility และ derive จาก canonical
  projection เท่านั้น ไม่มี active Stock presentation consumer ใช้ alias เหล่านี้
  เป็น authorization source

### 6.1 Server/resource closure

Request list ยังคงบังคับ `scope=mine` เป็น requester-owned แม้ actor มี `ALL`;
`scope=all` จะกว้างได้เฉพาะเมื่อ decision ของ `stock.request.read` มี `ALL`.
Phase 6C เพิ่ม ownership predicate ที่ Prisma query ของ request detail ด้วย:
OWN query ใช้ทั้ง request id และ authenticated `requestedBy`; ALL query ใช้ id
โดยไม่เพิ่ม ownership predicate และ route ยังคง defensive relationship check กับ
not-found behavior เดิมไว้

LIFF processor queue ยังคงใช้ `stock.request.process / ALL` ของตัวเอง จึงรองรับ
process-only actor โดยไม่สร้าง `stock.request.read / ALL`. General request-detail
surface ใช้ `stock.request.read` เท่านั้น; Phase 6C แก้ Phase 6B presentation
regression ที่เคยทำให้ process-only capability เปิดปุ่ม/deep link รายละเอียดได้
แม้ detail route ไม่ได้ให้ read authority นั้น ปุ่ม issue/cancel ใน processor queue
ยังใช้ process/cancel decisions ที่เป็นอิสระตามเดิม

Cancel ยังคง resolve `stock.request.cancel` แยกจาก read/process ภายใน transaction:
OWN ตรวจ `requestedBy`, ALL เข้าถึงคำขอของผู้อื่นได้ และ workflow state ยังคงต้อง
เป็น pending ตาม invariant เดิม

### 6.2 Transaction and lifecycle closure

Request create, cancel, process/issue, category create/delete, item
create/update/soft-delete และ quantity adjustment ยังคง re-read และ lock active
User แล้ว resolve capability ผ่าน `resolveInTransaction()` ก่อน protected write
ภายใน transaction เดียวกัน Request creation และ USER/LIFF actors ยังต้องมี active
Employee; Dashboard ADMIN compatibility สำหรับ inventory/process/cancel ยังคง
employee-optional ตาม behavior ที่ freeze ไว้ ไม่มี route preflight ใดมาแทน
transaction-time authorization และ lifecycle revocation ยังคง fail closed เป็น 403

Image upload ไม่มี Prisma business transaction และยังคงใช้ authenticated
Dashboard identity ตามด้วย `stock.inventory.manage` preflight ก่อน filesystem write;
scope ของ upload ถูกจำกัดเป็น `item|variant` และไม่รับ client permission/role

Locks, serializable retry, pending claim, optimistic update, inventory validation,
idempotency, audit, outbox และ notification ordering ไม่เปลี่ยนใน Phase 6C

### 6.3 Presentation/channel closure

Dashboard menu/direct route, visible tabs, SWR query keys และ actionable controls
ใช้ projection เก้าค่าแบบ granular. Stale Dashboard tab ถูก normalize ไปยัง tab ที่
ใช้งานได้ และ stale dialogs/actions ถูกปิดหรือ guard เมื่อ capability ที่เกี่ยวข้อง
หายไป

LIFF โหลด canonical Stock projection จาก home ก่อน query และ normalize tab/deep
link ตาม read/process capability. Process-only actor ยังคงเห็น processor queue และ
ทำ process action ได้ แต่ไม่ถูกอนุมานว่าอ่าน request detail แบบ ALL ได้ Session
recovery ยังคง refresh projection/data และไม่ retry sensitive mutation อัตโนมัติ

Channel compatibility คงเดิม: LIFF USER ได้ catalog/read-own/create-own/cancel-own
จาก floor, LIFF ADMIN requester list ยังคง mine แต่ detail/cancel/process ใช้ ALL
ตาม Stock compatibility และ explicit USER process/ALL grant ใช้ใน LIFF ได้
`stock.inventory.manage` กับ `stock.report.export` ยังคง unsupported ใน
`LIFF_SELF_SERVICE`

### 6.4 Regression coverage

Focused tests ครอบคลุม authentication/403/not-found, explicit normal USER grants,
read/process/cancel independence, inventory/report independence, mine/all query
translation, query-level detail ownership, transaction lifecycle revalidation,
Dashboard route/menu/tab/query normalization, LIFF channel projection,
process-only detail denial และ session-recovery no-retry behavior

## 7. Intentionally retained compatibility bridge and remaining debt

สถานะ compatibility bridge: **INTENTIONALLY RETAINED — ไม่ใช่งาน Stock migration
ที่ยังเปิดอยู่**

Stock migration ปิดแล้วโดยยังคง localized compatibility floor ใน Stock adapter
เฉพาะ `NO_APPLICABLE_GRANT`. การลบ bridge ต้องรอ approved production Team /
TeamRole / membership / direct-grant mapping ที่ครอบคลุมผู้ใช้ Stock เดิมทั้งหมด
Unknown capability, unsupported channel, invalid authorization configuration และ
structural resolver error จะไม่เข้า bridge

หนี้ compatibility ที่เหลือมีเพียง:

- Stock role-to-scope floor และ Dashboard ADMIN employee-optional lifecycle
  exception ภายใน Stock adapter
- legacy LIFF aliases `canRequestStock` / `canProcessStockRequests` ใน
  cross-module response contract แม้ active Stock UI ใช้ `stockCapabilities`
  โดยตรง
- cancellation notification wording/classification ที่ต้องรักษา legacy ADMIN และ
  requester/processor semantics; ค่านี้ไม่ใช่ authorization source

Phase 6C ไม่สร้าง grant seed, Team policy, authorization administration UI,
Prisma migration, capability key, DENY/wildcard/ABAC หรือเปลี่ยน Routine/Leave
behavior

## 8. Verification record

Focused Stock projection, Dashboard, LIFF home, LIFF bootstrap/order,
capability/tab/action and recovery tests cover compatibility, explicit grants,
channel denial, batching, OWN/ALL separation and stale presentation state.
The repository-wide `npm run check` command is the final verification gate for
architecture, lint, typecheck and the full test suite.
