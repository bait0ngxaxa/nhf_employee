# Authorization Phase 10A — Administration Contract & Safe Read Model

สถานะ: IMPLEMENTED; ยังไม่ประกาศ CLOSED เนื่องจาก full MySQL integration runner มี pre-existing failure นอก scope ตามรายละเอียดด้านล่าง
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

ทุก entry มี `registered: true`, supported scopes/channels และ `administrativeStatus`. `GRANTABLE` เท่านั้นที่เป็น candidate สำหรับ future Phase 10B mutation UI/API. `DEFERRED` มี `administrativelyGrantable: false` และเหตุผลที่แสดงได้ โดยใน baseline นี้ deferred คือ:

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

Inspector มีชื่อและสถานะแยกสำหรับ `effectivePermissions` และ `configurationIssues`. หาก central resolver พบ `AuthorizationConfigurationError`, ผล effective inspection จะเป็น `INVALID_CONFIGURATION` พร้อม error code/details และไม่สร้าง permissive result. Configuration ที่อ่านจาก Team/User detail ก็ถูกจัดประเภทโดยไม่ reinterpret เป็น allow

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
- `npm.cmd run test:run` (ผ่านภายใน `check`) — ผ่าน 305 test files / 2,659 tests

Focused tests:

```text
modules/authorization/application/administration.test.ts
modules/authorization/infrastructure/persistence/authorization-administration-repository.test.ts
__tests__/api/authorization-administration.test.ts
__tests__/dashboard-route-access.test.ts
__tests__/dashboard-authorization-administration-page.test.tsx
```

Focused authorization/current-user invocation ครอบคลุม 11 test files / 78 tests และผ่าน รวม central resolver, grant validation, authorization persistence adapter, current-user projection, API/Dashboard administration boundary และ page boundary. Focused MySQL integration ของ authorization persistence/resolver ผ่าน 2 test files / 11 tests โดยใช้ฐาน `employee_nhf_integration`

`npm.cmd run test:integration:mysql` ลง migrations สำเร็จและ authorization integration ที่เกี่ยวข้องผ่าน แต่ full integration set มี 1 failure จาก `__tests__/integration/leave-quota-concurrency.integration.test.ts` (95 ผ่าน / 1 ไม่ผ่าน). Failure อยู่ใน Leave workforce fixture/authorization path ที่ไม่ถูกแก้ไขโดย Phase 10A; ไม่กระทบ focused authorization integration และถูกบันทึกเป็น pre-existing/out-of-scope limitation ไม่ใช่เหตุผลให้เปลี่ยน implementation นอก phase

## Closure and remaining deferred work

Phase 10A implementation ครบในส่วน ADMIN boundary, safe catalog, Team/User read models, effective resolver inspection, source/Team constraint preservation, inactive visibility และ invalid-configuration handling. ยังไม่ประกาศ CLOSED จนกว่า full repository integration verification จะกลับมาเขียว; failure ปัจจุบันอยู่ใน Leave quota concurrency ซึ่งไม่ได้อยู่ใน Phase 10A และไม่มีการแก้ speculative นอก scope

งานถัดไปคือ Phase 10B เท่านั้น: audited authorization configuration mutations บน application contract นี้. ยังไม่มีสิทธิ์แก้ configuration จาก Phase 10A และไม่มี Team policy rollout จาก phase นี้
