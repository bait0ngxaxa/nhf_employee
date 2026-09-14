# Authorization Phase 10A — Administration Contract & Safe Read Model

สถานะ: CLOSED; full MySQL integration runner ยังมี failure นอก scope แต่ได้ตรวจเทียบกับ baseline และยืนยันว่าเป็น failure เดิมตามรายละเอียดด้านล่าง
วันที่: 2026-09-14

## Scope และ baseline

Phase 9A, 9B และ 9C ปิดแล้วตาม [authorization-phase-9c-closure.md](authorization-phase-9c-closure.md). Phase 10A จึงเริ่มจากระบบที่ current production authorization surfaces ใช้ centralized authorization architecture แล้ว โดยมี deferred exceptions ที่บันทึกไว้เดิม โดยเฉพาะ Routine `routine.task.export`, `routine.summary.read`, `routine.reference.read` และ Email Request/future IT module

เป้าหมายของ Phase 10A คือสร้าง contract ฝั่ง server สำหรับการตรวจสอบ configuration ของ Authorization Administration เท่านั้น ได้แก่ Team, TeamRole, membership, Team/TeamRole/User grants, code-owned capability registry และ effective permissions ของ User พร้อม source explanation. ระยะนี้เป็น read-only foundation และไม่ใช่การเปิด Team policy ให้ production ใช้งาน

Phase 10A ไม่ mutate authorization configuration, ไม่ retire compatibility behavior และไม่ migrate deferred modules

## Administration authority และ security boundary

Authorization Administration ใช้ `ADMIN` เป็น bootstrap administration authority เพียงอย่างเดียว ไม่มี capability ใหม่ เช่น `authorization.manage` และไม่มี delegated administrator ใน phase นี้

เส้นทางทั้ง API และ Dashboard ใช้ลำดับเดียวกัน:

```text
trusted session cookie
  -> existing account authentication
  -> existing eligible account/workforce check
  -> server-derived current role and user id
  -> explicit Authorization Administration ADMIN guard
  -> application read use case
  -> bounded persistence read model
```

`requireAuthorizationAdministrationApiSession()` ใช้ `requireAdminSession()` ที่มีอยู่แล้ว และยืนยัน principal แบบ structural ซ้ำด้วย `assertAuthorizationAdministrationAccess()`. `requireDashboardAuthorizationAdministration()` ใช้ trusted `getCurrentUserProjection()` และ guard เดียวกัน ก่อนเรียก read use case. Role, admin status, employee id และ actor identity จาก query, body, client state หรือ client claims ไม่ถูกใช้เป็น authority

API routes ไม่พึ่ง menu visibility หรือ React client และไม่ query Prisma โดยตรง:

- `GET /api/authorization/administration` — overview, capability catalog และ Team summaries
- `GET /api/authorization/administration/teams/[id]` — Team detail
- `GET /api/authorization/administration/users/[id]` — User/account, configuration และ effective permission detail
- `/dashboard/authorization` — minimal server-protected read-only foundation สำหรับ Dashboard

เมนู Dashboard ยังไม่เพิ่มรายการใหม่ เพราะ Phase 10A ยังไม่มี management UI; direct route ยังคงมี server-side guard และไม่เป็น public/empty administration surface

## Read model architecture

`modules/authorization/application/administration.ts` เป็น application boundary และ expose use cases ผ่าน `@/modules/authorization`. Route/page ไม่เห็น Prisma delegate หรือ join logic

`authorization-administration-repository.ts` เป็น persistence adapter แบบ read-only ใช้ bounded nested `select`, `_count` และ deterministic ordering:

- Team list: scalar metadata และ role/membership/team-grant counts
- Team detail: Team metadata, roles, role counts, memberships, safe User/Employee display identity, Team grants และ TeamRole grants
- User detail: safe account identity, system role, account/workforce lifecycle, Team memberships/TeamRole references และ direct User grants

ข้อมูล User ถูกจำกัดไว้ที่ identity ที่จำเป็นต่อการตรวจสอบสิทธิ์และ display identity ที่เกี่ยวข้อง ไม่ดึง password, token, session หรือข้อมูล domain ที่ไม่เกี่ยวข้อง. `TeamRole` ทุก projection มี `teamId`; membership relation และ role origin จึงไม่ถูก flatten ข้าม Team

Inactive Team, inactive TeamRole, inactive account และ inactive/suspended/deleted Employee ยังคงปรากฏเป็น lifecycle/configuration state. Read model ไม่ลบหรือซ่อน persisted configuration และไม่เปลี่ยน runtime lifecycle semantics

## Capability administration catalog และ grantability

