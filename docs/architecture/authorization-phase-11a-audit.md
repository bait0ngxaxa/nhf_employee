# NHF Employee Authorization Phase 11A — Repository-wide Authorization Surface Re-audit

สถานะ: **AUDIT COMPLETE / BEHAVIOR FREEZE**<br>
วันที่ตรวจ: 2026-09-15<br>
Repository: `bait0ngxaxa/nhf_employee`<br>
Audited source baseline: `94ffa0f1a0beb39aee27b764aa4afcd853546f52`<br>
Baseline subject: `feat(authorization): close Phase 10 administration audit`

เอกสารนี้เป็นผลการค้นหาและจำแนก authorization surface ของ Phase 11A เท่านั้น ไม่ใช่การเปิดใช้ policy ใหม่ และไม่ใช่ Phase 11B implementation plan ที่ลงมือแก้ production authorization แล้ว

## Executive result

- ไม่พบ `LEGACY_AUTHORIZATION_BYPASS` ที่ยืนยันได้จาก production call chain: **0 findings**
- ไม่พบการ seed Team, TeamRole, membership, capability grant หรือ direct User grant
- ไม่พบการ retire compatibility floor หรือการ activate Email Request / deferred Routine capability
- ไม่พบการอนุมานสิทธิ์จาก Department, manager, position, Employee hierarchy หรือ organizational field อื่น
- production authorization behavior ไม่ได้เปลี่ยน การเปลี่ยนแปลงของ Phase 11A มีเฉพาะเอกสาร current-state และเอกสาร audit นี้
- มี compatibility/lifecycle seams, deferred broad-query behavior และ stale documentation ที่ต้องแยกออกจาก bypass ให้ชัดเจน

จำนวนในเอกสารนี้นับเป็น **decision-family records**: หนึ่งรายการคือ policy decision ที่มี responsibility เดียวและอาจครอบคลุมหลาย route ไม่ใช่จำนวน raw grep hits หรือจำนวน endpoint ดังนั้นหนึ่ง operation อาจมีรายการ `CENTRAL_AUTHORIZATION` หนึ่งรายการและ `DOMAIN_RESOURCE_POLICY` ต่อเนื่องอีกหนึ่งรายการได้

| Category | จำนวน decision-family records | สรุป |
|---|---:|---|
| `CENTRAL_AUTHORIZATION` | 12 | capability resolver/evaluator และ migrated server paths |
| `AUTHENTICATION_OR_ACCOUNT_LIFECYCLE` | 8 | identity, session, workforce, channel และ trusted system boundaries |
| `DOMAIN_RESOURCE_POLICY` | 9 | ownership, assignment, participant, workflow, state, concurrency และ query policy |
| `COMPATIBILITY_POLICY` | 6 | documented `NO_APPLICABLE_GRANT` floors และ channel/lifecycle bridges |
| `AUTHORIZATION_ADMINISTRATION_BOOTSTRAP` | 2 | ADMIN-only Administration page/API boundary |
| `DEFERRED_AUTHORIZATION_SURFACE` | 7 | Email, Routine deferred capabilities และ Leave deferred policy surfaces |
| `PRESENTATION_ONLY` | 5 | server projections, menu/page visibility และ client action hints |
| `LEGACY_AUTHORIZATION_BYPASS` | 0 | ไม่พบ decision ที่ข้าม central contract โดยไม่มีข้อยกเว้นที่บันทึกไว้ |
| **รวม** | **49** | นับตามวิธีข้างต้น |

## Audit methodology

ตรวจจาก baseline commit ที่ระบุข้างต้นและ trace จาก entry point ไปยัง decision point จริงตามลำดับต่อไปนี้:

1. อ่าน `AGENTS.md`, module-boundary/dependency rules, authorization current state/contract/resolver/persistence และ Phase 10A–10D closure records
2. ตรวจ `git status`, `git rev-parse HEAD`, commit history และ source tree เพื่อยืนยัน baseline และหลีกเลี่ยงการตีความจากชื่อไฟล์อย่างเดียว
3. ค้น production source สำหรับ `isAdminRole`, `USER_ROLES.ADMIN`, literal `ADMIN`/`role` comparisons, `requireAdminSession`, `requireApiSession`, workforce/LIFF guards, `isAdmin` props และ capability adapters
4. Trace route หรือ page → trusted session → actor builder → module adapter → centralized resolver → query/resource scope → domain/workflow invariants → transaction/persistence
5. ตรวจ direct Prisma/query call, list/export path, request/client inputs, Team/TeamRole origin, actor identity และการตรวจซ้ำใน transaction
6. ตรวจ architecture checker (`scripts/check-architecture.mjs`) และ architecture tests เพื่อหา client-graph และ module-boundary enforcement ที่มีจริง
7. ใช้ tests และ source comments เป็นหลักฐานประกอบ แต่ไม่จัดประเภทจาก test mock หรือ identifier เพียงอย่างเดียว

เกณฑ์การตัดสิน `LEGACY_AUTHORIZATION_BYPASS` คือ ต้องพบ decision ฝั่ง server ที่ควรใช้ capability contract แต่ derive authority เองจาก role, UI, client/request state หรือ actor data ที่ไม่น่าเชื่อถือ และทำให้ central capability/scope หรือ trusted actor chain ถูกข้ามจริง หากมี role check แต่เป็น authentication/bootstrap, lifecycle, domain policy, compatibility, deferred หรือ presentation จะไม่ถูกนับเป็น bypass

## Frozen authorization chain and invariants

เส้นทางที่ต้องคงไว้สำหรับ migrated production paths คือ:

```text
authenticated trusted actor
  → centralized capability resolution
  → capability + scope
  → domain-owned resource/query policy
  → business/workflow invariants
  → persistence
```

หลักฐานจาก `modules/authorization/application/resolver.ts` และ `evaluator.ts` แสดงว่า:

- `ADMIN` ถูก resolve จาก registry และ channel constraint ใน central evaluator ไม่ใช่สิทธิ์ที่มาจาก client
- USER grants รวม direct User grants, active Team membership grants และ active TeamRole grants โดยคง `source.teamId`/`constraint.teamId` ไว้
- direct User `TEAM` scope ไม่ถูกยอมรับเป็น Team-origin grant; TeamRole ต้องเป็นของ Team เดียวกับ membership
- unknown capability, unsupported scope, invalid origin และ ownership mismatch ของ persisted authorization configuration ทำให้ resolver/configuration path fail closed และยัง inspectable; ไม่ถูกตีความเป็น ALLOW แบบเงียบ ๆ
- `resolveMany()` และ transaction resolver ใช้ persistence ที่ bounded ตาม actor และ active memberships/roles ไม่โหลด authorization graph แบบกว้างโดยไม่จำเป็น
- ADMIN ไม่ bypass authentication, workforce/account lifecycle, input validation, resource/business invariants, workflow state, transaction หรือ concurrency guarantees
- UI visibility, `isAdmin` prop และ capability projection ไม่ใช่ server security boundary
- คำว่า `DENY` ที่แสดงใน Authorization Administration UI เป็น label ของผล `allowed = false`; ไม่ใช่ persisted explicit-deny grant หรือ policy feature

