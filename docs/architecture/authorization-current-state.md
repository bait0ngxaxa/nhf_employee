# NHF Employee — Current Authorization State

สถานะ: Phase 0 — Authorization Discovery & Behavior Freeze<br>
วันที่สำรวจ: 2026-09-10<br>
ขอบเขต: พฤติกรรมจาก source code, callers, Prisma/query scopes, routes, presentation projections และ tests ที่มีอยู่ใน repository ปัจจุบัน

เอกสารนี้เป็น baseline ของพฤติกรรมปัจจุบัน ไม่ใช่ policy ใหม่และไม่ใช่การออกแบบ resolver ในอนาคต ทุกข้อความที่ระบุว่า “ปัจจุบัน” หมายถึงสิ่งที่ trace ได้จาก code หรือ test โดยตรง การพบพฤติกรรมที่เสี่ยงหรือดูไม่ตรงกับหลัก least privilege จะถูกบันทึกเป็น risk เพื่อให้ Phase ถัดไปตัดสินใจอย่างชัดเจน โดย Phase 0 ไม่แก้ผลลัพธ์ authorization เดิม

## Executive summary

ระบบปัจจุบันมี role ระดับระบบเพียง ADMIN และ USER โดย ADMIN เป็น role สูงสุด แต่ไม่ได้เป็น bypass ของ authentication, active account/workforce, relationship, workflow, validation หรือ transaction rules

เส้นทางตัดสินใจปัจจุบันโดยสรุปคือ:

~~~text
web access cookie / LIFF session / system secret
  -> account or channel authentication
  -> active User and, for legacy API, eligible active Employee
  -> route guard or domain/query relationship
  -> resource scope
  -> business state, validation, concurrency and transaction invariant
  -> response or mutation
~~~

จุดสำคัญที่ต้อง freeze ไว้:

- API legacy adapter ใช้ requireApiSession() และ requireAdminSession() เป็นแกนกลาง ค่าเริ่มต้นคือ unauthenticated 401 และ authenticated-but-not-admin 403 แต่บาง route ตั้ง response factory ให้ทั้งสองกรณีเป็น 403
- getApiAuthSession() ไม่ได้ตรวจแค่ account แต่ยังคง legacy contract ที่ต้องมี Employee ที่ ACTIVE และไม่ถูกลบ
- Dashboard layout ป้องกันการเข้าใช้งานโดยต้องได้ current active Employee projection แต่ role guard มีเฉพาะบาง page; navigation และการซ่อนปุ่มเป็น presentation เท่านั้น
- Routine มี semantics แบบ channel-aware: Admin ของ Dashboard-owned API ได้ admin scope แต่ Admin ที่ผ่าน LIFF_SELF_SERVICE ถูกปฏิบัติเหมือนผู้ใช้ self-service สำหรับ task operations
- Routine task work-item, summary และ export paths ปัจจุบันยอมรับ scope=all ของ USER และ query สามารถไม่มี assignee filter; พฤติกรรมนี้มี tests freeze ไว้และถูกบันทึกเป็น high-risk migration input
- Stock แยก requester ownership กับ admin processor/inventory อย่างชัดเจนใน route/query แต่ command บางตัวเชื่อ route guard และรับ isAdmin จาก caller
- Leave ไม่ใช่ Admin-vs-User อย่างเดียว: approval ใช้ effective approver จาก exceptionApproverId หรือ approverId; Admin override มีเฉพาะบาง Dashboard/API workflow และถูกปิดสำหรับ LIFF
- canApproveLeave, canViewLeaveReports และ LiffCapabilities เป็น projections สำหรับ presentation/entry-point behavior ไม่ใช่ authoritative server permission
- LIFF Routine reference route มี mode omission ที่อาจทำให้ internal query ใช้ Admin branch แต่ serializeLiffRoutineReference() ไม่ส่ง employee list ออกไป; จึงเป็น internal channel-context/least-data-access risk ไม่ใช่ client-visible employee disclosure ที่พิสูจน์แล้ว
- ยังไม่พบ Team, TeamRole, Capability Registry, generic scope engine หรือ Department-based authorization ใน repository นี้

## 1. Scope, terms and classification

### 1.1 Terms used by the current system