`CAPABILITY_REGISTRY` ยังคงเป็น source of truth เดียวสำหรับ capability key, domain, description, supported scopes และ supported channels. `buildCapabilityAdministrationCatalog()` project registry entries ตามลำดับ registry เดิม และใช้ exhaustive code-owned metadata map เพิ่มเฉพาะ operational administration status

จึงแยกสองความหมายอย่างชัดเจน:

```text
registered capability
  !=
administratively grantable capability
```

ทุก entry มี `registered: true`, supported scopes/channels และ operational metadata สองชั้น:

```text
runtimeAuthorizationMode
  CENTRAL_ONLY              -> administrativeStatus GRANTABLE
  CENTRAL_WITH_COMPATIBILITY -> administrativeStatus POLICY_ACTIVATION_REQUIRED
  DEFERRED                  -> administrativeStatus DEFERRED
```

`administrativelyGrantable` ถูก derive จาก `administrativeStatus` และเป็น `true`
เฉพาะ `GRANTABLE` เท่านั้น. ดังนั้น `POLICY_ACTIVATION_REQUIRED` และ
`DEFERRED` ต่างก็เป็น `false` และ future Phase 10B ต้องตรวจ application
contract นี้บน server ไม่ใช่ใช้ label จาก UI.

การจัดกลุ่มนี้มาจาก `legacy*Scopes()` และการตัดสินใจใน domain adapters จริง
รวมถึง migration records ไม่ได้อนุมานจากชื่อ Team/role หรือหน้า UI:

| Classification | Capabilities |
|---|---|
| `CENTRAL_ONLY` / `GRANTABLE` | `employee.create`, `employee.update`, `employee.delete`, `employee.import`; `routine.occurrence.override`, `routine.occurrence.reassign`, `routine.occurrence.change_due_date`, `routine.import.manage`; `stock.inventory.manage`, `stock.request.process`, `stock.report.export`; `leave.approver.manage`; `audit.read` |
| `CENTRAL_WITH_COMPATIBILITY` / `POLICY_ACTIVATION_REQUIRED` | `employee.read`, `employee.stats.read`, `employee.export`; `department.read`; `routine.task.read`, `routine.task.create`, `routine.task.update`, `routine.task.delete`, `routine.occurrence.read`; `stock.catalog.read`, `stock.request.read`, `stock.request.create`, `stock.request.cancel`; `leave.request.read`, `leave.approval.read`, `leave.request.create`, `leave.request.cancel`, `leave.request.approve`, `leave.cancellation.decide`, `leave.request.not_taken`; `notification.inbox.read`, `notification.inbox.update` |
| `DEFERRED` | `routine.task.export`, `routine.summary.read`, `routine.reference.read`, `email.request.read`, `email.request.create` |

`CENTRAL_WITH_COMPATIBILITY` หมายความว่าอย่างน้อยหนึ่ง current domain
adapter ยังแปล `NO_APPLICABLE_GRANT` เป็น compatibility scope สำหรับ normal
production user ใน channel/path ที่รองรับ. เช่น Routine task read ขึ้นกับ
management/work-item view และ requested scope; catalog จึงไม่สร้าง final
runtime scope เดียวปลอม ๆ ให้ capability เหล่านี้. การเพิ่ม explicit partial
grant ในอนาคตอาจทำให้ compatibility branch ไม่ทำงานและทำให้ scope เดิมหายไป
จึงต้องเป็น policy activation/migration workflow แยกจาก ordinary additive grant.

`CENTRAL_ONLY` หมายถึงไม่พบ normal-user `NO_APPLICABLE_GRANT` translation ใน
adapter ที่ audit ไว้; resolver result จึงเป็นแหล่ง generic authorization
เพียงแหล่งเดียว แต่ยังไม่แทน domain relationship/workflow checks. `DEFERRED`
หมายถึง runtime path ยังไม่พร้อมให้ Authorization Administration นำไป
กำหนด grant.

ตัวอย่าง deferred คือ:

- `routine.task.export`
- `routine.summary.read`
- `routine.reference.read`
- `email.request.read`
- `email.request.create`

Metadata map นี้ไม่ใช่ registry ที่สอง: ถ้ามีการเพิ่ม key ใน registry จะต้องตัดสิน administration metadata ให้ครบก่อนจึง compile ผ่าน. Database ไม่สามารถสร้าง capability หรือ scope ใหม่ได้; persisted unknown key/unsupported scope ถูก project เป็น `INVALID` พร้อม raw value เดิม ไม่ trim, coerce, normalize หรือ fallback เป็น `ALL`

## Effective Permission Inspector