จุดที่ต้องอ่านร่วมกันคือ `resolveAuthenticatedAccount()` เป็น generic account identity layer ซึ่งตั้งใจรองรับ valid active User ที่ยังไม่มี Employee. จากนั้น `getApiAuthSession()` เป็น legacy API-session compatibility adapter ที่เรียก `hasEligibleCurrentEmployeeForUser()` เพิ่ม และ `requireApiSession()`/`requireAdminSession()` จึงคง legacy eligible-current-Employee contract ไว้. ดังนั้น:

```text
generic account identity
!=
legacy API-session workforce eligibility
```

ส่วน `requireActiveWorkforceOrAdminSession()` และ lower application adapters ยังมี compatibility branch บาง operation ที่รองรับ `employeeId = null` สำหรับ Dashboard ADMIN. ความแตกต่างนี้ถูกจำแนกเป็น `COMPATIBILITY_POLICY`/`AUTHENTICATION_OR_ACCOUNT_LIFECYCLE` seam ไม่ใช่หลักฐานว่า ADMIN มี authority ใหม่ และถูกบันทึกเป็นความเสี่ยงสำหรับ Phase 11B

## Complete categorized surface inventory

### 1. `CENTRAL_AUTHORIZATION` — 12 records

| ID | Surface และ entry points | Central decision / evidence | Remaining domain or compatibility boundary |
|---|---|---|---|
| C-01 | Resolver/evaluator/persistence ทุก caller | `modules/authorization/application/resolver.ts`, `evaluator.ts`, `infrastructure/persistence/authorization-resolution-repository.ts` เป็น authoritative capability path | Registry เป็น code source; persisted invalid rows fail closed/inspectable |
| C-02 | Employee API: list, stats, create, update, delete, import, export | `employee.read`, `employee.stats.read`, `employee.create`, `employee.update`, `employee.delete`, `employee.import`, `employee.export` ผ่าน `modules/employee/application/authorization.ts` | broad Employee query และ create/import transaction boundary อยู่ใน compatibility/domain records ด้านล่าง |
| C-03 | `GET /api/departments` และ Dashboard Department reference | `department.read` ผ่าน Department adapter และ central resolver | legacy effective-user floor คง `ALL`; Department เป็น resource data ไม่ใช่สิทธิ์จาก org hierarchy |
| C-04 | `GET /api/audit-logs`, Dashboard Audit | `audit.read` ผ่าน Audit adapter; ADMIN และ explicit USER/Team/TeamRole grant ถูก resolve กลาง | audit query เป็น ALL หลัง capability; export-event เป็น instrumentation boundary |
| C-05 | Notification latest/history และ mark-read/read-all | `notification.inbox.read` และ `notification.inbox.update` ผ่าน Notification adapter | query/update บังคับ actor-derived `userId` เป็น OWN |
| C-06 | Dashboard Stock catalog, inventory, requests, processing, report, image upload | ทั้ง 7 Stock capabilities ผ่าน `modules/stock/application/authorization.ts`; DB mutation paths resolve ซ้ำใน transaction, ส่วน image upload ทำ central preflight ก่อน validation/file-system write | Stock-owned request/item/state/stock invariants และ frozen fallback แยกเป็น D/P; file write เป็น non-transactional side effect |
| C-07 | LIFF Stock catalog, availability, own requests, cancel, processing/issue | LIFF actor channel ถูกส่งเข้า Stock adapter; read/create/cancel/process แยก capability ไม่ใช้ read ALL เป็น process/cancel | `requireLiffStockProcessorSession()` และ requester-owned query scope เป็น channel/domain boundary |
| C-08 | Dashboard Leave read/create/cancel/approve/cancellation/not-taken/approver operations | 8 registered Leave capabilities ผ่าน Leave adapter; create/decision/not-taken/assignment mutation resolve ใน transaction | effective approver, owner, state, quota, overlap, unavailable-approver และ assignment rules เป็น domain policy |
| C-09 | LIFF Leave self-service reads, request, cancel, approval/decision, not-taken | registered Leave capabilities resolve ด้วย trusted LIFF actor; `OWN`/assigned relationship ถูกแยกจาก capability | participant detail/attachment และ LIFF cancellation decision ยังเป็น deferred/domain boundary |
| C-10 | Dashboard Routine tasks/occurrences and occurrence mutations | migrated task/occurrence capabilities ผ่าน Routine adapter; normal query resolve ก่อน scope query และ mutations resolve ซ้ำใน transaction | creator/current-assignee/occurrence-assignee, state, target Employee, row/version/reminder locks เป็น domain policy |
| C-11 | LIFF Routine task list/create/detail/update/delete | trusted `LIFF_SELF_SERVICE` actor ใช้ central task capabilities; create normalizes owner/assignee จาก session | creator/assignee relationship และ LIFF channel restriction คงอยู่ |
| C-12 | Routine import preview/reference/batch/rows/apply/cancel | `routine.import.manage` resolve ที่ route/application และ transaction staging/apply | batch/row ownership, active references, state/idempotency และ transaction invariants เป็น domain policy |

Capability registry baseline มี 40 registered capabilities; migrated production set ที่มี central adapters คือ 35 รายการ (Employee 7, Department 1, Routine 9, Stock 7, Leave 8, Audit 1, Notification 2). ตัวเลขนี้ไม่รวม capability surface ที่ contract ตั้งใจ deferred และไม่แปลว่า capability ที่ registered แล้วต้องถูก grant หรือ seed ใน Phase 11A

### 2. `AUTHENTICATION_OR_ACCOUNT_LIFECYCLE` — 8 records