| Term | Current meaning | Boundary note |
|---|---|---|
| User | บัญชีที่ใช้ login, มี role, active/deleted state และ account identity | ไม่ใช่ตัวแทนของสิทธิ์ทุกอย่างหรือ workforce lifecycle ทั้งหมด |
| Employee | ตัวตนพนักงานที่เชื่อมกับ User และมีสถานะการทำงาน | เป็นเงื่อนไข workforce ของหลาย API/ธุรกรรม และเป็นเจ้าของ manager/participant relationship บางส่วน |
| Department | โครงสร้าง HR/องค์กร ใช้แสดงผล, filter, statistics และ reference data | ไม่พบการใช้ Department เป็นตัวอนุมาน authorization |
| ADMIN / USER | ค่า role ระบบจาก lib/ssot/permissions.ts และ User.role | ADMIN เป็น highest system role แต่ไม่ bypass domain invariants |
| DASHBOARD | Browser web route และ Dashboard API | Web middleware/route guards กับ API guards เป็นคนละชั้น |
| API | /api/** ที่ใช้ hybrid access cookie | middleware.ts ไม่ครอบ /api; route ต้องเรียก server guard เอง |
| LIFF_SELF_SERVICE | LINE/LIFF route ที่ใช้ LIFF session cookie และ linked LINE identity | บาง domain โดยเฉพาะ Routine/Leave มี channel-specific restriction |
| SYSTEM | Cron, cleanup, webhook หรือ infrastructure endpoint | ใช้ shared secret/HMAC ไม่ได้ใช้ User role |

### 1.1.1 Entry-point surface vs authorization execution channel

ใน Current Authorization Matrix คอลัมน์ `Channel` ใช้เป็นการจัดกลุ่ม **entry-point / transport surface** ของพฤติกรรมปัจจุบัน จึงยังมีค่า `API` เพื่อบอกว่า decision ถูกบังคับใช้ใน HTTP route handler ภายใต้ `/api/**` การใช้ `API` ใน matrix ไม่ได้หมายความว่าอนาคตต้องมี `API` เป็นค่าใน `AuthorizationActor.channel`

ให้แยกคำสองชุดนี้ออกจากกัน:

- **Entry-point / transport surface:** `DASHBOARD`, `API`, `LIFF`, `SYSTEM endpoint`
- **Authorization execution channel:** `DASHBOARD`, `LIFF_SELF_SERVICE`, `SYSTEM`

หลาย `/api/**` routes เป็น server endpoints ที่ Dashboard เรียกใช้ ดังนั้น Phase 1 ต้อง derive execution context จาก caller/security context: Dashboard-owned API calls โดยปกติยังเป็น `DASHBOARD` context, LIFF routes ใช้ `LIFF_SELF_SERVICE`, และ trusted background/platform operations ใช้ `SYSTEM` หรือ system principal model ที่ได้รับอนุมัติโดยเฉพาะ ห้ามเพิ่ม `API` เป็น actor channel เพียงเพราะ route ใช้ HTTP transport นี้

### 1.2 Authentication vs Authorization Classification

การบันทึกใน matrix แยกชั้นดังนี้:

| Classification | ความหมายใน baseline นี้ |
|---|---|
| AUTHENTICATION | ยืนยันว่าคำขอมาจาก account/session/channel ที่ valid |
| ACCOUNT_LIFECYCLE | User active/deleted, Employee active/deleted/status และ linked identity |
| AUTHORIZATION | role หรือการตัดสินใจว่า actor มีอำนาจทำ operation หรือไม่ |
| RESOURCE_RELATIONSHIP | owner, creator, assignee, requester, approver, manager, participant หรือ resource query scope |
| BUSINESS_RULE | สถานะคำขอ, workflow, quota, active references, self-action, valid transition และ domain invariant |
| FEATURE_FLAG | เปิด/ปิด Leave หรือ Routine; ไม่ใช่ permission |
| PRESENTATION_ONLY | menu/button/tab/capability projection ที่ช่วย UX แต่ไม่ใช่ server authority |

Flow ที่พบใน mutation สำคัญโดยทั่วไปจึงมีหลายชั้น:

~~~text
valid session
  -> active account/workforce
  -> role/relationship authorization
  -> resource visibility
  -> business/workflow validation
  -> transaction and concurrency protection
~~~

## 2. Discovery method and evidence

การสำรวจทำจาก repository ปัจจุบัน โดย:

- อ่าน AGENTS.md, CONTEXT.md, docs/agents/domain.md และ architecture records ที่เกี่ยวข้อง ได้แก่ module-boundaries.md, dependency-rules.md, employee-migration.md, auth-session-identity-migration.md, leave-migration.md, routine-migration.md, stock-migration.md, audit-migration.md และ ADR 0001–0003
- ค้นหา repository-wide ทั้งคำตรงและ semantic call chains สำหรับ role, auth guards, ownership, creator/assignee/requester/approver/manager/participant, export/audit/recovery/settings, feature flags, 401/403/redirect/not-found และ query where clauses
- อ่าน implementation และ callers ของ route guards, service/application functions, transaction assertions, persistence queries และ presentation projections
- เทียบกับ tests ที่มีอยู่ โดยเฉพาะ route tests, application query/mutation tests, domain tests และ integration tests
- ไม่ได้เชื่อมต่อหรืออ่าน production database ใน Phase 0; query scope ด้านล่างเป็น static behavior ที่ trace ได้จาก code/test

Source entry points หลัก:

- Role: lib/ssot/permissions.ts:isAdminRole
- API auth: lib/auth/api.ts:requireApiSession, lib/auth/api.ts:requireAdminSession, lib/auth/server.ts:getApiAuthSession
- Workforce: lib/auth/workforce.ts:requireActiveWorkforceSession, lib/auth/workforce.ts:requireActiveWorkforceOrAdminSession, lib/auth/workforce-transaction.ts:assertActiveWorkforceInTransaction
- Dashboard projection/guard: app/_lib/auth/current-user.ts:getCurrentUserProjection, app/dashboard/_lib/route-access.ts:requireDashboardAdmin
- LIFF: modules/line/application/liff.ts:requireLiffWorkforceSession, modules/line/application/liff.ts:getLiffCapabilities
- Domain-specific rules: modules/routine/application/authorization.ts, modules/routine/application/queries.ts, modules/routine/application/mutations.ts, modules/stock/application/queries/queries.ts, modules/stock/application/requests/request-mutations.ts, modules/leave/application/approvals/**, modules/leave/application/cancellation/cancellation.ts, modules/leave/application/not-taken.ts

## 3. Global current enforcement model

### 3.1 API session and role

requireApiSession() เรียก getApiAuthSession() ซึ่ง:

1. อ่าน hybrid access cookie
2. resolve account ด้วย resolveAuthenticatedAccount
3. ปฏิเสธ account ที่ไม่ valid, inactive หรือถูกลบผ่าน account identity boundary
4. เรียก hasEligibleCurrentEmployeeForUser ซึ่งต้องพบ Employee ที่ ACTIVE และ deletedAt = null
5. สร้าง ApiAuthSession และ UserContext

ดังนั้นใน production call chain ปัจจุบัน API session ที่ผ่าน requireApiSession() ต้องมีทั้ง account ที่ใช้งานได้และ current eligible Employee แม้บาง application helper จะออกแบบให้ Admin ไม่มี Employee ได้

requireAdminSession() ทำต่อจาก requireApiSession() และใช้ isAdminRole(auth.user.role):

- ไม่มี session หรือ account/workforce eligibility ไม่ผ่าน: 401 โดย default
- มี session แต่ role ไม่ใช่ ADMIN: 403 โดย default
- unauthorizedResponse และ forbiddenResponse ของ caller เปลี่ยน status/message ได้; จึงต้องดู route ประกอบ ไม่สรุปจากชื่อ helper อย่างเดียว

### 3.2 Active workforce

requireActiveWorkforceSession() เรียก API session อีกชั้น แล้ว re-read User/Employee:

- User ต้อง active และไม่ถูกลบ
- ต้องมี Employee
- Employee ต้อง ACTIVE และไม่ถูกลบ
- ไม่มี Employee: default 404 หรือ custom employee-profile response
- Employee inactive/deleted: 403

requireActiveWorkforceOrAdminSession() มี branch ที่คืน Admin ได้โดยไม่ตรวจ active Employee ซ้ำใน helper แต่ helper เริ่มจาก requireApiSession() ซึ่งปัจจุบัน reject ผู้ที่ไม่มี eligible Employee ไปแล้ว จุดนี้จึงเป็นความไม่สอดคล้องของ contract/layer ที่ต้องระวังในการ migration ไม่ใช่หลักฐานว่า API ปัจจุบันเปิดให้ Admin ที่ไม่มี Employee ผ่านได้จริง

Mutation ที่มีผลต่อข้อมูลสำคัญยัง re-check ใน transaction เช่น assertActiveWorkforceInTransaction, assertActiveRoutineActorInTransaction และ assertActiveAdminInTransaction พร้อม lock User/Employee หรือ resource row ตาม domain

### 3.3 Dashboard

- middleware.ts ตรวจ hybrid access token เฉพาะ web route เพราะ matcher ไม่ครอบ /api; ทำหน้าที่ authentication/routing ไม่ใช่ domain authorization
- app/dashboard/layout.tsx เรียก getCurrentUserProjection; ถ้าไม่มี current active Employee projection จะ redirect ไป login
- requireDashboardAdmin() redirect ไป login เมื่อไม่มี user และ redirect ไป /access-denied เมื่อ role ไม่ใช่ Admin
- DashboardProvider, constants/dashboard.ts และ DashboardSidebar กรอง menu/requiredRole/feature flag ฝั่ง client
- Dashboard page ที่มี server Admin guard ปัจจุบันคือ Audit, Email Request, Employee New และ Employee Import
- หน้า Employee Management, Leave, Routine และ Stock อาศัย layout/feature/API guards เป็นหลัก; การเห็นหรือไม่เห็น tab/button ไม่ใช่ server authorization

### 3.4 LIFF

requireLiffWorkforceSession():

- ไม่มีหรือ verify LIFF session ไม่ผ่าน: 401
- configuration verification failure: 500
- account inactive/deleted หรือ Employee ไม่ active/deleted: 403
- current LINE link ไม่ตรงกับ claim: 401
- re-read DB failure ตอนตรวจ link: 500
- สำเร็จเมื่อ account active, Employee active และ LINE identity ปัจจุบันตรงกัน

getLiffCapabilities() คืนค่า:

| Capability projection | Current source |
|---|---|
| canRequestStock | true สำหรับ LIFF workforce session ที่ผ่าน |
| canProcessStockRequests | isAdminRole(session.user.role) |
| canRequestLeave | FEATURE_KEYS.leave |
| canApproveLeave | getLiffLeaveCapabilities(employeeId) เมื่อ Leave เปิด; เป็น actionable effective-approver query |
| canCreateOwnRoutine | FEATURE_KEYS.routine |

ค่าเหล่านี้ใช้ home/UI projection; route ที่ทำ mutation ยังตรวจ session, role, relationship และ workflow เอง

## 4. Current Authorization Matrix

ตารางต่อไปนี้ใช้ field เดียวกันทุก domain โดย `Channel` ในตารางหมายถึง entry-point / transport surface ของ current implementation; ไม่ใช่ future `AuthorizationActor.channel`:

Module / Domain, Channel, Entry Point / Operation, Resource, Authentication Requirement, Account / Workforce Lifecycle Requirement, Current Authorization Rule, System Role Dependency, Resource / Domain Relationship, Current Effective Scope Semantics, Feature Flag Dependency, Enforcement Location, Presentation Projection, Unauthorized Outcome, Relevant Tests และ Migration Invariant / Notes

### 4.1 Cross-cutting guards and Dashboard

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cross-cutting API | API | Any route using requireApiSession() | User/account plus current workforce eligibility | Hybrid access cookie and authenticated account | Account active/not deleted; eligible Employee active/not deleted through legacy adapter | Authentication/workforce gate only; no role grant by itself | None | None | Actor identity only | None | lib/auth/api.ts, lib/auth/server.ts, modules/auth/application/account-identity.ts, modules/employee/infrastructure/persistence/employee-queries.ts | None | Default 401; caller may override | __tests__/api/hybrid-auth-routes.test.ts, __tests__/auth/workforce.test.ts | Preserve legacy API Employee eligibility until an explicit contract change |
| Cross-cutting API | API | Any route using requireAdminSession() | Admin operation selected by caller | Same as requireApiSession() | Same as API session | isAdminRole(role) must be true | ADMIN | Domain rules remain with caller/service | Usually all only where domain route allows | Caller-specific | lib/auth/api.ts | Admin menu/route hints are separate | Default non-admin 403; custom factories may collapse unauthenticated to 403 | __tests__/api/hybrid-auth-routes.test.ts, route-specific tests | Do not treat Admin as business/workflow bypass |
| Cross-cutting workforce | API | requireActiveWorkforceSession() | Current Employee identity | API session | User active/not deleted; Employee exists, ACTIVE, not deleted | Active workforce gate; no broad resource grant | None | Current User-to-Employee link | Current Employee only | None | lib/auth/workforce.ts | Current-user name projection | Missing profile 404 by default; inactive/deleted 403; unauthenticated normally 401 | __tests__/auth/workforce.test.ts, __tests__/auth/workforce-transaction.test.ts | Transaction variants must remain fail-closed |
| Dashboard | DASHBOARD | Shared /dashboard layout | Dashboard session | Hybrid access cookie resolved by getCurrentUserProjection() | Account active/not deleted and current Employee lifecycle eligible | Authenticated current workforce can enter shared shell; no Admin requirement in layout | None at layout | Current Employee projection | Current Employee only | None | app/dashboard/layout.tsx, app/_lib/auth/current-user.ts | DashboardProvider receives role and leave projections | Missing projection redirects to /login | __tests__/auth/current-user-projection.test.ts, __tests__/lib/dashboard-routes.test.ts | Shared layout protection is not equivalent to per-page Admin authorization |
| Dashboard | DASHBOARD | Audit, Email Request, Employee New, Employee Import pages | Admin-only page | Shared Dashboard session | Current active Employee projection | requireDashboardAdmin() requires Admin role | ADMIN | None beyond current workforce | Page access all Admin dashboard scope | Audit/Leave/Routine feature behavior is separate | app/dashboard/_lib/route-access.ts and four page files under app/dashboard/** | Menu hides links for USER | USER redirects /access-denied; absent user /login | __tests__/lib/dashboard-routes.test.ts, route tests | Direct API guards remain mandatory |
| Dashboard | DASHBOARD | Employee Management page | Employee list/stats UI | Shared Dashboard session | Current active Employee projection | Page itself has no requireDashboardAdmin; UI is available to USER | No page role gate | API list/stats are also authenticated-only | Current implementation presents organization-wide list/stats | None | app/dashboard/employees/page.tsx, modules/employee/presentation/dashboard/EmployeeManagementSection.tsx | USER sees read UI; Admin sees edit/add/import controls | UI access is not proof of API mutation/read authorization | modules/employee/presentation/dashboard/EmployeeTable.test.tsx, __tests__/api/employees-routes.test.ts | Freeze distinction between page visibility and API authority |
| Dashboard | DASHBOARD | Leave, Routine, Stock pages and tabs | Domain UI | Shared Dashboard session | Current active Employee projection | Page-level role gates are not the authoritative domain decision; feature and API routes decide | Domain-specific | Domain-specific | UI chooses default/self/admin tabs from projection | Leave/Routine flags | app/dashboard/leave/page.tsx, app/dashboard/routine/page.tsx, app/dashboard/stock/page.tsx and domain presentations | Leave canApproveLeave/canViewLeaveReports; stock/routine isAdmin; feature hides | UI hidden/redirect can differ from direct API result | Domain route/presentation tests | Never document hidden UI as server enforcement |
| Dashboard | DASHBOARD | Sidebar/menu click | Menu item | Already in authenticated shell | Current projection | requiredRole = ADMIN and feature checks are client-side navigation checks | ADMIN for configured items | None | No resource scope; menu visibility only | getAvailableMenuGroups() applies flags | constants/dashboard.ts, components/dashboard/context/dashboard/DashboardProvider.tsx | Hidden menu or client /access-denied push | Hidden or client redirect only | __tests__/constants/dashboard-menu.test.ts, __tests__/context/DashboardProvider.test.tsx | Presentation-only; direct navigation/API must still be tested |

### 4.2 Employee, Department and account-adjacent operations

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Employee | API | GET /api/employees | Employee records | requireApiSession() | Legacy eligible active Employee | Any eligible API user may call; no Admin check | None | Query excludes deletedAt != null and configured bootstrap-admin emails | Organization-wide non-deleted list; optional status/search/pagination | None | app/api/employees/route.ts, modules/employee/infrastructure/persistence/employee-queries.ts:listEmployees | Employee page labels read vs edit controls | Default/custom 401; query errors 500 | __tests__/api/employees-routes.test.ts, modules/employee/infrastructure/persistence/employee-queries.test.ts | Current broad read access is a Phase 1 policy decision, not inferred from UI |
| Employee | API | GET /api/employees/stats | Employee aggregates | requireApiSession() | Legacy eligible active Employee | Any eligible API user may call | None | Counts are organization-wide; implementation counts status/admin/academic buckets without the list query's deleted/bootstrap filter | All persisted Employee counts as implemented | None | app/api/employees/stats/route.ts, getEmployeeStats | Stats cards shown in Employee UI | 401 or 500 | No direct route test found; modules/employee/infrastructure/persistence/employee-queries.test.ts | Verify whether aggregate PII/HR visibility is intended before capability mapping |
| Employee | API | GET /api/employees/export | Employee CSV | requireApiSession() | Legacy eligible active Employee | Any eligible API user may trigger export | None | createEmployeeWhereClause: non-deleted, excludes bootstrap-admin emails, optional status/search | Organization-wide filtered Employee export; no actor ownership scope | None | app/api/employees/export/route.ts, modules/employee/infrastructure/export/employee-export.ts | Export controls are shown/hidden by UI role conventions | 401, validation/limit 400, service error 500 | modules/employee/infrastructure/export/employee-export.test.ts | High-risk broad export surface; do not silently change in Phase 0 |
| Employee | API | POST /api/employees, PATCH /api/employees/:id, DELETE /api/employees/:id, POST /api/employees/import | Employee lifecycle/data | requireAdminSession() | API eligible active Employee; mutation service rechecks transaction state | Admin route guard plus lifecycle service | ADMIN | Locks User/Employee; blocks self-offboarding, last active Admin removal, subordinate/Leave dependencies; account lifecycle may deactivate/revoke auth | Admin may target selected Employee; no Team/Department authorization | None | Routes under app/api/employees/**, modules/employee/application/mutations.ts, Auth lifecycle port | Admin form/import controls | Non-admin 403; validation/domain conflicts 400/409; missing target 404 | __tests__/api/employees-routes.test.ts, modules/employee/application/mutations.test.ts, modules/employee/schemas/employee.test.ts | Preserve data-integrity and lifecycle constraints separately from role check |
| Department | API | GET /api/departments | Department reference data | requireApiSession() | Legacy eligible active Employee | Any eligible API user; no role or relationship scope | None | Organization-wide department reference list | All departments returned | None | app/api/departments/route.ts, modules/department/application/queries.ts | Used by forms/import selectors | Caller intentionally maps missing auth to 403; otherwise 500 | __tests__/api/departments-route.test.ts | Department is HR/reference data, not authorization input |
| Account lifecycle | API | /api/auth/me, session listing/revoke/logout and account-link routes | User/account/session or linked LINE identity | Auth-specific access/refresh/CSRF/LINE verification | Current-user projection requires active Employee; session management is User-self scoped; account-link requires active workforce | These are authentication/account identity or self-management boundaries, not new domain permissions | Role not used for generic session self-management | Session operations target authenticated User's own records; account-link targets current User | OWN/self account/session | None | app/api/auth/**, app/api/line/account-link/route.ts, modules/auth/**, lib/auth/** | Auth status and session management UI | Mostly 401, validation 400, self-target not found/forbidden per route | __tests__/api/hybrid-auth-routes.test.ts, __tests__/auth/current-user-projection.test.ts, __tests__/integration/auth-session-concurrency.integration.test.ts | Out of Phase 0 authorization migration; preserve identity/session behavior |

### 4.3 Routine

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Routine | API | GET /api/routines/tasks | Active/inactive RoutineTask management list | requireActiveWorkforceOrAdminSession() | API legacy eligibility; service transaction rules for mutations | Admin sees all through buildRoutineTaskAccessWhere; USER sees tasks created by actor OR assigned to actor's active Employee | ADMIN outside LIFF self-service | createdById or current active task assignee for USER | Current task-management query is creator-or-current-task-assignee, not simply “mine” | routineFeatureGuard() | app/api/routines/tasks/route.ts, modules/routine/application/queries.ts:buildRoutineTaskAccessWhere | canEdit, canDelete; source metadata redacted for USER | Feature disabled 404; malformed 400; unauthorized from workforce helper | __tests__/api/routines-tasks.test.ts, modules/routine/application/queries.test.ts | Keep task-management scope distinct from operational work-item scope |
| Routine | API | GET /api/routines/tasks/:id | RoutineTask detail and occurrences | requireActiveWorkforceOrAdminSession() | Active workforce/admin actor checks | Admin all; USER creator or active current task assignee | ADMIN outside LIFF self-service | Creator/current task assignee; inactive/deleted assignee does not qualify | Single resource filtered by relationship; source metadata redacted for USER | Routine flag | app/api/routines/tasks/[id]/route.ts, getRoutineTaskById | canEdit/canDelete, redacted source fields | Unauthorized relation is domain not-found/error response | __tests__/api/routines-task-by-id.test.ts, modules/routine/application/queries.test.ts | Do not turn capability booleans into a substitute for query scope |
| Routine | API | POST /api/routines/tasks | New RoutineTask | requireActiveWorkforceOrAdminSession() plus body/idempotency/rate guards | Transaction validates active User; normal USER needs active Employee; Admin branch checks User and optional Employee state | Admin may submit supplied assignment/reference data; USER input is normalized to actor as OWNER and source metadata is removed | ADMIN outside LIFF self-service | USER ownership is actor; referenced assignees must be active | Created task is actor-owned for normal user; Admin can choose assignees | Routine flag | Route plus createRoutineTask and assertActiveRoutineActorInTransaction | UI offers own routine projection | 401/403, validation 400, domain conflict 409 | __tests__/api/routines-tasks.test.ts, modules/routine/application/mutations.test.ts | Preserve self-service normalization and idempotency |
| Routine | API | PATCH /api/routines/tasks/:id | RoutineTask fields | Workforce/admin helper, validation and rate guard | Transaction locks/rechecks active actor and references | Admin all fields; creator may edit/delete-related lifecycle; active assignee may edit content but cannot change assignees/source/lifecycle | ADMIN outside LIFF self-service | Creator vs current active task assignee; assignee is not equivalent to creator | Creator: edit plus lifecycle; assignee: content edit only; inactive/deleted assignee denied | Routine flag | updateRoutineTask, buildRoutineTaskEditScope, mutation transaction | Edit action flags | Relation/state errors via Routine error mapping, commonly 403/404/409 | __tests__/api/routines-task-by-id.test.ts, modules/routine/application/mutations.test.ts, modules/routine/application/queries.test.ts | Critical creator/assignee distinction |
| Routine | API | DELETE /api/routines/tasks/:id | RoutineTask | Workforce/admin helper | Transaction active actor | Admin can delete; USER only creator can delete | ADMIN outside LIFF self-service | Current assignee who is not creator cannot delete | CREATED_BY_ACTOR for USER; all for Admin | Routine flag | deleteRoutineTask, buildRoutineTaskDeleteScope | Delete button based on canDelete | 403/404/409 domain mapping | modules/routine/application/delete.test.ts, __tests__/api/routines-task-by-id.test.ts | Preserve creator-only USER delete |
| Routine | API | GET /api/routines/occurrences and GET /api/routines/occurrences/:id | RoutineOccurrence | Workforce/admin helper | Active User/Employee context; active task required | Admin default all or explicit mine; USER occurrence list/detail only current occurrence assignee | ADMIN outside LIFF self-service | Occurrence-level assignee, which can differ from task-level assignment | ALL, MINE, or explicit Admin assignee filter; USER forced mine in occurrence builder | Routine flag | getRoutineOccurrences, getRoutineOccurrenceById, buildWorkOccurrenceWhere | Occurrence list/detail and focus links | Feature 404, relation not-found 404, validation 400 | __tests__/api/routines-occurrences.test.ts, __tests__/api/routines-occurrence-by-id.test.ts, modules/routine/application/queries.test.ts | Distinguish task assignee from occurrence assignee |
| Routine | API | GET /api/routines/occurrences?view=tasks | RoutineTask operational work items | Workforce/admin helper | Active context from route; query itself uses supplied actor/employee | getRoutineTaskWorkItems builds buildTaskWhere; scope != all filters current assignee, but scope=all with no assignee returns { isActive: true } regardless of role | No role gate inside this query path | Current task assignee only when mine; focused occurrence has additional checks | Current implementation allows all active tasks for USER all-scope; focus path can allow occurrence-only assignment | Routine flag | app/api/routines/occurrences/route.ts, modules/routine/application/queries.ts:getRoutineTaskWorkItems | Operational task cards and per-task capabilities | Route accepts valid scope; no authorization error for USER all-scope | modules/routine/application/queries.test.ts test “returns all active tasks for a regular user's all-task scope” | High-risk current behavior; preserve only until explicit policy decision |
| Routine | API | GET /api/routines/summary | Routine KPI counts | Workforce/admin helper | Active context from route | Default route scope is mine; route accepts scope=all for USER and service builds unscoped active-task query | No role gate for supplied all scope | Task assignee scope only when mine | MINE default; ALL accepted for USER and Admin | Routine flag | app/api/routines/summary/route.ts, getRoutineSummary | KPI cards | Feature 404, invalid scope 400 | __tests__/api/routine-summary.test.ts, modules/routine/application/queries.test.ts | Existing all-scope USER behavior is explicitly tested |
| Routine | API | GET /api/routines/reference | Units, categories, employee assignment references | Workforce/admin helper | Current API context | Admin receives all active Employees; USER receives only own active Employee | ADMIN outside LIFF self-service | Own Employee vs all active Employees | Reference scope is self vs all; units/categories are shared active references | Routine flag | app/api/routines/reference/route.ts, getRoutineReferenceData | Assignee selector | Feature/auth/domain errors | __tests__/api/routines-reference.test.ts, modules/routine/application/queries.test.ts | No Department-to-permission derivation |
| Routine | API | GET /api/routines/export | RoutineTask XLSX | Workforce/admin helper | Current API helper plus export query actor | Route calls prepareRoutineTaskExport; exporter forces scope=all on every page | No route role check beyond helper | getRoutineTaskWorkItems all-scope path is used | All active operational task work items as currently queried, including USER path | Routine flag | app/api/routines/export/route.ts, modules/routine/infrastructure/reports/routine-export.ts | Export button is presentation | 401, invalid/limit 400, service error via Routine mapping | __tests__/api/routine-export.test.ts, modules/routine/infrastructure/reports/routine-export.test.ts | High-risk broad export; existing test freezes USER 200 and all-scope call |
| Routine | API | Routine occurrence due-date/assignee/override mutations | Occurrence and occurrence assignees | requireAdminSession() plus validation/rate guard | assertActiveAdminInTransaction; target Employees must active | Admin only | ADMIN | Active target assignees; row/version/reminder locks | Admin all selected occurrences | Routine flag | app/api/routines/occurrences/[id]/**, updateRoutineOccurrenceOverride, updateRoutineOccurrenceDueDate, reassignRoutineOccurrence | Admin occurrence controls | Non-admin 403; validation/state/concurrency 400/409 | __tests__/api/routines-occurrence-by-id.test.ts, __tests__/api/routines-legacy-occurrence-mutations.test.ts, modules/routine/application/mutations.test.ts | Role gate and active target/business invariants both required |
| Routine | API | Routine import preview/batches/rows/apply/cancel/reference | Import batch and staged RoutineTasks | requireAdminSession() | Active Admin transaction and active referenced Employees | Admin-only at every import route and service transaction | ADMIN | Batch/row ownership is not a normal USER scope | All import rows under Admin operation | Routine flag | app/api/routines/imports/**, assertActiveAdminInTransaction | Admin Import UI | Non-admin 403; validation/state 400/409 | __tests__/api/routine-import-preview.test.ts, __tests__/integration/routine-import-apply.integration.test.ts | Preserve staged import transactional behavior |
| Routine | LIFF_SELF_SERVICE | LIFF task list/create/detail/update/delete | RoutineTask and relevant occurrence | requireLiffWorkforceSession() | Active linked LINE workforce | Actor mode explicitly LIFF_SELF_SERVICE; Admin is not elevated for task relationship/capabilities | Admin role intentionally constrained by mode | Creator, current active task assignee, or active occurrence-only assignee for detail; create forces linked Employee OWNER | Task list/summary forced MINE; creator/assignee relationship for detail; creator delete; assignee content edit | Routine LIFF flag; disabled 404 | app/api/line/routine/tasks/**, modules/routine/application/authorization.ts:isRoutineAdminActor, getLiffRoutineTaskById | canCreateOwnRoutine, serialized self-service fields/actions | LIFF session 401/403/500; relation/domain errors 403/404/409 | __tests__/api/line-routine-routes.test.ts, __tests__/api/line-routine-self-service-routes.test.ts, modules/routine/application/mutations.test.ts | Critical channel-aware Admin invariant |
| Routine | LIFF_SELF_SERVICE | LIFF reference route | Active Employee reference data | LIFF workforce session | Active linked LINE workforce | Route creates actor without explicit mode LIFF_SELF_SERVICE; getRoutineReferenceData may therefore take the Admin branch and query all active Employees, but serializeLiffRoutineReference removes employees from the response | ADMIN affects the internal query branch only; no employee list is serialized to the LIFF client | Internal query: USER own active Employee vs Admin all active Employees; client-visible response omits employees for both | Client-visible reference response contains units, categories, scheduleTypes and businessDayPolicies only | Routine LIFF flag | app/api/line/routine/reference/route.ts, getRoutineReferenceData, modules/routine/server/liff-serialization.ts:serializeLiffRoutineReference | serializeLiffRoutineReference | LIFF/auth/feature errors | __tests__/api/line-routine-self-service-routes.test.ts | Preserve the no-employee-list response boundary; broader internal query is a channel-context/least-data-access risk, not a compatibility behavior to preserve |

### 4.4 Stock

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Stock | API | GET /api/stock/items, GET /api/stock/categories | Active/catalog StockItem, Variant, Category | requireActiveWorkforceOrAdminSession() | Current API legacy eligibility; catalog query filters active only where route asks | Any active workforce/admin may read catalog | None for read | No requester relationship; catalog-wide | All catalog rows matching filters | None | Routes plus modules/stock/application/queries/queries.ts:getItems/getCategories | Dashboard browse UI | Auth 401/403 as helper returns; validation 400; query 500 | __tests__/api/stock-items-route.test.ts, modules/stock/__tests__/queries.test.ts | Catalog visibility is not request visibility |
| Stock | API | POST /api/stock/items, item PATCH/DELETE, category POST/DELETE, stock adjust | Inventory configuration and quantities | Admin guard; adjust also rate/body guards | Admin API session; domain transaction/concurrency checks | Admin only | ADMIN | Active variants, pending requests, non-negative/concurrency/foreign-key rules | Admin all selected inventory records | None | app/api/stock/items/**, app/api/stock/categories/route.ts, app/api/stock/items/[id]/adjust/route.ts, stock mutation services | Admin inventory tabs/buttons | Non-admin 403; validation/domain conflict 400/404/409 | __tests__/api/stock-items-route.test.ts, modules/stock/__tests__/mutations.test.ts | Keep inventory integrity separate from role authorization |
| Stock | API | GET /api/stock/requests | StockRequest list | requireActiveWorkforceOrAdminSession() | Current API helper; requester create path requires active workforce | getRequests uses all only when isAdmin && scope=all; otherwise requestedBy = userId | ADMIN required for all list | Requester ownership | USER effective scope is own; Admin may request all or mine | None | app/api/stock/requests/route.ts, modules/stock/application/queries/queries.ts:getRequests | Dashboard request tabs/filters | Invalid filters 400; auth helper result | __tests__/api/stock-requests-routes.test.ts, modules/stock/__tests__/queries.test.ts | Do not infer all from client-supplied scope alone; service also checks role boolean |
| Stock | API | POST /api/stock/requests | New StockRequest | Size/idempotency/rate guards then requireActiveWorkforceSession() | Active User/Employee rechecked in transaction | Any active workforce can request; service sets requestedBy = actor.id and ignores client ownership | No Admin requirement; Admin can also request if active workforce | Requester is actor; item/variant availability and pending reservations validated | OWN/requested-by-current-user | None | Route plus createRequest, assertActiveWorkforceInTransaction | Request cart/form | 401/403, invalid 400, availability/conflict 409 | __tests__/api/stock-requests-routes.test.ts, modules/stock/__tests__/mutations.test.ts | Preserve requester attribution, idempotency and inventory checks |
| Stock | API | POST /api/stock/requests/:id/cancel | Pending StockRequest | Workforce/admin helper plus body/rate guards | Non-admin transaction rechecks active workforce; Admin route helper applies current API contract | USER may cancel own pending request; Admin may cancel any pending request | ADMIN broad cancel branch | requestedBy for USER; pending status for all | OWN pending for USER; ALL pending for Admin | None | Route, executeCancelStockRequest, cancelRequest | Cancel action from request cards | Relation 403; absent 404; invalid state 409 | __tests__/api/stock-requests-routes.test.ts, modules/stock/__tests__/mutations.test.ts | Status transition and audit/outbox remain domain invariants |
| Stock | API | POST /api/stock/requests/:id/review, /issue | StockRequest processing | requireAdminSession() plus body/rate/id validation | Admin API session; issue transaction validates stock/request state | Admin can issue or reject/cancel; review route is compatibility action router | ADMIN | Pending request, active item/variant, sufficient stock, atomic claim | All pending requests | None | app/api/stock/requests/[id]/review/route.ts, [id]/issue/route.ts, executeIssueStockRequest, executeCancelStockRequest | Admin processor/review controls | Non-admin 403; state/stock errors 400/409; missing 404 | __tests__/api/stock-requests-routes.test.ts, modules/stock/__tests__/mutations.test.ts | Service issue command trusts route role boundary; do not assume service is standalone authorization |
| Stock | API | GET /api/stock/reports/export | Stock balances and request report | requireAdminSession() | API current eligible active Employee | Admin only | ADMIN | Report is organization-wide stock/request data | ALL | None | app/api/stock/reports/export/route.ts, stock report infrastructure | Admin report controls | Non-admin 403; query/limit 400; service errors | __tests__/api/stock-reports-export-route.test.ts, modules/stock/__tests__/report-export.test.ts | Preserve explicit Admin report boundary |
| Stock | LIFF_SELF_SERVICE | LIFF catalog, availability and requester list/create | Stock catalog, availability, own requests | requireLiffWorkforceSession() | Active linked LINE workforce | Any LIFF workforce may browse/request; list is forced isAdmin=false, scope=mine | No processor role for requester paths | requestedBy is current LIFF User; detail is own unless Admin processor | OWN requests; all active catalog/availability | None | app/api/line/stock/items/**, availability, requests/route.ts, stock queries | canRequestStock: true, requester actions | LIFF 401/403/500; invalid 400; domain 404/409 | __tests__/api/line-stock-routes.test.ts, modules/stock/__tests__/liff-app.test.tsx | LIFF requester behavior is not the processor behavior |
| Stock | LIFF_SELF_SERVICE | LIFF request detail/cancel | StockRequest | LIFF workforce session | Active linked LINE workforce | Admin can view/cancel any matching request; USER can view/cancel own; unrelated detail returns not-found style response | ADMIN processor branch | requestedBy for USER; pending status for cancel | OWN for USER; ALL for Admin | None | app/api/line/stock/requests/[id]/**, getRequestById, cancel command | Requester vs Processor serialized role/actions | Unrelated 404; relation 403 on action; state 409 | __tests__/api/line-stock-routes.test.ts | Preserve 404 hiding for unrelated LIFF detail |
| Stock | LIFF_SELF_SERVICE | LIFF processing queue and issue | Pending StockRequest | requireLiffStockProcessorSession() | LIFF active workforce plus Admin role | Only Admin may access queue or issue; queue calls getRequests(..., true, all) | ADMIN | Pending status and atomic inventory rules | ALL pending requests | None | modules/stock/presentation/liff-stock-auth.ts, app/api/line/stock/processing/route.ts, issue route | canProcessStockRequests controls tab | Non-admin 403; auth 401/403/500; state errors 404/409 | __tests__/api/line-stock-routes.test.ts, modules/stock/__tests__/mutations.test.ts | Capability boolean is hint; processor route is authority |

### 4.5 Leave

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Leave | API | POST /api/leave/request | New LeaveRequest | Feature, pre-auth/body/rate guards then requireActiveWorkforceSession() | Active User/Employee; transaction checks manager and approver eligibility | Current Employee may create own request; manager must exist and be active leave approver with usable email | No Admin bypass needed | Employee owner is actor; overlap, quota, working-day, special-reason and idempotency rules | OWN/current Employee | FEATURE_KEYS.leave; disabled 404 | Route, createLeaveRequest, request transaction | Request form visible from Leave UI | Unauthenticated/workforce 401/403/404; validation 400; business 409 | __tests__/api/leave-request.test.ts, modules/leave/application/requests/** tests | Preserve manager/approver and quota rules outside generic auth |
| Leave | API | GET /api/leave/me | Current Employee leave profile/history/quota | requireActiveWorkforceSession() | Active User/Employee | Query receives only auth.employeeId; no client employee ID | None | Self current Employee | OWN/current Employee; history/query filters operate inside own profile | Leave flag | app/api/leave/me/route.ts, modules/leave/application/queries/profile-queries.ts | My leave tab | 401/403/404; invalid page/filter 400 | __tests__/api/leave-me.test.ts, modules/leave/application/queries/active-employee-session.test.ts | Keep self scope server-derived |
| Leave | API | GET /api/leave/approvals | Actionable/history/cancellation approval list | requireActiveWorkforceSession() | Active User/Employee | No role gate in route; query scopes to managerId = auth.employeeId via effective approver relationship | No broad Admin bypass | Employee is effective approver: exception approver takes precedence, otherwise original approver; owner excluded | ASSIGNED_APPROVER; actionable states plus assigned history | Leave flag | app/api/leave/approvals/route.ts, getLeaveApprovalList, getAssignedLeaveApproverWhere | canApproveLeave; approval tab | Auth 401/403; invalid page/filter 400; query 500 | __tests__/api/leave-approvals.test.ts, modules/leave/application/approvals/approval-queries.test.ts | managerId parameter is historical naming, not proof of manager-only policy |
| Leave | API | POST /api/leave/decision | Pending LeaveRequest approve/reject | requireActiveWorkforceSession() plus schema/rate/body guards | Transaction requires active actor Employee | decideLeaveRequest requires ASSIGNED_APPROVER; owner, unrelated User and Admin not assigned are forbidden | No role bypass; function passes isAdmin=false | Effective approver assignment; owner cannot approve own request | ASSIGNED_APPROVER only; PENDING state | Leave flag | app/api/leave/decision/route.ts, modules/leave/application/approvals/decision.ts | Approval action buttons | 403 unauthorized; 404 missing; 409 already processed/quota/special-reason | __tests__/api/leave-decision.test.ts, modules/leave/application/approvals/exception-approver.test.ts | Important: ADMIN is not universal approval authority here |
| Leave | API | POST /api/leave/cancel | Own LeaveRequest cancellation request | requireActiveWorkforceSession() | Active User/Employee | cancelLeaveRequest permits only request owner and valid state/date | No Admin branch for owner request | employeeId = actor.employeeId | OWN; PENDING may cancel directly, APPROVED before start becomes cancellation requested | Leave flag | app/api/leave/cancel/route.ts, cancellation application | My leave cancel action | Owner/status/date domain errors 403/404/409 | __tests__/api/leave-cancel.test.ts, Leave cancellation integration tests | Preserve owner and state transition invariants |
| Leave | API | PUT /api/leave/cancel | Cancellation decision | Active workforce plus schema/rate guards | Transaction verifies active actor | Assigned effective approver may confirm/reject; Admin may use override only when effective approver is unavailable and reason is supplied; owner forbidden | ADMIN only for unavailable-approver override | Effective approver; owner excluded; pre-start required for confirmation | ASSIGNED_APPROVER normally; ADMIN_OVERRIDE recovery scope when unavailable | Leave flag | getCancellationDecisionRequest, confirmLeaveCancellation, rejectLeaveCancellation | Dashboard dialog/actions | 403 relation; 409 status/date; override reason missing 400 | __tests__/api/leave-cancel.test.ts, modules/leave/application/approvals/exception-approver.test.ts | Dashboard/API override differs from LIFF |
| Leave | API | POST /api/leave/not-taken | Request not-taken confirmation workflow | Active workforce plus feature/body/rate guards | Active actor Employee; approved and after end date | Owner may request not-taken; only effective approver confirms normally; Admin override permitted when effective approver unavailable with reason | ADMIN only with allowAdminOverride: true | Owner, effective approver, fallback approver, unavailable approver state | OWN for request; ASSIGNED_APPROVER or recovery Admin for confirmation | Leave flag | app/api/leave/not-taken/route.ts, modules/leave/application/not-taken.ts, exception approver resolver | Not-taken actions and Admin recovery dialog | 403/404/409; override reason 400 | __tests__/api/leave-not-taken.test.ts, modules/leave/application/approvals/exception-approver.test.ts | Preserve quota/status/audit and fallback approver rules |
| Leave | API | GET /api/leave/admin/recovery | Recovery candidate list | requireActiveWorkforceSession() then explicit Admin check | Active User/Employee | Admin only; returns requests whose effective approver is unavailable and excludes work assigned to current Admin | ADMIN | Unavailable original/effective approver; owner/current assignment excluded | Recovery subset, not normal approval workload | Leave flag | app/api/leave/admin/recovery/route.ts, getAdminLeaveRecoveryData, getAdminLeaveRecoveryCandidateWhere | Admin Recovery tab shown by role | Non-admin 403; feature 404; invalid page 400 | __tests__/api/leave-admin-recovery.test.ts, modules/leave/application/approvals/approval-queries.test.ts | Recovery scope is intentionally narrower than Admin-all |
| Leave | API | GET/PUT /api/leave/approvers | Leave manager/approver assignment | requireAdminSession(); GET maps unauthenticated to 403 | API legacy eligible active Employee | Admin only; assignment service validates active target/user, usable email, no self-assignment, pending-request lock | ADMIN | Employee hierarchy/manager relation and pending Leave dependencies | Admin can manage selected assignments; not a generic team grant | Leave flag | app/api/leave/approvers/route.ts, assignLeaveApprovers | Approver settings tab shown to Admin | 403; validation/domain 400/409 | __tests__/api/leave-approvers.test.ts, modules/leave/application/approvals/approver-assignment.test.ts | Manager assignment is a Leave-owned relationship/business rule |
| Leave | API | GET /api/leave/export | Leave report XLSX/meta/years | requireActiveWorkforceSession() | Active User/Employee | No explicit role or canViewLeaveReports check; scope is selected by route and query | None | current-team: direct active Employees with managerId = currentEmployeeId; approver-history: original approverId = currentEmployeeId | Current team or original approver history; exception approver is not counted by history scope | Leave flag | app/api/leave/export/route.ts, modules/leave/infrastructure/reports/report-export.ts | canViewLeaveReports hides report tab only | Auth 401/403; invalid scope/year/format/limit 400; errors 500 | __tests__/api/leave-export.test.ts, modules/leave/infrastructure/reports/report-export.test.ts | Projection and endpoint authority differ; report scope needs Phase 1 policy decision |
| Leave | API | GET /api/leave/attachments/:attachmentId | Leave evidence attachment | Workforce-or-admin helper plus ID validation | Current API legacy eligibility; active workforce/admin helper | Admin bypasses resource relationship; USER must be owner, original approver or exception approver according to dashboard query | ADMIN relationship bypass | Leave owner/original/effective approver | PARTICIPANT or Admin ALL | Leave flag | app/api/leave/attachments/[attachmentId]/route.ts, getAuthorizedLeaveAttachmentForViewer | Attachment button/viewer | Unauthorized relation/missing storage 404; invalid content/storage 500 | __tests__/api/leave-attachment.test.ts, __tests__/integration/leave-attachment-access.integration.test.ts | Admin bypasses relationship, not active-account/API preconditions |
| Leave | LIFF_SELF_SERVICE | LIFF my leave/request/cancel/not-taken | Current Employee LeaveRequest | requireLiffWorkforceSession() and Leave feature | Active linked LINE workforce | Request/cancel are self owner operations; not-taken confirmation uses effective approver only because allowAdminOverride: false | Admin does not receive override in LIFF | Current Employee owner/effective approver | OWN or ASSIGNED_APPROVER; no Dashboard Admin recovery override | Leave LIFF flag; disabled 404 | app/api/line/leave/me, request, cancel, not-taken | canRequestLeave; available actions serialization | LIFF 401/403/500; relation/status 403/404/409 | __tests__/api/line-leave-routes.test.ts, __tests__/api/leave-me.test.ts, __tests__/api/leave-request.test.ts, __tests__/api/leave-cancel.test.ts, __tests__/api/leave-not-taken.test.ts | Explicit channel restriction: LIFF cannot use Admin override |
| Leave | LIFF_SELF_SERVICE | LIFF approvals and decision | Assigned LeaveRequest approval | LIFF workforce plus Leave feature | Active linked LINE workforce | Approval list is effective-approver scoped; decision service still requires assigned approver and passes no Admin override | No broad Admin bypass | Effective approver; owner excluded | ASSIGNED_APPROVER actionable only; history excluded from LIFF response | Leave LIFF flag | app/api/line/leave/approvals/route.ts, app/api/line/leave/decision/route.ts, Leave approval application | canApproveLeave and actionable work projection | 401/403/404/409 | __tests__/api/line-leave-routes.test.ts, modules/leave/application/approvals/approval-queries.test.ts | Preserve server relationship check regardless of capability boolean |
| Leave | LIFF_SELF_SERVICE | LIFF request detail/attachment | LeaveRequest/attachment participant view | LIFF workforce plus feature | Active linked LINE workforce | Owner or effective approver may view; unrelated caller receives not-found style response | Admin is not a blanket participant bypass in LIFF participant query | Owner/effective approver | PARTICIPANT only | Leave LIFF flag | app/api/line/leave/requests/[id]/route.ts, app/api/line/leave/attachments/[id]/route.ts, participant-access.ts | Serialized viewer role REQUESTER/APPROVER; internal IDs stripped | Unrelated 404; auth 401/403; storage 404/500 | __tests__/api/line-leave-routes.test.ts, __tests__/api/leave-attachment.test.ts | Preserve participant privacy and server-side serialization |

### 4.6 Audit, export, email request, settings and notifications

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Audit | API/DASHBOARD | GET /api/audit-logs, Dashboard Audit page | AuditLog records | Route uses requireAdminSession; page uses requireDashboardAdmin | API current eligible Employee; page current projection | Admin only; query itself is broad after route guard | ADMIN | No per-log resource scope at query layer | ALL audit logs with filters/pagination | None | app/api/audit-logs/route.ts, modules/audit/application/queries.ts, app/dashboard/audit/page.tsx | Admin audit viewer/menu | Both unauthenticated and non-admin are intentionally mapped to 403 in API route; page redirects | __tests__/api/audit-log-route.test.ts, modules/audit/application/queries.test.ts, modules/audit/presentation/dashboard/AuditLogsSection.test.tsx | Preserve audit privacy and route-level Admin guard |
| Audit export logging | API | POST /api/audit-logs/export | AuditLog data-export event | requireApiSession() with unauthenticated override to 403 | Legacy eligible active Employee | Any authenticated API user can submit entityType, recordCount, filters; route does not role-check or schema-validate body before scheduling audit | None | Audit actor is authenticated User; payload fields are caller-provided | No data read scope; writes a caller-attributed export event | None | app/api/audit-logs/export/route.ts, lib/server/audit.ts | Export UI may call it after data export | Unauthenticated 403; malformed/DB failure generally 500 | __tests__/api/authorization-current-state.test.ts | High-risk audit integrity/authorization boundary; actual data export routes have separate guards |
| Audit retention | SYSTEM | POST /api/audit-logs/cleanup | Expired AuditLog rows | x-cleanup-secret shared secret | System configuration only | Secret match; no User role | None | System-wide retention operation | ALL rows older than retention cutoff | None | app/api/audit-logs/cleanup/route.ts, audit retention application | None | Missing config 503; wrong secret 403; operation error 500 | __tests__/api/audit-log-cleanup-route.test.ts | System secret is separate from User authorization |
| Employee export | API | See Employee matrix | Employee CSV | requireApiSession() | Legacy eligible active Employee | Any eligible API user; export query is organization-wide filtered | None | No owner/team relation | ALL non-deleted non-bootstrap rows matching filters | None | Employee export route/infrastructure | UI export button may be role-shaped but API is authoritative | 401/400/500 as above | __tests__/api/authorization-current-state.test.ts, modules/employee/infrastructure/export/employee-export.test.ts | Requires explicit Phase 1 decision before narrowing or preserving |
| Routine export | API | See Routine matrix | RoutineTask XLSX | Workforce/admin helper | Current route helper | USER current implementation can export all operational task rows | No Admin gate in export route | No actor scope passed to exporter; all-scope query | ALL as currently implemented | Routine flag | Routine export route/infrastructure | UI export action | 401/400/500 | __tests__/api/routine-export.test.ts | Do not accidentally change during resolver migration |
| Stock export | API | See Stock matrix | Stock reports | requireAdminSession() | API current eligible Employee | Admin only | ADMIN | Organization-wide report | ALL | None | Stock report route | Admin report controls | Non-admin 403 | __tests__/api/stock-reports-export-route.test.ts | Explicit contrast with Employee/Routine/Leave exports |
| Leave export | API | See Leave matrix | Leave reports | requireActiveWorkforceSession() | Active Employee | Any active workforce with corresponding manager/original-approver relationship; no role route guard | None | Manager/current-team or original approver history | Relationship-derived subset | Leave flag | Leave report route/infrastructure | canViewLeaveReports is only visibility hint | Auth/domain/validation errors | __tests__/api/leave-export.test.ts | Capability projection is not endpoint authorization |
| Email Request | API/DASHBOARD | POST /api/email-request; GET /api/email-request | Employee email/request administration | POST requireAdminSession; GET requireApiSession | Legacy API eligibility | POST Admin-only; GET Admin sees all, USER query is restricted to requestedBy = user.id | ADMIN for create/all-read | Requester ownership for USER GET | USER OWN requests; Admin ALL | None | app/api/email-request/route.ts, lib/services/email-request/queries.ts | Admin page; history/provider projections | POST custom 403; GET 401 default/custom and query errors | __tests__/api/email-request.test.ts, __tests__/services/email-request/queries.test.ts, __tests__/services/email-request/mutations.test.ts | Preserve GET ownership query and Admin mutation guard |
| Settings | DASHBOARD/API | Routine settings tab and Leave approver settings | Configuration/assignment | Shared Dashboard plus route-specific APIs | Current projection/API session | No general settings API found; Routine settings UI is Admin-shaped; Leave approver settings is protected by Admin API | ADMIN in UI/Leave approver API | Leave assignment domain relationship | Configuration-specific; no generic scope | Routine/Leave flags as applicable | modules/routine/presentation/dashboard/RoutineSection.tsx, app/api/leave/approvers/route.ts | Tabs/buttons hidden for USER | UI hidden is not enough; approver API 403 | Routine/Leave presentation and route tests | Do not create settings.manage semantics from UI alone |
| Notifications | API/DASHBOARD | Latest/history/read/mark-all and Notification page | In-app Notification | requireApiSession() | Legacy eligible active Employee | User ID is always taken from authenticated session; commands/queries include userId in where | None | Notification owner is User | OWN/current User only | None | app/api/notifications/**, modules/notification/application/**, repository queries | Notification unread count/dropdown/history | Unauthenticated 401; invalid session 400; persistence 500 | __tests__/api/notifications.test.ts, modules/notification/application/queries.test.ts, modules/notification/application/commands.test.ts | Preserve self-scoped query/update behavior |

### 4.7 LIFF home, public/system and adjacent boundaries

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| LIFF home | LIFF_SELF_SERVICE | GET /api/line/home | Module availability and capability projection | requireLiffWorkforceSession() | Active linked LINE workforce | Returns module flags and capability booleans; does not itself grant operations | Admin only affects stock processor boolean | Leave approvals query is effective-approver/actionable work | Capability projection only | Leave/Routine flags; Stock always available | app/api/line/home/route.ts, modules/line/application/liff.ts, home.ts | Liff home cards/tabs | 401/403/500; disabled modules returned unavailable | __tests__/api/line-home-route.test.ts, __tests__/auth/liff-capabilities.test.ts, __tests__/components/LiffHome.test.tsx | Capability data is non-authoritative |
| Uploads | API | POST /api/uploads/image | Public stock item/variant image upload | requireAdminSession() | API current eligible active Employee | Admin only; validates scope and File | ADMIN | None beyond storage scope | Admin selected upload namespace | None | app/api/uploads/image/route.ts, local upload adapter | Admin inventory image controls | Non-admin 403; invalid file/scope 400 | __tests__/uploads/local.test.ts, stock route tests | Preserve upload role gate |
| Uploads | API/public GET | GET /api/uploads/[...path] | Public upload file | No User session; path is public by design | None | No role authorization; rejects private, traversal and unsafe segments | None | Public path safety only | Public files addressed by safe path | None | app/api/uploads/[...path]/route.ts | Public image rendering | Unsafe/missing 404 | __tests__/api/uploads-route.test.ts | Private Leave attachments use separate participant/Admin-authorized route |
| Notification worker | SYSTEM | POST /api/cron/notification-outbox | Outbox dispatch | x-outbox-secret shared secret | Secret/config only | Shared secret match | None | System-wide outbox | ALL queued outbox records | None | app/api/cron/notification-outbox/route.ts | None | Missing config 503; wrong secret 403; worker error 500 | __tests__/api/notification-outbox-cron.test.ts | System execution is not a User grant |
| Routine scheduler | SYSTEM | POST /api/cron/routine-scheduler | Routine occurrences/reminders | x-routine-secret shared secret | Secret/config only | Shared secret; feature-disabled returns successful empty result | None | System-wide scheduler | ALL eligible scheduled tasks | Routine flag | app/api/cron/routine-scheduler/route.ts, runRoutineScheduler | None | Missing config 503; wrong secret 403; errors 500 | __tests__/api/routine-scheduler-cron.test.ts | Feature flag changes system work, not user permission |
| Leave attachment cleanup | SYSTEM | POST /api/leave/attachments/cleanup | Orphaned attachment files | x-cleanup-secret shared secret | Secret/config only | Shared secret and dry-run validation | None | Orphan relation/storage cleanup | ALL orphan candidates | None | app/api/leave/attachments/cleanup/route.ts | None | Missing config 503; wrong secret 403; invalid dry-run 400 | __tests__/api/leave-attachment-cleanup-route.test.ts | System retention boundary |
| LINE webhook | SYSTEM | POST /api/line/webhook | LINE platform event | HMAC signature/channel secret | LINE configuration only | Signature verification; no User role | None | Platform event identity, not current User session | System event scope | None | app/api/line/webhook/route.ts, signature verifier | None | Missing/invalid signature 401; missing config 500 | __tests__/api/line-webhook-route.test.ts | Authentication/integration boundary, out of authorization migration |

## 5. Authorization Decision Inventory

### 5.1 System-level role checks

- lib/ssot/permissions.ts:isAdminRole เป็น helper กลางที่เปรียบเทียบ role กับ ADMIN; USER_ROLES มี ADMIN และ USER
- lib/auth/api.ts:requireAdminSession เป็น generic route guard ระดับ role แต่ไม่แทนที่ domain relationship/business checks
- app/dashboard/_lib/route-access.ts:requireDashboardAdmin เป็น redirect guard ของ Dashboard page
- constants/dashboard.ts และ DashboardProvider ใช้ requiredRole: ADMIN สำหรับ menu/click behavior เท่านั้น
- modules/stock/presentation/liff-stock-auth.ts:requireLiffStockProcessorSession แปลง LIFF workforce session ให้เป็น processor session โดย require Admin
- modules/routine/application/authorization.ts:isRoutineAdminActor ตัดสิน Admin ตาม role และ mode != LIFF_SELF_SERVICE
- Leave recovery และ approver assignment ใช้ isAdminRole ที่ route; Leave normal decision ไม่ใช้ role bypass
- Stock request list/cancel ใช้ Admin boolean ร่วมกับ requester ownership/status

### 5.2 Dashboard guards and projections

- Authentication/routing: middleware.ts
- Current workforce projection: app/_lib/auth/current-user.ts:getCurrentUserProjection
- Page Admin guards: app/dashboard/_lib/route-access.ts:requireDashboardAdmin
- Role/feature navigation: constants/dashboard.ts:getAvailableMenuGroups, components/dashboard/context/dashboard/DashboardProvider.tsx:handleMenuClick
- Leave presentation projections: modules/leave/application/approvals/approval-queries.ts:getCurrentEmployeeLeaveProjection, modules/leave/presentation/dashboard/LeaveManagementSection.tsx
- Employee UI action hints: modules/employee/presentation/dashboard/EmployeeTable.tsx, EmployeeManagementSection.tsx
- Stock UI role tabs: modules/stock/presentation/dashboard/context/StockProvider.tsx
- Routine UI Admin/settings/import behavior: modules/routine/presentation/dashboard/RoutineSection.tsx

### 5.3 API guards

ใน inventory นี้ `API` หมายถึง transport surface ของ route เท่านั้น ไม่ใช่ค่าใน future `AuthorizationActor.channel`; ต้องดูว่า caller/security context เป็น Dashboard, LIFF หรือ SYSTEM ก่อนกำหนด execution channel

- Generic session: lib/auth/api.ts:requireApiSession
- Admin role: lib/auth/api.ts:requireAdminSession
- Active Employee: lib/auth/workforce.ts:requireActiveWorkforceSession
- Workforce-or-Admin route compatibility: lib/auth/workforce.ts:requireActiveWorkforceOrAdminSession
- Transaction rechecks: lib/auth/workforce-transaction.ts:assertActiveWorkforceInTransaction, Routine active actor/admin assertions, Leave isActiveEmployeeInTransaction, Stock request transaction checks
- Domain routes must still parse/validate input, enforce rate/body/idempotency controls and validate state; those checks are not collapsed into authorization

### 5.4 LIFF guards and capability projections

- LIFF session and linked identity: modules/line/application/liff.ts:requireLiffWorkforceSession
- Active linked workforce identity: findActiveLiffWorkforceIdentity
- Home projection: getLiffCapabilities
- Stock processor role: requireLiffStockProcessorSession
- Routine channel mode: createLiffRoutineActor(..., { mode: LIFF_SELF_SERVICE })
- LIFF Routine reference exception: app/api/line/routine/reference/route.ts ไม่ส่ง mode ให้ createRoutineCommandActor(); getRoutineReferenceData() จึงอาจ query employee set แบบ Admin แต่ serializeLiffRoutineReference() ส่งออกเฉพาะ units, categories, scheduleTypes และ businessDayPolicies โดยไม่ส่ง employees
- Leave capability: getLiffLeaveCapabilities checks actionable assigned effective approver work, not role
- Leave/Routine/Stock LIFF routes independently enforce role/relationship/status after projection

### 5.5 Routine domain authorization

- isRoutineAdminActor: Admin is elevated only outside LIFF self-service
- buildRoutineTaskEditScope: Admin all; USER creator or current Employee task assignee
- buildRoutineTaskDeleteScope: Admin all; USER creator only
- resolveRoutineTaskCapabilities: creator edit/delete, active task assignee edit-only, unrelated/inactive/deleted assignee no access
- buildRoutineTaskAccessWhere: management list/detail scope
- buildWorkOccurrenceWhere: occurrence-level assignee scope; normal USER is mine even when requested all
- buildTaskAssigneeWhere and buildTaskWhere: operational task path permits unscoped all when scope=all, without role predicate
- buildLiffRoutineTaskAccessWhere: creator, current task assignee or occurrence-only assignee; active checks for assignment paths
- getRoutineReferenceData plus serializeLiffRoutineReference: internal Admin query branch on the LIFF reference route is not the client-visible response scope; the serializer omits employees
- Mutation transactions enforce active actor, active target Employees, version/reminder locks and creator-vs-assignee field restrictions

### 5.6 Stock domain authorization

- getRequests: shouldShowAll = isAdmin && scope === all; otherwise requestedBy = userId
- createRequest: transaction checks active workforce and sets requester from actor, not body
- cancelRequest: normal actor is rechecked and must own pending request; Admin option can cancel any pending request
- executeIssueStockRequest/issueRequest: atomic pending claim, active item/variant and stock invariants; route is the Admin boundary
- requireLiffStockProcessorSession: LIFF Admin-only processor route
- toLiffStockRequestDetail and action availability serialize requester/processor views but do not authorize by themselves

### 5.7 Leave domain authorization

- getAssignedLeaveApproverWhere: effective assignment is exception approver first, original approver otherwise; owner excluded
- getActionableLeaveApprovalWhere: PENDING, approved-not-taken pending confirmation and cancellation requested
- getLeaveDecisionAuthorization: OWNER, ASSIGNED_APPROVER, ADMIN_OVERRIDE or FORBIDDEN
- Normal decideLeaveRequest explicitly requires ASSIGNED_APPROVER with isAdmin=false
- Cancellation and not-taken flows permit Admin override only when caller enables it and effective approver is unavailable; override requires reason
- getAdminLeaveRecoveryCandidateWhere: only unavailable effective approver candidates and excludes Admin's assigned workload
- getCurrentEmployeeLeaveProjection and getLiffLeaveCapabilities: projections derived from actionable/history queries
- Report scope is implemented independently in report-export.ts; current-team uses current manager relation, approver-history uses original approver relation
- State/date/quota/overlap/approver email/assignment/concurrency constraints remain Leave domain/business rules

### 5.8 Employee, Audit, export and settings

- Employee mutations use Admin route guard plus Employee lifecycle transaction; offboarding calls Leave dependency provider and Auth account-lifecycle port
- Employee list/stats/export are currently authenticated-only and organization-wide according to query implementation
- Audit log read is Admin-only; audit export event endpoint is authenticated-only and accepts caller-provided event metadata
- Stock report export is Admin-only; Leave report export is active-workforce plus relationship scope; Routine and Employee exports are broad authenticated paths
- Leave approver settings is Admin-only; no generic settings authorization API was found
- Email Request POST is Admin-only; GET has Admin all vs USER requester-owned query scope

### 5.9 Resource/query authorization

Query and persistence scopes found include:

- createdById / creator scope in Routine
- current active task assignee and current occurrence assignee in Routine
- requestedBy requester scope in Stock
- current Employee self scope in Leave profile
- effective approver and original approver scopes in Leave
- manager direct-report scope in Leave current-team report
- owner/effective approver participant scope in Leave detail and attachments
- User-owned Notification scope in notification repository
- requestedBy scope in Email Request query
- organization-wide query with no actor scope in Employee list/stats/export, stock catalog, Admin reports and current Routine all-scope work-item/export paths

### 5.10 Classification ledger

เพื่อไม่ให้คำว่า “guard” กลบความหมายของแต่ละชั้น ตารางนี้จัดประเภท decision point สำคัญที่พบจาก call chain:

| Decision point | Classification |
|---|---|
| middleware.ts hybrid token check | AUTHENTICATION และ routing; ไม่ใช่ AUTHORIZATION ของ domain |
| resolveAuthenticatedAccount และ getApiAuthSession | AUTHENTICATION + ACCOUNT_LIFECYCLE |
| requireApiSession | AUTHENTICATION + ACCOUNT_LIFECYCLE |
| requireAdminSession และ isAdminRole | AUTHENTICATION + ACCOUNT_LIFECYCLE + AUTHORIZATION |
| requireActiveWorkforceSession และ requireActiveWorkforceOrAdminSession | AUTHENTICATION + ACCOUNT_LIFECYCLE; Admin branch มี AUTHORIZATION เฉพาะ route contract |
| assertActiveWorkforceInTransaction และ active User/Employee re-reads | ACCOUNT_LIFECYCLE + BUSINESS_RULE + DATA_INTEGRITY/CONCURRENCY |
| requireDashboardAdmin | AUTHENTICATION + ACCOUNT_LIFECYCLE + AUTHORIZATION; outcome เป็น redirect |
| DashboardProvider, requiredRole, canApproveLeave, canViewLeaveReports และ LiffCapabilities | PRESENTATION_ONLY; บางค่าคำนวณจาก RESOURCE_RELATIONSHIP หรือ FEATURE_FLAG แต่ไม่ใช่ authority |
| Routine isRoutineAdminActor | AUTHORIZATION + channel restriction |
| LIFF Routine reference route, getRoutineReferenceData and serializeLiffRoutineReference | Internal query branch is AUTHORIZATION/channel-context behavior; broader employee query is a least-data-access risk, while the no-employee-list response is a client-visible response contract |
| Routine build*AccessScope/Where และ creator-assignee checks | RESOURCE_RELATIONSHIP + ACCOUNT_LIFECYCLE สำหรับ active relation; query scope ไม่ใช่ generic capability |
| Stock Admin processor/inventory route guards | AUTHENTICATION + ACCOUNT_LIFECYCLE + AUTHORIZATION |
| Stock requester/processor query and command ownership checks | RESOURCE_RELATIONSHIP + BUSINESS_RULE + DATA_INTEGRITY/CONCURRENCY |
| Leave effective-approver, owner, participant and manager queries | RESOURCE_RELATIONSHIP + ACCOUNT_LIFECYCLE ของ approver + BUSINESS_RULE |
| Leave Admin recovery/override checks | AUTHORIZATION + RESOURCE_RELATIONSHIP + BUSINESS_RULE; ต้องมี workflow state และเหตุผลตามกรณี |
| Employee Admin mutation and offboarding composition | AUTHORIZATION + ACCOUNT_LIFECYCLE + RESOURCE_RELATIONSHIP + BUSINESS_RULE + DATA_INTEGRITY/CONCURRENCY |
| Leave/Routine feature guards | FEATURE_FLAG; ไม่ใช่ AUTHORIZATION |
| Public upload path safety and private attachment access | RESOURCE_RELATIONSHIP หรือ path-safety ตาม endpoint; ไม่สรุปจาก public upload เป็น User grant |
| Cron/cleanup secret and LINE webhook HMAC | AUTHENTICATION ของ SYSTEM/platform principal; ไม่ใช่ User AUTHORIZATION |

## 6. Resource Scope Baseline

ตารางนี้บันทึก semantics ที่มีอยู่จริง ไม่ได้บังคับให้เป็น future generic scope:

| Current behavior | Current source/shape | Current resources | Non-binding Phase 1 candidate | Status / caution |
|---|---|---|---|---|
| Current User / Employee self | Auth-derived user.id, employeeId; client IDs are ignored or re-derived | Leave profile/create/cancel, Stock create/list, Notifications, Email Request USER GET | OWN | Candidate is clear for self-owned records; still define per capability |
| Created by actor | RoutineTask.createdById = actor.id | Routine task edit/delete/list/detail | CREATED for edit/delete/read where domain approves | Creator is not equivalent to assignee |
| Current task assignee | RoutineTask.assignees.some.employeeId with active employee relation | Routine task management/read/edit | ASSIGNED | Task-level and occurrence-level assignment differ |
| Current occurrence assignee | RoutineOccurrence.assignees.some.employeeId | Routine occurrence read/focus | ASSIGNED | Must remain a domain-owned translation, not generic capability alone |
| Requested by | StockRequest.requestedBy = userId | Stock request list/detail/cancel | OWN | Admin all is a separate role/domain branch |
| Effective approver | exceptionApproverId ?? approverId | Leave approval, cancellation, not-taken, participant detail | ASSIGNED candidate | Requires Leave-specific effective-approver and workflow translation; OPEN — requires Phase 1/domain review |
| Original approver history | LeaveRequest.approverId = employeeId | Leave approver-history report | OPEN | Not the same as effective approver after exception reassignment |
| Direct reports/current team | Employee managerId = currentEmployeeId, active/deleted filters | Leave current-team report | TEAM candidate only if domain defines it | Do not equate HR manager relation with future Team persistence |
| Participant | Leave owner/original/effective approver query branches | Leave detail and attachments | OPEN | Participant is a domain relation, not a universal scope |
| Organization-wide | Empty or broad Prisma where after Admin/query path | Audit Admin read, Stock catalog/reports, Employee list/export, Routine all work items/export | ALL only where approved | Current broad USER surfaces require explicit policy decision |
| Recovery candidate | Effective approver unavailable plus exclusions | Leave Admin recovery | OPEN | Special recovery operation; do not collapse into ordinary ALL |
| System execution | Shared secret/HMAC | Cron, cleanup, webhook | Not a User scope | Separate system principal model is out of Phase 0 |
| LIFF Routine reference query | Route actor without explicit LIFF_SELF_SERVICE mode; serializer omits employees from the response | Internal employee reference query only; LIFF response reference metadata | Not a client-visible employee scope; OPEN — requires Phase 1/4 hardening decision | Internal channel-context and least-data-access risk; do not freeze the broader query as compatibility behavior |

No current behavior authorizes from departmentId, Department name, Team name or magic TeamRole name. No future Team/Capability mapping is binding in this document.

## 7. Authorization Compatibility Invariants

Later migration phases must preserve these behaviors until a policy change is explicitly approved and separately documented:

1. **API authentication and status distinction** — default missing/invalid API session is 401; authenticated non-Admin against requireAdminSession() is 403; route-specific response factories can intentionally map both to 403, notably Audit, Email Request and Department paths.
2. **Legacy API workforce eligibility** — current API session resolution requires an active, non-deleted account and an eligible active, non-deleted Employee before route-level authorization.
3. **Admin is not a universal bypass** — Admin still passes active account/workforce, input validation, resource/business relationship where the domain requires it, valid workflow state and transaction/concurrency rules.
4. **Routine channel behavior and LIFF reference response** — Dashboard-owned API Admin is elevated by isRoutineAdminActor; LIFF self-service Admin is not elevated for Routine task operations. The LIFF Routine reference response must not expose the employee reference list, including for an authenticated LIFF Admin; serializeLiffRoutineReference() currently enforces that boundary. The route's missing LIFF_SELF_SERVICE mode and any broader internal employee query are implementation risks, not compatibility behavior to preserve.
5. **Routine creator/assignee behavior** — USER creator can edit/delete; active task assignee can edit allowed content but cannot delete, change assignees/source or change lifecycle; occurrence-only assignment is a separate read/focus relationship.
6. **Routine all-scope current behavior** — operational task work-item, summary and export paths currently accept all-scope for a normal USER; existing tests explicitly freeze this. Any later narrowing is an approved behavior change, not an incidental resolver refactor.
7. **Stock requester/processor separation** — normal requester reads/cancels own pending requests; Admin can process and manage inventory; LIFF processor queue/issue requires Admin; unrelated LIFF request detail is hidden with not-found behavior.
8. **Stock data integrity** — requester attribution is server-derived; issue/cancel use status claims, stock availability, active references and transaction rules; these remain separate from capability authorization.
9. **Leave effective approver** — exception approver takes precedence over original approver for current actionable approval and participant access; owner cannot approve or confirm their own workflow.
10. **Leave Admin override boundaries** — Dashboard/API cancellation and not-taken flows can use Admin recovery override only when allowed by caller, effective approver is unavailable and a reason is supplied; LIFF passes allowAdminOverride: false.
11. **Leave normal approval** — decideLeaveRequest requires assigned effective approver and does not give Admin a broad approval bypass.
12. **Leave reporting semantics** — current-team report uses active direct reports by managerId; approver-history report uses original approverId, not exception approver assignment; report tab projections do not replace endpoint checks.
13. **Active/deleted identity handling** — inactive/deleted User, inactive/deleted Employee, invalid LIFF identity and stale LINE link continue to fail closed with their current 401/403 behavior.
14. **Feature-disabled behavior** — Leave/Routine API and LIFF routes return feature-specific not-found behavior; Dashboard/menu and LIFF home hide or mark modules unavailable. Feature flags are not role grants.
15. **Presentation is not authority** — hidden menu, requiredRole, canApproveLeave, canViewLeaveReports, LiffCapabilities and per-resource canEdit/canDelete must not be treated as server authorization without the corresponding route/domain enforcement.
16. **Employee lifecycle safeguards** — Admin Employee mutations preserve self-offboarding, last active Admin, subordinate and Leave dependency checks, linked account lifecycle, locks and transaction behavior.
17. **Leave workflow safeguards** — approval assignment, quota, overlap, date, notification action version, cancellation/not-taken state transitions and concurrency rules remain domain-owned.
18. **Private attachment access** — Dashboard Admin relationship bypass and Leave participant access are distinct from public upload file reads; private files remain behind their authorized route.
19. **Self-scoped notifications and Email Request reads** — notification commands/queries always use authenticated User ID; non-admin Email Request query is requester-owned.
20. **System endpoint separation** — cron/cleanup/webhook operations remain secret/HMAC-protected system boundaries, not User role checks.

## 8. Characterization tests

### 8.1 Existing tests relied upon

| Area | Relevant existing tests | What they freeze |
|---|---|---|
| API auth/workforce | __tests__/api/hybrid-auth-routes.test.ts, __tests__/auth/workforce.test.ts, __tests__/auth/workforce-transaction.test.ts | API authentication, role response behavior, active/inactive workforce and transaction re-checks |
| LIFF session | __tests__/auth/liff.test.ts, __tests__/auth/liff-capabilities.test.ts, __tests__/api/line-home-route.test.ts | missing/invalid/expired/config/stale-link/lifecycle outcomes and capability projection |
| Dashboard | __tests__/lib/dashboard-routes.test.ts, __tests__/constants/dashboard-menu.test.ts, __tests__/context/DashboardProvider.test.tsx | route/menu projection and feature/role presentation behavior; not a substitute for server guards |
| Employee | __tests__/api/employees-routes.test.ts, modules/employee/application/mutations.test.ts, modules/employee/infrastructure/persistence/employee-queries.test.ts, modules/employee/infrastructure/export/employee-export.test.ts | Admin mutation/lifecycle, query filters, export shape and lifecycle rules |
| Routine role/relationship | modules/routine/domain/capabilities.test.ts, modules/routine/application/delete.test.ts, modules/routine/application/mutations.test.ts, modules/routine/application/queries.test.ts | Admin/creator/assignee/inactive/deleted behavior, scopes, source redaction and channel mode |
| Routine API/channel | __tests__/api/routines-tasks.test.ts, __tests__/api/routines-task-by-id.test.ts, __tests__/api/routines-occurrences.test.ts, __tests__/api/routines-occurrence-by-id.test.ts, __tests__/api/routine-summary.test.ts, __tests__/api/routine-export.test.ts, __tests__/api/line-routine-routes.test.ts, __tests__/api/line-routine-self-service-routes.test.ts | route authentication, current all/mine behavior, LIFF self-service, Admin distinction, export behavior and no-employee-list reference responses for USER and ADMIN LIFF sessions |
| Stock | __tests__/api/stock-requests-routes.test.ts, __tests__/api/line-stock-routes.test.ts, __tests__/api/stock-items-route.test.ts, __tests__/api/stock-reports-export-route.test.ts, modules/stock/__tests__/queries.test.ts, modules/stock/__tests__/mutations.test.ts | requester/processor scope, Admin inventory, LIFF queue, 404 hiding, stock/concurrency invariants |
| Leave | __tests__/api/leave-request.test.ts, leave-me.test.ts, leave-approvals.test.ts, leave-decision.test.ts, leave-cancel.test.ts, leave-not-taken.test.ts, leave-export.test.ts, leave-approvers.test.ts, leave-admin-recovery.test.ts, leave-attachment.test.ts, __tests__/api/line-leave-routes.test.ts | owner/approver/manager/participant/recovery/report/channel behavior and status outcomes |
| Leave domain | modules/leave/application/approvals/approval-queries.test.ts, exception-approver.test.ts, approver-assignment.test.ts, offboarding-responsibilities.test.ts, modules/leave/domain/approver-eligibility.test.ts, modules/leave/domain/action-availability.test.ts, Leave request/cancellation integration tests | effective approver, unavailable fallback, actionable states, assignments, lifecycle and workflow invariants |
| Audit/email/notifications | __tests__/api/audit-log-route.test.ts, audit-log-cleanup-route.test.ts, __tests__/api/email-request.test.ts, __tests__/services/email-request/queries.test.ts, __tests__/api/notifications.test.ts, modules/notification/application/queries.test.ts, commands.test.ts | Admin audit read, system cleanup, Email Request ownership query and self-scoped notifications |

### 8.2 Tests added in Phase 0

เพิ่ม characterization test ใหม่ 1 ไฟล์:

- __tests__/api/authorization-current-state.test.ts
  - ยืนยันว่าปัจจุบัน USER ที่ผ่าน requireApiSession() เรียก Employee export route สำเร็จและ route ส่งต่อไป createEmployeeExport
  - ยืนยันว่าปัจจุบัน USER ที่ผ่าน requireApiSession() เรียก audit export logging endpoint สำเร็จและ endpoint บันทึก event ด้วย actor จาก session

การทดสอบทั้งสองกรณีตั้งใจ freeze current behavior ที่มีความเสี่ยง ไม่ได้แปลว่า policy นี้เป็น target policy และไม่ได้แก้ production code

## 9. Risks / Ambiguities / Phase 1 Inputs

### High risk

1. **Routine all-scope data exposure candidate** — GET /api/routines/summary?scope=all, GET /api/routines/occurrences?view=tasks&scope=all และ /api/routines/export ส่ง all-scope ลง getRoutineTaskWorkItems; buildTaskAssigneeWhere คืน no assignee filter เมื่อ scope เป็น all โดยไม่ตรวจ role. Tests ใน modules/routine/application/queries.test.ts และ __tests__/api/routine-summary.test.ts รวมทั้ง export route test ยืนยัน current behavior. Phase 1 ต้องตัดสิน intended policy ก่อนเปลี่ยน
2. **Employee organization-wide read/export** — Employee list, stats และ CSV export ใช้ authenticated API/workforce gate แต่ไม่มี Admin/relationship scope; export มีชื่อ, ตำแหน่ง, สังกัด, แผนก, email/phone ตาม query. ต้องตัดสิน PII/HR visibility ก่อน capability mapping
3. **LIFF Routine reference channel-context / least-data-access risk** — task routes สร้าง actor แบบ LIFF_SELF_SERVICE แต่ app/api/line/routine/reference/route.ts ไม่ส่ง mode ทำให้ getRoutineReferenceData() อาจใช้ Admin branch และ query active employees ทั้งหมดภายใน application layer. อย่างไรก็ตาม serializeLiffRoutineReference() ไม่ serialize employees ดังนั้นยังไม่พบ client-visible employee data exposure จากเส้นทางนี้. ให้ freeze เฉพาะ response boundary ที่ไม่ส่ง employee list; broader internal query เป็น Phase 1/4 hardening candidate ไม่ใช่ behavior ที่ต้อง preserve

### Medium risk / ambiguity

4. **Audit export endpoint is not a data-export authority** — POST /api/audit-logs/export เพียงบันทึก audit event แต่ authenticated USER ส่ง entityType, recordCount และ filters ได้โดยไม่มี body schema/role guard. Actual data export endpoints มี policy ต่างกัน; ต้องแยก “เริ่ม export” กับ “บันทึก export event” ใน Phase 1
5. **requireActiveWorkforceOrAdminSession contract mismatch** — helper branch อนุญาต Admin ที่ไม่มี Employee แต่ API adapter ที่อยู่ข้างใต้ reject ไม่มี eligible Employee. Route tests ที่ mock helper โดยตรงจึงอาจแสดง behavior กว้างกว่าการเรียกจริง
6. **Role checks กระจายหลายชั้น** — isAdminRole, literal ADMIN ใน Routine/Leave query, route guards, capability projection และ caller-supplied isAdmin/allowAdminOverride ทำให้ต้องกำหนด authority boundary ก่อน centralization
7. **Service commands บางตัวเชื่อ caller** — Stock issue ไม่มี role check ใน service เอง และ cancel รับ options.isAdmin; ความปลอดภัยปัจจุบันพึ่ง route composition. ต้องตัดสิน service contract ก่อนย้ายไป generic authorization
8. **Presentation projection ปะปนกับ authority ในชื่อ** — canApproveLeave, canViewLeaveReports, LiffCapabilities, Routine canEdit/canDelete มีประโยชน์ต่อ UX แต่ไม่เป็น guarantee ว่า route จะผ่าน
9. **Leave report role semantics ยังไม่ชัด** — route ให้ active workforce ทุกคนเรียกได้ ถ้ามี manager/original-approver relationship; canViewLeaveReports เป็นเพียง projection. ต้องตัดสิน whether report is relationship capability or Admin/Team capability
10. **Leave original vs effective approver history** — operational approval ใช้ effective approver แต่ report history ใช้ original approver. ไม่ควร map ทั้งสองเป็น ASSIGNED โดยไม่คุยกับ Leave owner
11. **Leave manager terminology** — getLeaveApprovalList รับ managerId แต่ query ใช้ effective approver relation รวม exception approver; อย่าใช้ชื่อนี้เป็นหลักฐานว่า manager เป็น authorization role
12. **Dashboard page/API divergence** — Employee page เปิดให้ USER, Admin-only pages guard ที่ page, domain pages อาศัย APIs; direct URL และ direct API ให้ผลต่างกันตาม surface
13. **Feature flag behavior varies by channel** — Leave/Routine disabled คืน not-found ใน APIs/LIFF และ redirect/hide ใน Dashboard; defaults เปิดนอก production. ไม่ใช่ permission state
14. **Public upload vs private attachment** — public upload GET ไม่มี User auth ตาม design path; private Leave attachment route มี participant/Admin relationship. ต้องรักษา namespace boundary
15. **Audit query ownership** — getAuditEntityHistory เป็น generic reader ที่ feature query เรียกหลัง resource authorization; ไม่พบ generic per-caller guard จึงต้อง audit callers ต่อเมื่อเพิ่ม consumer
16. **Test coverage gaps** — มี tests แข็งแรงใน Routine/Stock/Leave relationship แต่ก่อน Phase 0 ไม่มี route test เฉพาะ Employee export และ Audit export; เพิ่ม characterization สำหรับสอง boundary แล้ว. ยังไม่มี live production authorization test และยังไม่ได้ตัดสิน policy ของ broad read/export
17. **Department/Team ambiguity** — Department ถูกใช้ใน HR/reference/reporting; ไม่พบ Team persistence หรือ Team authorization. ห้ามใช้ชื่อแผนก/หน่วยงาน/ทีมในปัจจุบันเป็น future grant โดยอนุมาน
18. **Manager projection versus manager authority** — getCurrentEmployeeProjection() ใช้การมี subordinate relation เพื่อคำนวณ isManager แต่ query นี้ไม่ได้ใช้ active/deleted filter แบบเดียวกับ Leave report query; จึงอาจทำให้ tab/capability projection กว้างกว่า actionable server result. API approval/report ยังใช้ query scope ของตนเอง

### Migration notes

- ก่อนสร้าง Capability Contract ต้องแยก operation ที่เป็น read all, export all, relationship read, mutation และ workflow decision ออกจากกัน
- ทุก capability ใน Phase 1 ต้องระบุ **authorization execution channel** ที่รองรับ (`DASHBOARD`, `LIFF_SELF_SERVICE`, `SYSTEM` ถ้าจำเป็น) และต้องชี้กลับมายัง domain relationship/business rule ที่ยังคงอยู่; ให้บันทึก `API` แยกเป็น entry-point / transport surface เท่านั้น ไม่ใช่ actor channel
- Broad current behavior ที่มี test freeze ไม่ควรถูกเปลี่ยนเพียงเพราะย้าย helper; หากต้องแก้ให้เป็น approved policy/security remediation แยกจาก migration
- สำหรับ LIFF Routine reference ให้ preserve เฉพาะ response contract ที่ไม่เปิดเผย employee list; การ query employee set ที่กว้างจาก mode omission เป็น internal hardening candidate ไม่ใช่ broad current behavior ที่ต้อง freeze
- ต้องเพิ่ม regression tests สำหรับ intended policy ก่อนแก้ Routine all-scope, Employee export/read และ audit export semantics

## 10. Explicit non-goals for Phase 0

Phase 0 ไม่ได้ทำและไม่ควรตีความว่าได้อนุมัติสิ่งต่อไปนี้:

- สร้าง Team, TeamRole, TeamMembership, TeamCapabilityGrant, TeamRoleCapabilityGrant, UserCapabilityGrant
- สร้าง Capability Registry, Scope Registry, AuthorizationActor contract, generic resolver, authorization.can(), authorization.require() หรือ authorization.resolve()
- สร้าง Team-based policy, Department-based authorization, explicit DENY, wildcard permission, policy DSL หรือ general ABAC engine
- แทนที่ requireAdminSession, requireApiSession, workforce guards หรือ domain checks เดิม
- เปลี่ยน Prisma schema, migration, production authorization outcome หรือ authentication/session/refresh/password/LINE/LIFF identity infrastructure
- แก้ broad export/read risk ที่ค้นพบในเอกสารนี้
- เปลี่ยน UI styling หรือสร้าง authorization administration UI/permission API

## 11. Recommended concrete Phase 1 scope — Capability Contract & Registry

Phase 1 ควรเริ่มจาก contract/registry ที่อธิบาย behavior ที่ freeze แล้ว โดยยังไม่ต้องเปลี่ยนทุก route เป็น resolver:

1. กำหนด capability identifiers ที่ตรงกับ operation จริง เช่น employee.read, employee.export, routine.task.read, routine.task.create, routine.task.update, routine.task.delete, routine.occurrence.reassign, routine.occurrence.change_due_date, routine.import.manage, stock.request.create/read/cancel/process, stock.inventory.read/manage, leave.request.create/read/cancel, leave.request.approve, leave.manage, audit.read, data.export และ capability สำหรับ configuration เฉพาะที่พิสูจน์จาก route แล้ว
2. สำหรับแต่ละ capability ระบุ supported **authorization execution channels** (`DASHBOARD`, `LIFF_SELF_SERVICE`, `SYSTEM` ถ้าจำเป็น), authentication/workforce precondition, current unauthorized outcome และ whether it is a read, mutation, export, workflow decision or system operation; บันทึก entry-point / transport surface แยกต่างหาก โดยไม่สร้าง `API` เป็น actor channel เพียงเพราะ route อยู่ใต้ `/api/**`. Dashboard-owned API calls โดยปกติยังคงเป็น `DASHBOARD` context, LIFF routes ใช้ `LIFF_SELF_SERVICE`, และ trusted background/platform operations ใช้ `SYSTEM` หรือ system principal model ที่ได้รับอนุมัติ
3. ระบุ supported scope อย่าง explicit: self/created/assigned/team/all ตาม current semantics; ใช้ OPEN — requires Phase 1/domain review สำหรับ effective approver, participant, recovery และ report-history cases ที่ generic scope แปลไม่ได้ตรง ๆ
4. เก็บ domain-owned predicates แยกจาก capability grant: active User/Employee, creator/assignee/requester/effective approver/manager, valid Leave/Stock/Routine state, quota, concurrency, active target references และ transaction rules
5. สร้าง registry record จาก matrix ก่อนสร้าง resolver โดยห้ามอนุมาน grant จาก Department, Department name, Team name หรือ magic role name
6. ตัดสิน policy อย่างเป็นลายลักษณ์อักษรสำหรับ Routine USER all-scope, Employee broad read/export, Audit export event endpoint, Leave report visibility และการ harden internal query ของ LIFF Routine reference ก่อนเริ่ม route migration; เพิ่ม regression tests ของ policy ที่เลือก โดยคง response boundary ที่ไม่ส่ง employee list
7. เมื่อ contract ถูก review แล้วจึงออกแบบ mapping ของ ADMIN และ normal-user grants แบบ additive ALLOW โดยคง default DENY ของ future generic layer และคง channel restriction ของ LIFF

ข้อเสนอข้างต้นเป็นขอบเขตสำหรับการออกแบบ Phase 1 เท่านั้น เอกสารนี้ไม่ได้เริ่ม implementation ของ Phase 1