User inspection เรียก `authorization.resolveMany()` ผ่าน `AuthorizationResolver` ตัวจริง ไม่สร้าง permission merger ชุดที่สอง. ระบบแสดงทั้ง `AuthorizationDecision` และ grant source ของแต่ละ effective grant:

- `SYSTEM_ROLE` — system role `ADMIN`
- `TEAM` — `teamId` และ Team reference
- `TEAM_ROLE` — `teamId`, `teamRoleId`, Team reference และ TeamRole reference
- `USER` — direct User grant ของ selected user

Union semantics จึงยังเป็น semantics ของ central resolver: Team grants + active TeamRole grants ที่ผ่าน membership + direct User grants. Source ถูกเก็บแยกทุก grant และ multiple Teams ไม่ถูกรวมเป็น generic `TEAM`. หาก resolver รองรับ `TEAM` scope, `constraint.teamId` และ originating Team จะถูกส่งต่อแบบ explicit; ห้าม flatten `TEAM / teamId=10` กับ `TEAM / teamId=20`

Inspector ใช้ชื่อ `resolverEffectivePermissions` และ
`resolverEffectivePermissionStatus` อย่างเจตนา. ทั้งสองชื่อหมายถึงผลจาก
central `authorization.resolveMany()` เท่านั้น ไม่ใช่ final production
runtime access. ในแต่ละ permission, `allowed`, `scopes`, `grants` และ
`reason` เป็นค่าของ `AuthorizationDecision`; capability ที่แนบอยู่จะบอก
`runtimeAuthorizationMode` เพื่อให้เห็นว่า domain compatibility อาจตีความ
`NO_APPLICABLE_GRANT` ต่อได้หรือไม่.

ตัวอย่างความหมายที่ contract เปิดเผยได้:

```text
routine.task.update
  resolver: DENY / NO_APPLICABLE_GRANT
  runtimeAuthorizationMode: CENTRAL_WITH_COMPATIBILITY
  interpretation: Routine adapter อาจให้ compatibility access ตาม path
```

ในทางกลับกัน `audit.read` ที่เป็น `CENTRAL_ONLY` ไม่ควรถูกแสดงว่า runtime
มี scope อื่นจาก generic inspector. ไม่มีการสร้าง final runtime scope ทั่วไป
และไม่มีการทำ domain adapter ซ้ำใน Authorization Administration. Domain
relationship, owner, effective approver, workflow และ business rules ยังคง
ต้องตรวจใน domain ของตนเอง

หาก central resolver พบ `AuthorizationConfigurationError`, ผล
`resolverEffectivePermissionStatus` จะเป็น `INVALID_CONFIGURATION` พร้อม
error code/details และ `resolverEffectivePermissions` จะว่าง ไม่สร้าง
permissive result. Configuration ที่อ่านจาก Team/User detail ก็ถูกจัดประเภท
โดยไม่ reinterpret เป็น allow

Effective permission เป็น generic authorization result เท่านั้น ไม่ใช่คำรับรองว่า resource operation ทุกชนิดจะสำเร็จ:

```text
capability allowed
  + scope allowed
  + domain relationship
  + workflow/business rule
  = final resource decision
```

การตรวจ lifecycle ยังคงอยู่ใน trusted session/workforce boundary ส่วน owner, manager/approver, workflow และ transaction rules ยังคงอยู่ใน domain/application boundary เดิม และ Phase 10A ไม่เปลี่ยน semantics เหล่านั้น

## Audit และ Phase 10B handoff

Phase 10A เป็น read-only จึงไม่สร้าง audit event จากการอ่าน และไม่ reuse `SETTINGS_UPDATE` เป็น authorization audit model

Phase 10B ต้องเพิ่ม mutation use cases ที่ผ่าน contract นี้ พร้อม authorization-specific audit event ซึ่งตอบได้ว่าใครเปลี่ยนอะไร, Team/User/TeamRole ใด, old state, new state และเมื่อใด. งานดังกล่าวรวม Team/TeamRole lifecycle, membership และ grant mutations, validation, transaction/idempotency ที่เหมาะสม และ audit attribution

## Explicit non-goals

Phase 10A ไม่ได้:

- สร้าง/แก้/ลบ Team, TeamRole, membership หรือ grant
- activate หรือ seed production Team policy
- derive Team จาก Department, manager, position หรือ job title
- grant capability ให้ User ใด
- เปลี่ยนหรือลบ compatibility floor (จึงไม่ retire compatibility behavior) หรือ current production feature authorization
- activate deferred Routine/Email Request policy หรือ migrate Email Request
- เพิ่ม `DENY`, wildcard, role inheritance, nested Team, ABAC, policy DSL หรือ external policy engine
- เพิ่ม authorization caching หรือทำ UI redesign