| ID | Surface และ evidence | Decision ที่ทำจริง | Classification boundary |
|---|---|---|---|
| A-01 | Access token/cookie/generic account identity: `modules/auth/application/sessions.ts`, `lib/auth/server.ts` | `resolveAuthenticatedAccount()` ตรวจ token/account active/deleted และตั้งใจสร้าง generic account identity ได้แม้ User ยังไม่มี Employee | `getApiAuthSession()` เติม `hasEligibleCurrentEmployeeForUser()` เป็น legacy API-session workforce gate; ไม่ใช่ capability decision |
| A-02 | `requireApiSession()` และ `requireAdminSession()` ใน `lib/auth/api.ts` | API session ต้องผ่าน account/eligible workforce; Admin session ตรวจ trusted system role เป็น structural gate | `requireAdminSession` เป็น bootstrap/deferred boundary ไม่ใช่ generic authorization contract สำหรับ migrated capability |
| A-03 | `requireActiveWorkforceSession()` และ `requireActiveWorkforceOrAdminSession()` ใน `lib/auth/workforce.ts` | re-read User/Employee, ตรวจ active/deleted state และ map 401/403/404 | lower Admin-optional branch เป็น documented compatibility/lifecycle seam; upstream API session ปกติยังต้องมี eligible Employee |
| A-04 | Dashboard layout/page access และ `app/_lib/auth/current-user.ts` | server session/projection ต้องเป็น trusted current account/Employee ก่อน page หรือ client projection | capability page guards จัดอยู่ใน C/V; menu หรือ hidden UI ไม่ใช่ enforcement |
| A-05 | LIFF session, LINE identity verification, account link และ webhook authentication | `requireLiffWorkforceSession()` ใช้ linked LINE session กับ active workforce; account-link ตรวจ LINE token; webhook ใช้ signature/HMAC | channel identity/account-link ไม่ใช่ Team/domain authorization |
| A-06 | Login/signup/refresh/logout/password reset/session revoke, Dashboard `/dashboard/sessions` และ employee-account lifecycle | public auth operations, token lifecycle, last-admin protection และ account/workforce lifecycle ถูกบังคับใน auth boundary | ไม่ควรแทนที่ด้วย ordinary capability grant |
| A-07 | Cron/cleanup/outbox/scheduler และ trusted system routes | secret/internal principal หรือ webhook proof เป็น system authentication; cleanup/scheduler ไม่รับ actor authority จาก request body | job recipient selection เป็น domain/platform policy ไม่ใช่ end-user authorization |
| A-08 | Upload/private path/channel boundary | private upload mutation ต้องผ่าน workforce/auth และ Stock capability; public upload GET ใช้ path/storage safety; Leave private attachment ใช้ separate participant policy | namespace/channel distinction ต้องคงไว้; public path ไม่ใช่ ordinary read grant |

### 3. `DOMAIN_RESOURCE_POLICY` — 9 records

| ID | Resource/domain decision | Evidence and actual behavior |
|---|---|---|
| D-01 | Employee lifecycle and target policy | Employee create/update/delete/import preserve last-admin, self-offboarding, active target, account sync, subordinate/Leave dependency and serializable transaction rules. Employee hierarchy is a business dependency, not an authorization source |
| D-02 | Routine creator/assignee/occurrence/state policy | Normal task query maps central scopes through creator/current-assignee predicates; occurrence query uses occurrence assignee. Creator vs assignee edit/delete, active referenced Employees, feature/state, idempotency and row/version/reminder locks remain domain-owned |
| D-03 | Stock request/item/inventory policy | Requester ownership, pending/state transitions, active item/variant, available stock, atomic claim, idempotency and serializable locks are checked after central capability. Notification mode is derived from loaded request and resolved scopes, not chosen by client |
| D-04 | Leave owner/approver/workflow policy | Effective exception approver precedes original approver; owner/assigned approver/action state, approval/cancellation/not-taken, quota, overlap, dates, assignment and concurrency are checked after capability resolution |
| D-05 | Leave participant and attachment policy | Dashboard attachment Admin relationship bypass is implemented after trusted auth; USER must be owner/original/effective approver. LIFF detail/attachment uses owner/effective approver participant predicate and not-found privacy boundary |
| D-06 | Leave report and Admin recovery scope | Report current-team uses current manager relation and approver-history uses original approver relation. Recovery only selects unavailable effective approver candidates and excludes current Admin workload; neither is a generic Team/Department inference |
| D-07 | Notification ownership | Notification repository predicates use server-derived authenticated user ID for reads and mutations; request does not choose another user. “all” is a history pagination mode, not cross-user scope |
| D-08 | Audit history and export-event instrumentation | Audit read is C-04. `POST /api/audit-logs/export` records an authenticated actor's event after a separate data export; `entityType`, `recordCount`, and `filters` are metadata, not data-read authority. Its input-integrity issue remains an explicit risk |
| D-09 | Authorization Administration resource/transaction invariants | Team/Role/membership/grant target ownership, active state, TeamRole-to-Team consistency, catalog readiness, invalid configuration, no direct User TEAM, serializable mutation and same-transaction audit are enforced after bootstrap |

### 4. `COMPATIBILITY_POLICY` — 6 records

| ID | Frozen policy | Why it is not a bypass |
|---|---|---|
| P-01 | Employee `read/stats/export` retain broad legacy behavior; create/update/delete/import retain Admin-only floor when resolver returns exact `NO_APPLICABLE_GRANT` | The adapter calls central resolver first and only bridges the documented no-grant result; explicit ALLOW/DENY outcome is not promoted by role. Update/delete re-resolve in transaction |
| P-02 | Department `department.read / ALL` remains the effective-user compatibility floor | API session already applies legacy eligibility; central decision is still evaluated and no Department/manager hierarchy is inferred |
| P-03 | Notification read/update retain `OWN` compatibility floor | adapter resolves exact capability first; repository ownership is actor-derived and cannot be selected by client |
| P-04 | Stock no-grant legacy scopes and Dashboard Admin compatibility remain: catalog/read/create/request flows preserve existing floors; lower transaction adapter has an exact Admin employee-optional branch for inventory/process/cancel | This is a documented Stock migration bridge. Stable HTTP `requireApiSession()` normally requires eligible Employee, but direct lower application/test seam or lifecycle race can expose the branch; it is a risk to decide, not a new authority |
| P-05 | Routine no-grant task/occurrence floors and LIFF channel-specific Admin self-service behavior remain | Normal migrated capabilities still resolve centrally; Dashboard Admin semantics, LIFF MINE normalization and fallback are compatibility/channel rules. Summary/reference/export are not hidden in this row; they are E-02–E-04 deferred |
| P-06 | Leave no-grant floors, Dashboard recovery compatibility and lower account-only `leave.approver.manage` branch remain | Explicit USER grants still require active workforce and Leave invariants; Admin recovery/approver behavior is domain-specific. The lower optional Employee branch does not override the upstream API session contract |

No compatibility bridge trims an explicit unsupported/invalid grant into an ALLOW. `NO_APPLICABLE_GRANT` is the only bridge result used by the migrated adapters, as required by the closure records

### 5. `AUTHORIZATION_ADMINISTRATION_BOOTSTRAP` — 2 records

| ID | Surface | Actual boundary |
|---|---|---|
| B-01 | Dashboard `/dashboard/authorization` | Server page calls `requireDashboardAuthorizationAdministration()` and `assertAuthorizationAdministrationAccess()` using trusted server `user.id` and role. The client receives safe read models only |
| B-02 | `/api/authorization/administration/**` read and mutation routes | Shared route auth calls trusted API session plus explicit Admin assertion; validated commands use readiness/ownership checks, serializable transaction and same-transaction audit. Team IDs, role IDs, grant data and actor identity are never accepted as authority from browser state |

ADMIN is the highest system authority inside this bootstrap surface, but it does not bypass account/workforce authentication, validation, target ownership, invalid-config handling, workflow/business invariants, transaction/concurrency or audit integrity. Phase 10 seed configuration remains empty in `modules/authorization/application/seed.ts`

### 6. `DEFERRED_AUTHORIZATION_SURFACE` — 7 records

| ID | Deferred surface | Current evidence and frozen behavior |
|---|---|---|
| E-01 | Email Request API/dashboard | `POST /api/email-request` and Dashboard page use explicit Admin-only role/bootstrap boundary; GET uses authenticated requester-vs-Admin query behavior in `lib/services/email-request/queries.ts`. It is not migrated to capability resolver |
| E-02 | Routine summary | `routine.summary.read` remains registered but deferred. `getRoutineSummary` retains legacy `scope=all` behavior, including USER path; direct `isRoutineAdminActor` is not presented as migrated capability authority |
| E-03 | Routine reference | `routine.reference.read` remains deferred. Dashboard query may list active Employees for legacy Admin and self Employee for USER; LIFF serialization omits employee list and uses linked workforce |
| E-04 | Routine task export | `routine.task.export` remains deferred. Export path deliberately uses `DEFERRED_EXPORT` and broad all-scope work-item query; export button/projection is not security enforcement |
| E-05 | Leave report/export | No generic `leave.report.export` capability is in the contract. `/api/leave/export` uses active workforce plus current-team/original-approver relationship scope; `canViewLeaveReports` is presentation only |
| E-06 | Leave participant/detail/attachment | Generic participant/detail/attachment capabilities are excluded. Dashboard Admin attachment relationship bypass and LIFF owner/effective-approver participant policy remain Leave-owned, not silently mapped to generic `ALL` |
| E-07 | Leave recovery and LIFF cancellation-decision boundary | Admin recovery is a Leave-specific unavailable-approver path; LIFF cancellation decision remains domain-authorized while Dashboard-only `leave.cancellation.decide` is not activated for LIFF. Future IT/Email capability migration is also deferred |

Deferred does not mean unauthenticated: all routes still retain their applicable account, workforce, channel, resource and domain checks. It means no new generic capability policy is activated in Phase 11A

### 7. `PRESENTATION_ONLY` — 5 records

| ID | Presentation surface | Why it is presentation-only |
|---|---|---|
| V-01 | `app/_lib/auth/current-user.ts` and module `get*PresentationCapabilities()` | Server-side batched projections are safe UX/page inputs derived from resolver/domain data; API/application paths still enforce independently |
| V-02 | Dashboard layout, `DashboardProvider`, Sidebar/Navbar, menu `requiredRole`, page visibility | `isAdmin` and role props hide/show links or label role; direct URL and API do not trust them. Dashboard page guards are separate server checks |
| V-03 | Employee/Department/Audit/Notification/Stock/Routine/Leave Dashboard projections and Routine settings tab | `canRead`, tab access, `canCreate`, `canApprove`, `canExport`, `canManage` and aliases guide UI; the Routine `settings` tab is role visibility and its task operations still use C-10 APIs; route capability checks and domain rules remain authoritative |
| V-04 | LIFF home contract and browser module clients | `getLiffCapabilities`, module list and client gates reduce accidental navigation; LIFF API/session/central/domain checks remain required |
| V-05 | Routine per-resource action flags and Authorization Administration inspector/UI | `canEdit/canDelete`, `isAdmin`, source labels, compatibility warnings and INVALID_CONFIGURATION display are not permission grants. The Administration inspector shows resolver output/readiness; it does not activate policy |

### 8. `LEGACY_AUTHORIZATION_BYPASS` — 0 records

No production decision met the bypass definition. The apparent candidates were traced as follows:

| Candidate | Actual classification | Evidence-based conclusion |
|---|---|---|
| Routine `isAdminRole`/`isRoutineAdminActor` in summary/reference/export | E-02–E-04 deferred | The direct role predicate is in a deliberately deferred path; it is a known policy gap/risk, not a hidden central-capability path claimed as migrated |
| Email role query and Admin POST | E-01 | Explicit deferred boundary; role is the documented policy, not an accidental replacement for an activated capability |
| Leave attachment Admin flag and recovery Admin check | D-05/D-06/E-07 | Trusted server account plus Leave resource/recovery policy; not a generic migrated capability decision |
| Stock/Routine/Leave lower account-only Admin branches | P-04/P-05/P-06 and A-03 | Lower lifecycle compatibility seams; normal API session upstream requires eligible Employee. No client role or Team data creates authority |
| Audit export event accepts caller metadata | D-08 | It records an event and does not authorize a data export. Input integrity remains a risk, not evidence of data access bypass |
| Stock image upload writes to local storage after central preflight without a DB transaction-time re-resolution | C-06/A-08 | The capability gate is still central and no independent role bypass was found; the preflight-to-file-write race/cleanup semantics are a side-effect risk for Phase 11B |
| Employee create/import lack the same transaction-time re-resolution as update/delete | C-02/D-01 and implementation risk | Route preflight uses Employee central adapter; the known direct-persistence/row-by-row boundary is not an independent role bypass, but it should be revisited before policy narrowing |
| Client `isAdmin`, role props, menu checks and capability aliases | V-02–V-05 | Presentation only; direct API/page server checks remain in the call chain |

## Intentional role, bootstrap and lifecycle usages that must remain

The following role-derived usages were found and are intentional under the current contract; they must not be mechanically replaced:

- `lib/ssot/permissions.ts:8-13`: canonical `isAdminRole()` and display label helper
- `lib/auth/api.ts:59-70`: structural `requireAdminSession()` boundary for explicit Admin-only surfaces
- `modules/authorization/application/evaluator.ts:60,93-111` and `resolver.ts:99,142`: central ADMIN evaluation from trusted actor role, registry and channel
- `modules/authorization/application/administration.ts:75-95`: Administration bootstrap assertion; a caller cannot turn a narrower asserted type into an ADMIN principal
- `lib/auth/workforce.ts:140`: workforce helper’s Admin compatibility/lifecycle branch; it is not a general capability substitute
- `modules/auth/application/employee-account-lifecycle.ts:42-45`, `modules/auth/application/signup.ts:65` and `app/api/auth/signup/route.ts:85`: last-active-Admin protection and server-derived bootstrap role assignment during account/workforce lifecycle
- `modules/employee/application/authorization.ts:132`, Department/Audit/Notification/Stock/Routine/Leave role parsers and documented legacy translation: compatibility/input normalization, with central resolution first
- `modules/leave/application/authorization.ts:311-319,344-400`, `participant-access.ts`, `not-taken.ts` and `cancellation/cancellation.ts`: Leave-specific recovery, participant and workflow policy
- `lib/services/email-request/queries.ts:32-33` and Dashboard Email route/page: deferred Email policy
- `modules/routine/application/queries.ts:1120-1125`, routine presentation/query capability fallback and `isRoutineAdminActor()`: deferred Routine or UI behavior only
- `modules/stock/application/requests/request-mutations.ts:547-550`: Admin/USER affects notification wording/mode after resource load; it does not authorize the mutation
- `modules/routine/application/recipients.ts`, `scheduler.ts`, `reminders.ts`, Stock notification infrastructure: selecting Admin recipients/labels for notifications is recipient/domain behavior, not actor authority
- Dashboard/LIFF `isAdmin` props and `USER_ROLES.ADMIN` menu comparison: presentation-only visibility/labeling

### Direct role/`isAdmin` occurrence register

รายการนี้เป็น register ของ direct production role checks ที่ audit พบ; source ที่เป็นเพียง import, type, label หรือ prop flow ถูกระบุไว้เพื่อไม่ให้สับสนกับ independent authority:

| Source location | Construct | Classification |
|---|---|---|
| `lib/ssot/permissions.ts:8-13` | canonical `isAdminRole()` และ role label | A/V primitive |
| `lib/auth/api.ts:59-70` | `requireAdminSession()` | A-02 / B bootstrap/deferred boundary |
| `app/api/authorization/administration/_lib/route-auth.ts:30-37` | shared `requireAdminSession()` call before Administration application assertion | B-02 bootstrap |
| `app/api/email-request/route.ts:19-25` | `requireAdminSession()` call for Email Request POST | E-01 deferred Email boundary |
| `lib/auth/workforce.ts:140` | Admin branch ของ workforce helper | A-03 / P lifecycle compatibility |
| `app/dashboard/_lib/route-access.ts:18-29` | Dashboard Admin page guard | B-01 / E-01 Email surface |
| `app/dashboard/leave/page.tsx:17,37-45` | `isAdminRole(user.role)` feeds `leaveAvailability`, access redirect และ default-tab selection | V-02/V-03 `PRESENTATION_ONLY`; Leave APIs enforce independently |
| `modules/authorization/application/evaluator.ts:60,93-111` | ADMIN system-role evaluation | C-01 central resolver |
| `modules/authorization/application/resolver.ts:99,142` | trusted `context.isAdmin` branches while resolving central capability decisions | C-01 central resolver |
| `modules/authorization/application/administration.ts:67,87-95` | trusted Admin assertion and role parser | B-01/B-02 bootstrap |
| `modules/auth/application/employee-account-lifecycle.ts:42-45` | last-active-Admin lifecycle invariant | A-06 |
| `modules/auth/application/signup.ts:64-71` | server-derived bootstrap `Role.ADMIN`/`Role.USER` assignment inside signup transaction | A-06 authentication/account lifecycle |
| `modules/employee/application/authorization.ts:78,132` | actor parser and exact legacy Admin mutation floor | C-02 / P-01 |
| `modules/department/application/authorization.ts:61` | trusted actor parser | C-03 / P-02 |
| `modules/audit/application/authorization.ts:61` | trusted actor parser | C-04 |
| `modules/notification/application/authorization.ts:62` | trusted actor parser | C-05 / P-03 |
| `modules/stock/application/authorization.ts:83,125,164,408-409` | parser, legacy scopes, channel/lifecycle branch | C-06/C-07 / P-04 |
| `modules/routine/application/authorization.ts:84,113-117,131,170,199,410` | parser, deferred predicate, compatibility and transaction lifecycle | C-10/C-11 / P-05 / E-02–E-04 |
| `modules/leave/application/authorization.ts:78,128,319,344,360,400` | parser, compatibility, recovery and transaction lifecycle | C-08/C-09 / P-06 / D-04/E-07 |
| `lib/services/email-request/queries.ts:32-33` | Admin-all vs requester-owned Email query | E-01 |
| `app/api/leave/attachments/[attachmentId]/route.ts:63` | Admin relationship flag passed to attachment policy | D-05/E-06 |
| `app/api/leave/admin/recovery/route.ts:25` | explicit Admin recovery guard | D-06/E-07 |
| `modules/leave/application/approvals/exception-approver.ts:62,79` and `not-taken.ts:267,296,302-307` | Leave workflow/recovery state | D-04/D-06/E-07 |
| `modules/leave/application/cancellation/cancellation.ts:399,593` | decision actor label and Admin override state | D-04/E-07 |
| `modules/stock/application/requests/request-mutations.ts:550` | notification mode after request load | D-03 |
| `modules/routine/application/queries.ts:489,1120-1125,1437` | per-resource flags and deferred summary/reference query | V-05 / E-02/E-03 |
| `modules/routine/domain/capabilities.ts:30-62` | optional legacy `actor.isAdmin` fallback when central edit/delete scopes are absent | V-05 `PRESENTATION_ONLY`; serialized action flags only, not mutation authority |
| `modules/leave/application/queries/participant-access.ts:116,142` | server-derived `viewer.isAdmin` relationship bypass for Dashboard attachment access | D-05/E-06 `DOMAIN_RESOURCE_POLICY`; non-Admin participant predicate remains enforced |
| `modules/routine/application/recipients.ts:122`, `modules/routine/application/scheduler.ts:269`, `modules/routine/application/reminders.ts:461-475`, `modules/stock/infrastructure/notifications/notifications.ts:92-104,332-345` | `Role.ADMIN` recipient selection and stale notification-delivery guard | `DOMAIN_RESOURCE_POLICY` notification recipient/lifecycle behavior, not caller authority |
| `components/dashboard/context/dashboard/DashboardProvider.tsx:46,147`, `modules/stock/presentation/dashboard/context/StockProvider.tsx:68`, `modules/routine/presentation/dashboard/RoutineSection.tsx:487`, `modules/leave/presentation/dashboard/LeaveManagementSection.tsx:30` | Dashboard role/isAdmin props and menu/page visibility | V-02/V-03 |
| `modules/authorization/presentation/dashboard/components/UserAccessPanel.tsx:176,185` | Admin status display | V-05 |