ดังนั้น locked rule `Department != Team` ยังคงเดิม และไม่มี Department-to-Team inference ใน implementation

## Tests และ verification

เพิ่ม focused coverage สำหรับ:

- ADMIN-only application boundary และ malformed/forged actor input
- API 401/403/ADMIN behavior, client role parameter bypass และ malformed identifiers
- Dashboard direct-route guard และ page composition order
- deterministic registry projection, deferred non-grantability และ unknown capability non-invention
- Team summary/detail, inactive state, same-Team TeamRole ownership, membership และ invalid persisted grants
- User identity/lifecycle, multiple Team memberships, Team/TeamRole/User source explanation, central resolver union/default deny และ invalid resolver configuration fail-closed
- bounded Prisma read adapter query shape และ absence of N+1 relation calls

ผลคำสั่ง verification ที่รันจริง:

```text
npm.cmd run architecture:check
npm.cmd run lint:strict
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run check
```

- `npm.cmd run architecture:check` — ผ่าน, ตรวจ 1,081 source files
- `npm.cmd run lint:strict` — ผ่าน
- `npm.cmd run typecheck` — ผ่าน
- `npm.cmd run check` — ผ่าน; รวม architecture check, strict lint, typecheck และ `test:run`
- `npm.cmd run test:run` (ผ่านภายใน `check`) — ผ่าน 305 test files / 2,661 tests

Focused tests:

```text
modules/authorization/application/administration.test.ts
modules/authorization/infrastructure/persistence/authorization-administration-repository.test.ts
modules/authorization/application/resolver.test.ts
modules/authorization/application/grant-validation.test.ts
__tests__/api/authorization-administration.test.ts
__tests__/dashboard-route-access.test.ts
__tests__/dashboard-authorization-administration-page.test.tsx
__tests__/auth/current-user-projection.test.ts
```

Focused hardening invocation ครอบคลุม 8 test files / 74 tests และผ่าน รวม
central resolver, grant validation, authorization administration application
และ persistence adapter, current-user projection, API/Dashboard administration
boundary และ page boundary. Focused MySQL integration ของ authorization
persistence/resolver ผ่าน 2 test files / 11 tests โดยใช้ฐาน
`employee_nhf_integration`

`npm.cmd run test:integration:mysql` ลง migrations สำเร็จและ authorization integration ที่เกี่ยวข้องผ่าน. Full integration set มี 1 failure จาก `__tests__/integration/leave-quota-concurrency.integration.test.ts` (15 test files / 96 tests: 95 ผ่าน / 1 ไม่ผ่าน). สถานะ pre-existing ถูกตรวจเทียบจริงโดยรันคำสั่งต่อไปนี้ใน baseline archive ที่ checkout จาก `fe5cf7f1c84a7a8a50db98db836819db1dd9e6de` และใน hardened Phase 10A working tree ตามลำดับ:

```text
npm.cmd exec -- vitest run --config vitest.integration.config.ts __tests__/integration/leave-quota-concurrency.integration.test.ts
```

ผลทั้ง baseline และ hardened HEAD: **1 test ไม่ผ่าน** ด้วย
`WorkforceAuthorizationError` ที่
`modules/leave/application/authorization.ts:79` (`parseUserRole`). สาเหตุที่
trace ได้คือ integration mock ส่ง role ไว้ใน `session.user` แต่ object
`auth.user` ที่ route ใช้สร้าง Leave actor ไม่มี `role`; failure จึงเกิดก่อน
business assertion และไม่เกี่ยวกับ Phase 10A read-only code. นี่เป็นหลักฐาน
ว่า failure **verified pre-existing at baseline** ไม่ใช่เพียงการคาดเดา. Full
integration runner ยังไม่เขียว แต่ไม่พบ regression ของ Phase 10A จากการ
เปรียบเทียบนี้

## Closure and remaining deferred work

Phase 10A ปิดได้ในขอบเขตนี้: ADMIN boundary, safe catalog พร้อม
compatibility/readiness classification, Team/User read models, resolver-only
inspection, source/Team constraint preservation, inactive visibility และ
invalid-configuration handling ผ่าน focused/repository checks แล้ว. Full MySQL
runner ยังมี failure ที่ verified pre-existing ตามด้านบน จึงเป็น limitation ของ
repository verification ไม่ใช่เหตุให้เปิด mutation หรือแก้ code นอก phase

งานถัดไปคือ Phase 10B เท่านั้น: audited authorization configuration mutations บน application contract นี้. ยังไม่มีสิทธิ์แก้ configuration จาก Phase 10A และไม่มี Team policy rollout จาก phase นี้