`modules/authorization/application/administration.ts:291,314,329,340` ใช้คำว่า `role` กับ persisted TeamRole/role mismatch ใน read model ไม่ใช่ system-role authority. `modules/routine/application/recipients.ts`, `scheduler.ts`, `reminders.ts` และ notification infrastructure ใช้ `ADMIN` เพื่อเลือกผู้รับ/ข้อความ ไม่ใช่เพื่อตัดสินสิทธิ์ของ caller. `modules/employee/application/constants.ts` และ Employee query/formatter บางจุดใช้ `ADMIN` เป็นรหัส/ชื่อ Department ซึ่งไม่ใช่ `User.role`

Role parsing that accepts only `ADMIN | USER` is an invariant on trusted actor construction. It is not equivalent to trusting a `role` field from request body or browser state. No production route was found to build an authorization actor from client-supplied role, user ID, employee ID, capability, Team ID or TeamRole name

## Query-scope findings

The audit separated capability scope from resource/query scope. A central `ALL` decision does not remove domain predicates that still apply, and a UI `scope=all` request is not authority by itself.

| Surface | Query behavior found | Classification / risk |
|---|---|---|
| Employee list/stats/export | Organization-wide counts/list/export, with bootstrap-admin/deleted filtering where implemented | C-02 + P-01. Broad visibility is frozen policy; PII/HR narrowing is a post-11B policy decision |
| Department reference | Organization-wide active department reference after `department.read / ALL` | C-03 + P-02. No Department-derived authorization |
| Audit logs | Broad filtered/paginated audit query after central `audit.read / ALL`; request `userId` is a filter only and does not replace the actor | C-04 + D-08. Export event is separate instrumentation |
| Notifications | All/history pagination still predicates by server actor `userId`; read-state updates use same ownership | C-05 + D-07. No cross-user query found |
| Stock catalog/report | Organization-wide catalog/report after capability; filter/max-row schemas and export bounds apply | C-06/C-07 + D-03. Stock capability is not replaced by query filter |
| Stock requests | `scope=all` only becomes broad query when resolved scopes contain `ALL`; otherwise `requestedBy = auth.user.id`; LIFF lists force `mine` | C-06/C-07 + D-03. Client cannot promote OWN to ALL |
| Routine normal task/occurrence | `buildRoutineTaskScope`/occurrence scope translates `ALL`, `CREATED`, `ASSIGNED`; normal routes resolve central capability before query | C-10/C-11 + D-02. Creator/assignee distinction remains after capability |
| Routine work-item view (migrated) | `GET /api/routines/occurrences?view=tasks` resolves `routine.task.read` centrally, then the frozen USER `scope=all` compatibility can produce a broad active-task query | C-10/P-05 + D-02. High-risk query-scope behavior, but not a deferred or bypassed capability decision |
| Routine summary/export | Summary has no migrated generic capability; export deliberately uses deferred mode and broad active-task query | E-02/E-04. High-risk frozen behavior; policy decision required before narrowing or activation |
| Routine reference | Dashboard legacy Admin may see active Employee references; USER sees linked active Employee; LIFF serializer removes employees | E-03 + D-02. Do not infer authorization from Department/manager |
| Leave approvals and details | Approval list predicates effective approver; detail/attachments predicate owner/original/effective approver; unrelated callers get relationship/not-found boundary | C-08/C-09 + D-04/D-05 |
| Leave report | `current-team` uses current manager relation; `approver-history` uses original approver relation; exception approver is not silently substituted | E-05 + D-06. Relationship semantics are unresolved policy, not a bypass |
| Leave recovery | Query is limited to unavailable effective approver candidates and excludes current Admin workload | E-07 + D-06. Narrower than Admin-all |
| Authorization Administration | User search requires nonempty bounded query and takes at most 25 safe identity rows; configuration lists preserve inactive/invalid rows and Team origins | B-01/B-02 + D-09 |

Raw application query helpers that do not themselves call the resolver were also checked. Current production callers route through the corresponding adapter/guard before querying; this is an architectural seam to protect with tests, not evidence of a currently reachable bypass. The deferred Routine and instrumentation paths are explicitly listed above rather than counted as migrated central paths

### Authorization ordering evidence

- Migrated Employee/Department/Audit/Notification/Stock/Leave/Routine list/detail routes perform session checks and central capability resolution before their Prisma read. Query-string/body size, rate and schema parsing may occur earlier, but those steps do not read or write protected data
- Stock, Routine and Leave critical mutations re-read the trusted User/Employee and resolve the capability inside the transaction before resource/business persistence. Employee update/delete do the same; Employee create/import retain the documented preflight/direct-persistence and row-by-row partial-success boundary
- Stock image upload performs the central inventory capability preflight before the filesystem write, but has no database transaction-time re-resolution because the side effect is a file write; this is recorded as a Phase 11B risk, not silently changed
- Authorization Administration authenticates/bootstrap-checks before bounded configuration reads; mutations validate input/readiness/ownership before serializable write and same-transaction audit
- Deferred Routine summary/reference/export paths still authenticate the workforce actor before querying but intentionally do not invoke a newly activated generic capability. Audit export-event similarly authenticates before recording metadata
- Internal raw readers such as Stock query helpers and `getAuditEntityHistory()` do not claim to be authorization boundaries. Their current production callers were traced; adding a new caller requires an explicit authorization boundary and regression test

## Direct API, Dashboard and LIFF findings

| Channel | Audited route groups | Result |
|---|---|---|
| Dashboard/API — Employee, Department, Audit, Notification | `/api/employees/**`, `/api/departments`, `/api/audit-logs`, `/api/notifications/**` | Trusted API session; central capability adapters where registered; actor-derived query scope. Audit cleanup and export-event remain separate system/instrumentation boundaries |
| Dashboard/API — Stock | `/api/stock/**`, `/api/uploads/image` | Workforce/auth boundary, central Stock capability, transaction re-resolution for mutations, Stock request/item/resource invariants |
| Dashboard/API — Leave | `/api/leave/me`, `request`, `cancel`, `decision`, `approvals`, `not-taken`, `approvers` | Active workforce, central registered capabilities, effective approver/owner/workflow/transaction policy |
| Dashboard/API — Leave deferred/domain | `/api/leave/export`, `/api/leave/attachments/[attachmentId]`, `/api/leave/admin/recovery` | Active workforce plus report/participant/recovery domain policies; no silent generic capability activation |
| Dashboard/API — Routine migrated | `/api/routines/tasks/**`, `/api/routines/occurrences/**`, `/api/routines/imports/**` | Active session, central migrated capability, scope/domain policy, mutation transaction re-check |
| Dashboard/API — Routine deferred | `/api/routines/summary`, `/api/routines/reference`, `/api/routines/export` | Explicit deferred legacy/domain paths; direct role use is classified E/V, not claimed as central migration |
| Dashboard/API — Email/Admin | `/api/email-request`, `/api/authorization/administration/**` | Email is deferred Admin/requester policy; Administration is explicit Admin bootstrap plus validated server mutations |
| LIFF — identity/home | `/api/line/liff/session`, `/api/line/account-link`, `/api/line/home`, `/api/line/webhook` | LINE/session/token/HMAC boundaries; home is projection only; no client capability response is trusted as authority |
| LIFF — Leave | `/api/line/leave/**` | Trusted LIFF workforce, central registered operations, participant/effective-approver domain checks; deferred cancellation-decision distinction preserved |
| LIFF — Stock | `/api/line/stock/**` | Trusted LIFF workforce, central catalog/request/process/cancel checks, requester/processor scope split |
| LIFF — Routine | `/api/line/routine/tasks/**`, summary, reference | Task CRUD central; summary/reference deferred with forced linked-workforce scope and no employee list serialization |
| Public/private storage | `/api/uploads/[...path]`, private Leave attachment routes | Public path allows only safe public segments; private attachment access stays behind Leave participant/Admin policy and is not inferred from public storage access |
| Auth/system | `/api/auth/**`, `/api/auth/cleanup`, `/api/audit-logs/cleanup`, `/api/leave/attachments/cleanup`, cron/outbox/scheduler | Authentication/account lifecycle or trusted system principal/secret. No ordinary capability replacement was inferred |

ตรวจ caller trust แล้วพบว่า actor builders ใช้ `auth.user`, `auth.employeeId` หรือ trusted LIFF session ที่สร้าง server-side. Request body/query ใช้เป็น input/filter/target ID แล้วผ่าน schema, ownership และ domain checks; ไม่พบ route ที่รับ role, actor user ID, employee ID, capability decision, Team membership หรือ TeamRole ownership จาก client เพื่อสร้าง authority. Authorization Administration รับ Team/TeamRole/User IDs และ TeamRole name เป็น target/configuration input ที่ต้อง validate ownership/readiness; ชื่อ TeamRole ไม่ได้เป็น authority เอง. ข้อยกเว้นที่ต้องคงคำเตือนคือ `POST /api/audit-logs/export` รับ metadata จาก caller เพื่อบันทึก event และไม่ควรตีความว่าเป็นการ authorize data export

## Authorization Administration audit

Phase 10 Administration implementation ยังตรงกับ closure records:

- read models แสดง active/inactive Team, TeamRole, membership และ grants รวม invalid configuration ที่ inspectable โดยไม่ expose secret/token
- TeamRole response คง `teamId`; source ของ Team grant คง Team origin และ direct User TEAM ถูก reject
- mutation input ผ่าน schema/readiness/catalog guard; ไม่เปิด capability ที่ `POLICY_ACTIVATION_REQUIRED` หรือ `DEFERRED`
- writes และ audit event อยู่ใน transaction เดียวกัน พร้อม ownership/state/concurrency checks
- user search bounded และไม่ทำ broad unbounded identity query
- browser `modules/authorization/client.ts` เป็น presentation/API transport เท่านั้น; server API/page boundary เป็น authoritative

ไม่มีการ seed หรือ grant ใน Phase 11A และไม่มี delegated authorization administrator, tenant authorization, DENY, wildcard, ABAC, policy DSL, nested Team, inheritance, expiry หรือ external policy engine

## Compatibility and deferred separation

การแยกที่สำคัญที่สุดของ audit นี้คือ:

```text
central migrated capability
  ├─ exact NO_APPLICABLE_GRANT → documented compatibility floor
  ├─ domain relationship/state → domain policy
  └─ registered-but-not-migrated surface → deferred policy
```

ดังนั้นสิ่งต่อไปนี้ไม่ถูกนับเป็น bypass เพียงเพราะยังมี role comparison:

- compatibility floor ที่ adapter เรียก central resolver ก่อนและ fallback เฉพาะผลที่กำหนด
- Admin bootstrap ที่มี explicit trusted session และไม่ข้าม validation/domain/transaction
- account/workforce lifecycle และ last-admin checks
- Leave participant/recovery/workflow policy
- Routine summary/reference/export และ Email ที่เอกสารระบุชัดว่า deferred
- presentation projection, menu/page visibility และ browser flags

ในทางกลับกัน ห้ามนำคำว่า “Admin” ใน lower helper หรือ UI ไปสรุปว่า API route สามารถผ่านได้โดยไม่มี current Employee: stable `requireApiSession()` chain ตรวจ eligible Employee แล้ว แต่ lower application compatibility seams และ lifecycle race ยังเป็นสิ่งที่ต้องทำให้ contract ชัดใน Phase 11B

## Stale or contradictory documentation discovered

### Reconciled in this Phase 11A change

`docs/architecture/authorization-current-state.md` เคยอธิบาย account-only Admin ในบาง table/risk section กว้างเกิน end-to-end production reachability. ถูกปรับเฉพาะจุดที่เกี่ยวกับ:

- `requireActiveWorkforceOrAdminSession()` ใน section 3.2
- Routine create และ Stock cancel/process rows
- Stock image upload row (เดิมระบุ `requireAdminSession()` และ Admin-only ทั้งที่ source ใช้ Stock capability)
- Stock/Leave module summaries
- risk item เรื่อง helper contract mismatch
- old Phase 1 risk/recommendation headings ถูกระบุให้เป็น carried-forward/historical เพื่อไม่ให้ถูกอ่านเป็น active Phase 11 policy

ข้อความใหม่แยก upstream `requireApiSession()` requirement ออกจาก lower compatibility branch และระบุ test seam/lifecycle race โดยไม่เปลี่ยน production policy

### Verified architectural distinction (ไม่ใช่ stale-document finding)

- `lib/auth/server.ts:18-25` อธิบาย architecture ตรงกับ source: `resolveAuthenticatedAccount()` รองรับ generic valid active User ที่ไม่มี Employee ได้ ขณะที่ `getApiAuthSession()` เรียก `hasEligibleCurrentEmployeeForUser()` เพิ่มเป็น legacy API-session contract. `requireApiSession()` และ `requireAdminSession()` จึงต้องมี eligible current Employee แม้ generic account resolution จะไม่บังคับ. ไม่ต้องแก้ comment และไม่ควรใส่การ rewrite นี้ไว้ใน Phase 11B

### Historical or contradictory records that remain

- `docs/architecture/authorization-stock-migration.md` ระบุ lower Stock Admin-without-Employee behavior ว่า operational. ข้อความนั้นยังตรงกับ lower compatibility adapter แต่ overstates stable HTTP reachability เมื่ออ่านโดยไม่ประกอบ `requireApiSession()`; เก็บเป็น historical closure evidence และห้ามใช้เป็นหลักฐานเปิด policy ใหม่
- `docs/architecture/final-repository-audit.md` มี K0 historical wording ว่า Stock LIFF/client ownership ยังเป็น finding. ส่วนต้นเอกสารระบุว่าเป็น snapshot ประวัติ และ current source/checker มี Stock client boundary แล้ว; ไม่ควรอ่าน section นั้นเป็น current authorization state
- `docs/architecture/dependency-rules.md`/historical audit wording ที่บอกว่า Stock และ Routine client graph ยังไม่มี explicit guard ต้องแยกกัน: current checker มี Stock client-graph check แล้ว แต่ยังไม่พบ dedicated Routine client-graph checker. นี่เป็น architecture-enforcement gap ที่ควรพิจารณาแยกจาก authorization policy
- `docs/architecture/authorization-resolver.md` ส่วน Phase boundary เดิมที่เรียก Routine ว่าเป็น pilot และกล่าวถึง Stock/Leave/role checks ที่ยังไม่ migrate เป็น historical context ซึ่งถูก supersede โดย Phase 4–10 closure records; ไม่ใช่ current-state contract

ไม่พบ closure record ของ Phase 10A–10D ที่ขัดกับ actual Administration source ใน baseline. Closure records ยังคงเป็น historical evidence ของการปิด phase และไม่ถูก rewrite เพื่อเปลี่ยนผลลัพธ์ของ Phase 10

## Proposed exact Phase 11B enforcement scope

Phase 11B ต้องคงชื่อและขอบเขตเป็น **Architecture Enforcement & Legacy Bypass Prevention**. เนื่องจาก Phase 11A ยืนยัน `LEGACY_AUTHORIZATION_BYPASS` เป็นศูนย์ ขอบเขต implementation จึงเป็นการ harden architecture ที่พิสูจน์แล้วเท่านั้น ไม่ใช่การเปิด policy ใหม่หรือการ migrate deferred surface:

1. เพิ่ม/เสริม architecture checks เพื่อป้องกัน migrated business authorization จากการข้าม centralized authorization contract และทำ explicit allowlist/documentation แบบแคบสำหรับ role checks ที่ตั้งใจคงไว้
2. เพิ่ม regression coverage สำหรับ trusted actor provenance และบังคับให้ request/client ที่ส่ง role, user ID, employee ID, Team ID, capability หรือ authority data ไม่สามารถกำหนด authorization identity/authority ได้
3. รักษา invariant ว่า central authorization ต้องเกิดก่อน protected query/list/read และ mutation; ปกป้อง caller/boundary ของ raw query helper ที่ตั้งใจไม่ authorize ตัวเองให้ถูกเรียกจากขอบเขตที่ตรวจแล้วเท่านั้น
4. เพิ่ม transaction-time authorization/lifecycle re-check ในจุดที่ current contract กำหนด และทดสอบ lifecycle race โดยเฉพาะ lower Stock/Routine/Leave Admin/workforce compatibility seams
5. ทดสอบการคง grant origin ของ `TEAM` เมื่อ actor อยู่หลาย Team และทำให้ unknown capability, unsupported scope, invalid Team origin, ownership mismatch และ persisted configuration ที่ไม่ถูกต้องยัง fail closed และ inspectable
6. ยืนยันด้วย tests และ invariants ว่า ADMIN ไม่ bypass account/workforce lifecycle, input/resource/business invariants, workflow state, transaction หรือ concurrency guarantees
7. แยกและทดสอบ domain predicates `OWN` / `CREATED` / `ASSIGNED` / `TEAM` / `ALL` ตาม resource ที่เกี่ยวข้อง ไม่ให้ capability scope ถูกตีความแทน resource relationship/query policy
8. เพิ่ม regression tests สำหรับ lower Stock/Routine/Leave compatibility seams และ lifecycle races โดยไม่ตัดสิน policy ใหม่หรือเปิด reachability ใหม่
9. พิจารณา browser/server dependency-graph enforcement สำหรับ Routine ได้เฉพาะเมื่อ current architecture evidence แสดงว่ามี graph bypass ที่ควรบังคับด้วย checker เพิ่ม; ต้องแยกการบังคับ graph ออกจาก policy migration

## Post-11B policy and migration decisions

รายการต่อไปนี้ไม่ใช่ Phase 11B enforcement implementation และต้องรอ business/architecture decision ที่ระบุ scope, data sensitivity, channel, predicate และ rollout อย่างชัดเจน:

- การตัดสิน Employee broad-data/PII visibility
- การ narrow หรือ expand Routine broad-query policy
- การตัดสิน Leave reporting visibility
- การ migrate Routine summary/reference/export
- การ migrate Leave report/participant/attachment/recovery/cancellation-decision surfaces
- การ migrate Email Request หรือ future IT authorization
- การ activate compatibility-backed production Team policy
- การ retire compatibility floors
- การ seed หรือ grant policy ใหม่

Phase 11A ยังคงข้อห้ามเดิม: ห้ามเพิ่ม DENY/wildcard/ABAC/DSL/nested Team/inheritance/expiry/delegated admin/tenant policy/external engine และห้าม infer authorization จาก Department/manager/Employee hierarchy

## Verification record

รันจาก repository baseline ใน working tree นี้:

- `npm.cmd run architecture:check` — **ผ่าน**; ตรวจ 1,118 repository source files สำหรับ module boundaries
- `npm.cmd run lint:strict` — **ผ่าน**; ESLint จบด้วย `--max-warnings=0`
- `npm.cmd run typecheck` — **ผ่าน**; `tsc --noEmit`
- focused authorization/domain command ที่ครอบคลุม resolver, Administration, adapters, workforce/LIFF และ Routine/Leave/Stock near-miss routes — **ผ่าน**; 24 test files, 277 tests
- `npm.cmd run test:run` — **ผ่าน**; 313 test files, 2,715 tests

ไม่ได้รัน dev server หรือ production build เพราะไม่จำเป็นต่อ documentation-only audit และไม่ได้รัน MySQL integration suite เพราะ Phase 11A ไม่ได้เปลี่ยน schema/persistence production behavior. ไม่มี GitHub workflow/check หรือ security scanner result ถูกอ้างในรายงานนี้

การ correction review หลัง commit `41ccff8c8d6033e6435fda5e6b6712ca1708b5d2` รันเพิ่ม: final production role/`isAdmin` search โดยตัด test/docs/vendor noise — **ผ่านการ reconcile กับ register**; `git diff --check` — **ผ่าน**; `npm.cmd run architecture:check` — **ผ่าน**. Diff ของ correction นี้มีเฉพาะเอกสาร audit และไม่ได้ rerun lint/typecheck/full test suite เพราะไม่มี production source หรือ behavior เปลี่ยน
