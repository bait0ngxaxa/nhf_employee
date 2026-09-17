# Phase 12F — Full Authorization Regression / Security Matrix

สถานะ: **CLOSED**  
Audit baseline commit: `4646e259bcb2e5900aa1a679ccc78aaae6cbe186`  
Baseline subject: `feat(auth-admin): complete effective-access inspection UX`  
วันที่ตรวจสอบ: `2026-09-17`

เอกสารนี้เป็น current authoritative security-regression baseline ของ
authorization architecture หลัง Phase 12A–12E. ไม่ใช่การ copy จำนวนหรือ
compatibility model จาก Phase 11C และไม่ได้ตรวจหรือแก้ configuration ใน
production database.

## 1. ผลสรุป

ผลตรวจจาก source ปัจจุบัน, route callers, domain adapters, transaction paths,
presentation consumers และ regression tests ยืนยัน chain นี้:

```text
authenticated / trusted identity
  -> system-role authority
  -> registered capability + supported channel
  -> configured resolver authority
  -> permanent Default Domain Policy + configured additive authority
  -> domain channel policy
  -> resource / relationship predicate
  -> workflow / lifecycle / transaction invariant
  -> ALLOW / DENY
```

ผลสำคัญ:

- Registry ปัจจุบันมี 40 capabilities: `25 CENTRAL_WITH_DEFAULT_POLICY`,
  `0 CENTRAL_WITH_COMPATIBILITY`, `13 CENTRAL_ONLY`, `2 DEFERRED`.
- Readiness ปัจจุบันคือ `38 GRANTABLE`, `0 POLICY_ACTIVATION_REQUIRED`,
  `2 DEFERRED`; Email Request สองรายการเป็น deferred เพียงรายการเดียว.
- Current operation ledger มี 86 rows: protected migrated operations 83
  rows และ Stock presentation-only action projections 3 rows.
- Protected migrated operations ทั้ง 83 rows มี DIRECT route evidence.
- Authorization Administration ledger มี 17 rows และมี DIRECT evidence ที่
  ใช้ `requireAdminSession` และ shared server route-auth boundary จริง.
- Countable cross-cutting regression matrix มี 58 rows: `53 DIRECT`,
  `2 INDIRECT`, `0 MISSING`, `3 N/A`.
- Mandatory MISSING authorization/security rows = `0`; blocking authorization
  defects = `0` หลัง corrective hardening สองจุดของ Stock configuration-error
  response boundary.

ข้อสรุปนี้หมายถึง code/runtime safety และ regression evidence เท่านั้น ไม่ได้
หมายความว่า production มี grant ใดอยู่หรือไม่มี grant ใดอยู่. Production
authorization inventory และ rollout readiness เป็นงานของ Phase 12G.

## 2. วิธีการตรวจและหลักฐาน

### 2.1 สิ่งที่ตรวจจาก current source

อ่านและ trace implementation ปัจจุบันก่อนอ้าง historical closure ได้แก่:

- `modules/authorization/**`: contracts, registry, evaluator, resolver,
  composition, administration catalog/mutations/effective-access และ
  persistence ports;
- `modules/employee/**`, `department/**`, `notification/**`, `routine/**`,
  `stock/**`, `leave/**`, `audit/**`, `line/**`: domain defaults, channel
  adapters, resource predicates, serializers, lifecycle และ transaction
  paths;
- `app/api/**`, `app/api/line/**`: current route handlers, route-auth,
  session/workforce/LIFF boundaries, validation order และ query/mutation
  callers;
- `app/dashboard/**` และ presentation projections: visibility, action
  availability และ Effective Access inspector consumers;
- architecture records ที่ระบุใน Phase 12F request รวมถึง Phase 11C matrix
  เพื่อใช้เป็น inventory aid เท่านั้น.

การ trace แยกสามชนิดของข้อสรุปให้ชัดเจน:

| ชนิดหลักฐาน | ความหมายในเอกสารนี้ |
|---|---|
| Source inspection | ข้อสรุปจาก production source และ call path ที่อ่านโดยตรง |
| Test evidence | ข้อสรุปที่ test ตั้งใจ exercise invariant ที่ระบุ |
| Inference | ข้อสรุปเชิง aggregate จากหลาย source/test; ระบุเหตุผลไว้ใน row |
| Accepted limitation | สิ่งที่ architecture ปัจจุบันไม่ได้ claim หรืออยู่นอก scope |

### 2.2 Coverage classifications

| Classification | เกณฑ์ปิด row |
|---|---|
| `DIRECT` | Test ตั้งใจพิสูจน์ invariant ที่กล่าวถึงโดยตรง. สำหรับ operation ledger ต้องผ่าน route/channel/capability boundary จริง; test ที่ mock authorization application boundary ออกถือเป็นเพียง INDIRECT |
| `INDIRECT` | หลักฐานข้างเคียงพิสูจน์เพียงบางส่วนของ claim. ต้องบอกเหตุผล, evidence ที่มี และบอกว่า stronger proof mandatory หรือ optional |
| `MISSING` | ยังไม่มีหลักฐานเพียงพอ. Mandatory MISSING ต้องกลายเป็น finite work item และห้ามปิด phase จนเป็นศูนย์ |
| `N/A` | Architecture ไม่ได้ claim stronger invariant นั้น. ต้องอธิบายเหตุผล และห้ามใช้เพื่อซ่อน protected operation ที่ไม่มี test |

Operation rows ที่เป็น UI action projection ใช้ `DIRECT` ได้เมื่อ direct
presentation test พิสูจน์ projection นั้น และต้องติดป้าย
`PRESENTATION_ONLY`; route mutation ที่สอดคล้องกันยังต้องมี route evidence
แยกต่างหาก.

### 2.3 Direct route evidence ที่สร้าง/ใช้ใน Phase 12F

`__tests__/api/authorization-phase-12f-routine-route-seam.test.ts` เป็น
parameterized direct seam suite 83 cases. ชื่อไฟล์คงไว้ตาม working audit
artifact เดิม แม้ suite จะครอบคลุมทุก migrated domain ไม่ใช่ Routine เท่านั้น.
ทุก case เรียก handler path จริง, ใช้ production domain adapter และ real
resolver/composition; lower persistence/service seams ถูกควบคุมเพื่อหยุด
หลัง authorization boundary. Test ป้อน malformed persisted scope ที่
capability ที่กำลังตรวจ เพื่อให้ resolver ต้องอ่าน source จริงและ fail closed;
ไม่ใช่การ mock `assert*Capability` ให้ผ่าน.

Suite เดียวกันตรวจ actor/channel ที่ domain route สร้างได้โดยตรง และ source
tests ของแต่ละ adapter ตรวจ fixed actor builder เพิ่มเติม. Cases ที่มี
transaction adapter ใช้ current transaction resolver path. `audit.read` มี
source-fixed Dashboard actor และ central resolver evidence จาก Audit adapter
ร่วมกับ route case.

`__tests__/api/authorization-phase-12f-administration-route-seam.test.ts`
เรียก 17 current Administration route handlers ผ่าน real
`requireAdminSession` → `requireAuthorizationAdministrationApiSession` →
route-auth; application commands เป็น lower seam ที่ควบคุมผลลัพธ์. Application
validation/atomicity จริงยังอยู่ใน
`modules/authorization/application/administration*.test.ts`.

## 3. Current capability inventory

Inventory นี้ recompute จาก `CAPABILITY_DEFINITIONS`,
`CAPABILITY_REGISTRY`, `CAPABILITY_ADMINISTRATION_METADATA`, domain capability
constants และ current adapters. `Default` หมายถึง permanent runtime policy
ของ eligible normal `USER`; `—` หมายถึงไม่มี default authority.

| # | Capability | Domain | Runtime classification | Channel(s) | Registered scopes | Current Default Domain Policy |
|---:|---|---|---|---|---|---|
| 1 | `employee.read` | Employee | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard | `ALL` | `ALL` |
| 2 | `employee.stats.read` | Employee | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard | `ALL` | `ALL` |
| 3 | `employee.create` | Employee | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard | `ALL` | `—` |
| 4 | `employee.update` | Employee | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard | `ALL` | `—` |
| 5 | `employee.delete` | Employee | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard | `ALL` | `—` |
| 6 | `employee.import` | Employee | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard | `ALL` | `—` |
| 7 | `employee.export` | Employee | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard | `ALL` | `ALL` |
| 8 | `department.read` | Department | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard | `ALL` | `ALL` |
| 9 | `routine.task.read` | Routine | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `CREATED`, `ASSIGNED`, `ALL` | Context-sensitive: management `CREATED + ASSIGNED`; work-item mine `ASSIGNED`; work-item all `ALL`; LIFF self-service policy |
| 10 | `routine.task.create` | Routine | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `OWN`, `ALL` | `OWN` |
| 11 | `routine.task.update` | Routine | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `CREATED`, `ASSIGNED`, `ALL` | `CREATED + ASSIGNED` |
| 12 | `routine.task.delete` | Routine | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `CREATED`, `ALL` | `CREATED` |
| 13 | `routine.occurrence.read` | Routine | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard | `ASSIGNED`, `ALL` | `ASSIGNED` |
| 14 | `routine.occurrence.override` | Routine | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard | `ALL` | `—` |
| 15 | `routine.occurrence.reassign` | Routine | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard | `ALL` | `—` |
| 16 | `routine.occurrence.change_due_date` | Routine | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard | `ALL` | `—` |
| 17 | `routine.import.manage` | Routine | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard | `ALL` | `—` |
| 18 | `routine.task.export` | Routine | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard | `ALL` | `ALL` |
| 19 | `routine.summary.read` | Routine | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `ASSIGNED`, `ALL` | Dashboard mine `ASSIGNED`; Dashboard all `ALL`; LIFF self-service policy |
| 20 | `routine.reference.read` | Routine | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `OWN`, `ALL` | `OWN` plus LIFF data-minimization policy |
| 21 | `stock.catalog.read` | Stock | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `ALL` | `ALL` |
| 22 | `stock.inventory.manage` | Stock | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard | `ALL` | `—` |
| 23 | `stock.request.read` | Stock | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `OWN`, `ALL` | `OWN` |
| 24 | `stock.request.create` | Stock | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `OWN` | `OWN` |
| 25 | `stock.request.cancel` | Stock | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `OWN`, `ALL` | `OWN` |
| 26 | `stock.request.process` | Stock | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard, LIFF | `ALL` | `—` |
| 27 | `stock.report.export` | Stock | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard | `ALL` | `—` |
| 28 | `leave.request.read` | Leave | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `OWN` | `OWN` |
| 29 | `leave.approval.read` | Leave | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `ASSIGNED` | `ASSIGNED` |
| 30 | `leave.request.create` | Leave | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `OWN` | `OWN` |
| 31 | `leave.request.cancel` | Leave | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `OWN` | `OWN` |
| 32 | `leave.request.approve` | Leave | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `ASSIGNED` | `ASSIGNED` |
| 33 | `leave.cancellation.decide` | Leave | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard | `ASSIGNED` | Dashboard `ASSIGNED`; LIFF unsupported by registry |
| 34 | `leave.request.not_taken` | Leave | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard, LIFF | `OWN`, `ASSIGNED` | `OWN + ASSIGNED` |
| 35 | `leave.approver.manage` | Leave | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard | `ALL` | `—` |
| 36 | `audit.read` | Audit | `CENTRAL_ONLY_AUTHORIZATION` | Dashboard | `ALL` | `—` |
| 37 | `email.request.read` | Email | `DEFERRED_AUTHORIZATION_SURFACE` | Dashboard | `OWN`, `ALL` | Deferred; no default composition |
| 38 | `email.request.create` | Email | `DEFERRED_AUTHORIZATION_SURFACE` | Dashboard | `ALL` | Deferred; no default composition |
| 39 | `notification.inbox.read` | Notification | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard | `OWN` | current actor `OWN` |
| 40 | `notification.inbox.update` | Notification | `DEFAULT_POLICY_AUTHORIZATION` | Dashboard | `OWN` | current actor `OWN` |

### 3.1 Recomputed totals

| Measure | Count |
|---|---:|
| Registered capabilities | 40 |
| `CENTRAL_WITH_DEFAULT_POLICY` / `DEFAULT_POLICY_AUTHORIZATION` | 25 |
| `CENTRAL_WITH_COMPATIBILITY` | 0 |
| `CENTRAL_ONLY` | 13 |
| `DEFERRED` | 2 |
| Grantable | 38 |
| `POLICY_ACTIVATION_REQUIRED` | 0 |
| Deferred readiness | 2 |

Arithmetic: `40 = 25 + 0 + 13 + 2`; `40 = 38 + 0 + 2`.

The current catalog map is exhaustive. A capability is not classified from a
filename or historical phase claim: registry definition, administration
metadata, domain adapter and route callers all agree. There is no current
registry entry using `CENTRAL_WITH_COMPATIBILITY`.

## 4. Phase 11C reconciliation

`docs/architecture/authorization-phase-11c-security-regression-matrix.md` and
its closure remain historical documents and are not rewritten. The following
reconciliation is explicit for every Phase 11C matrix family and ledger row.

### 4.1 Operation-ledger reconciliation

| Phase 11C rows | Result in Phase 12F | Reason |
|---|---|---|
| `LEDGER-EMP-01`, `LEDGER-EMP-02`, `LEDGER-EMP-03`, `LEDGER-EMP-04`, `LEDGER-EMP-05`, `LEDGER-EMP-06`, `LEDGER-EMP-07` | `RETAINED` | Same current Employee route/capability boundaries; old compatibility wording is replaced by permanent Default Policy vs Central Only classification. |
| `LEDGER-DEPT-01` | `RETAINED` | Same Dashboard Department read route; default is permanent `department.read -> ALL`. |
| `LEDGER-ROU-01`, `LEDGER-ROU-02`, `LEDGER-ROU-03`, `LEDGER-ROU-04`, `LEDGER-ROU-05`, `LEDGER-ROU-06`, `LEDGER-ROU-07`, `LEDGER-ROU-08`, `LEDGER-ROU-09`, `LEDGER-ROU-10`, `LEDGER-ROU-11`, `LEDGER-ROU-12`, `LEDGER-ROU-13`, `LEDGER-ROU-14`, `LEDGER-ROU-15`, `LEDGER-ROU-16`, `LEDGER-ROU-17`, `LEDGER-ROU-18` | `RETAINED` | Existing Dashboard task, occurrence and import entry points remain current; the old fallback terminology is removed from current classification. |
| `LEDGER-ROU-19`, `LEDGER-ROU-20`, `LEDGER-ROU-21`, `LEDGER-ROU-22`, `LEDGER-ROU-23` | `RETAINED` | Existing LIFF task self-service entry points remain current and retain channel/resource policy. |
| `LEDGER-STK-01`, `LEDGER-STK-02`, `LEDGER-STK-03`, `LEDGER-STK-04`, `LEDGER-STK-05`, `LEDGER-STK-06`, `LEDGER-STK-07`, `LEDGER-STK-08`, `LEDGER-STK-09`, `LEDGER-STK-10`, `LEDGER-STK-11`, `LEDGER-STK-12`, `LEDGER-STK-13`, `LEDGER-STK-14`, `LEDGER-STK-15`, `LEDGER-STK-16`, `LEDGER-STK-17`, `LEDGER-STK-18`, `LEDGER-STK-19`, `LEDGER-STK-20`, `LEDGER-STK-21`, `LEDGER-STK-22`, `LEDGER-STK-23`, `LEDGER-STK-24`, `LEDGER-STK-25`, `LEDGER-STK-26`, `LEDGER-STK-27`, `LEDGER-STK-28` | `RETAINED` | Current Stock paths and three presentation projections remain the same route families; direct Phase 12F route seam evidence is refreshed. |
| `LEDGER-LEV-01`, `LEDGER-LEV-02`, `LEDGER-LEV-03`, `LEDGER-LEV-04`, `LEDGER-LEV-05`, `LEDGER-LEV-06`, `LEDGER-LEV-07`, `LEDGER-LEV-08`, `LEDGER-LEV-09`, `LEDGER-LEV-10`, `LEDGER-LEV-11`, `LEDGER-LEV-12`, `LEDGER-LEV-13`, `LEDGER-LEV-14`, `LEDGER-LEV-15`, `LEDGER-LEV-16`, `LEDGER-LEV-17` | `RETAINED` | Generic Leave capability boundaries remain current; Leave-owned report, attachment, participant and recovery paths remain separate. |
| `LEDGER-AUD-01` | `RETAINED` | Audit remains Dashboard central-only with no role-based bypass. |
| `LEDGER-NOT-01`, `LEDGER-NOT-02`, `LEDGER-NOT-03`, `LEDGER-NOT-04` | `RETAINED` | Notification inbox remains actor-owned `OWN` on both read/update paths. |
| new `LEDGER-ROU-24`, `LEDGER-ROU-25`, `LEDGER-ROU-26`, `LEDGER-ROU-27`, `LEDGER-ROU-28` | `SPLIT` | Phase 12D moved export, summary and reference into migrated current authorization; Dashboard and LIFF boundaries are now five explicit rows. |

The old ledger total `81` is therefore superseded by the current `86`; it is
not carried forward as a Phase 12F count. The current operation ledger is in
Section 5.

### 4.2 Historical matrix-row reconciliation

The following lists every relevant Phase 11C row ID explicitly. A range in the
first column expands to each comma-separated ID shown, not to an implicit
unreviewed bucket.

| Phase 11C IDs | Result | Phase 12F reason |
|---|---|---|
| `AUTHN-01`, `AUTHN-02`, `AUTHN-03`, `AUTHN-04` | `RETAINED` | Authentication and current identity failures remain required controls; current session/LIFF source and tests are re-audited in `SEC-01`–`SEC-10`. |
| `LIFE-01`, `LIFE-02`, `LIFE-03`, `LIFE-04`, `LIFE-05`, `LIFE-06` | `RETAINED` | User/Employee/link lifecycle gates remain current. Former compatibility labels are now domain/lifecycle policy labels. |
| `ACTOR-01`, `ACTOR-02`, `ACTOR-03`, `ACTOR-04`, `ACTOR-05`, `ACTOR-06`, `ACTOR-07` | `RETAINED` | Server-derived actor and source provenance remain current; target IDs are still not actor IDs. |
| `CAP-01`, `CAP-02`, `CAP-03`, `CAP-04`, `CAP-05`, `CAP-06`, `CAP-07`, `CAP-08`, `CAP-09`, `CAP-10`, `CAP-11`, `CAP-12` | `RETAINED` | Registry, resolver, composition and domain capability checks remain current. Rows whose old description said “compatibility” are reclassified as permanent default, central-only, or domain policy. |
| `SCOPE-01`, `SCOPE-02`, `SCOPE-03`, `SCOPE-04`, `SCOPE-05`, `SCOPE-06`, `SCOPE-07`, `SCOPE-08`, `SCOPE-09` | `RETAINED` | Scope union, provenance, resource predicates and `ALL` limitations remain current. |
| `CHANNEL-01`, `CHANNEL-02`, `CHANNEL-03`, `CHANNEL-04`, `CHANNEL-05`, `CHANNEL-06`, `CHANNEL-07` | `RETAINED` | Dashboard/LIFF differences remain current; no `API` actor channel is introduced. |
| `API-01`, `API-02`, `API-03`, `API-04`, `API-05`, `API-06`, `API-07`, `API-08`, `API-09` | `RETAINED` | Route/authentication, domain, transaction, presentation and Administration claims remain current and are checked against current callers. |
| `API-10` | `SUPERSEDED` | Old aggregate route breadth and old `81/78` counts are replaced by the fresh 86-row ledger. |
| `TX-01`, `TX-02`, `TX-03`, `TX-04`, `TX-05`, `TX-06`, `TX-07`, `TX-08`, `TX-09`, `TX-10`, `TX-11` | `RETAINED` | Transaction claims are re-traced per current path; read-only, create/import, partial-success and filesystem limitations are not overclaimed. |
| `ADMIN-01`, `ADMIN-02`, `ADMIN-03`, `ADMIN-04`, `ADMIN-05`, `ADMIN-06`, `ADMIN-07`, `ADMIN-08` | `RETAINED` | Administration remains ADMIN-only and target-ID safe; current 17-route ledger and Effective Access inspector are refreshed. |
| `COMPAT-01`, `COMPAT-02` | `SUPERSEDED` | Employee rows are permanent broad Default Policy or Central Only, not active compatibility policy. |
| `COMPAT-03` | `SUPERSEDED` | Department `ALL` is permanent Default Domain Policy. |
| `COMPAT-04` | `SUPERSEDED` | Notification `OWN` is permanent actor-owned Default Policy, with no configured `ALL` bypass. |
| `COMPAT-05` | `RETAINED` | Stock Dashboard/LIFF and request ownership semantics remain domain/channel policy; no compatibility fallback remains. |
| `COMPAT-06` | `SUPERSEDED` | Routine baseline is permanent additive default plus context policy; it is not a temporary bridge. |
| `COMPAT-07` | `SPLIT` | Old deferred Routine summary/reference/export coverage moved into migrated `LEDGER-ROU-24`–`LEDGER-ROU-28` after Phase 12D. |
| `COMPAT-08` | `RETAINED` | Routine LIFF self-service clamp remains a domain channel rule, including configured `ALL`/ADMIN clamping where applicable. |
| `COMPAT-09` | `SUPERSEDED` | Leave generic defaults are permanent additive policy; relationship/workflow exceptions remain domain-owned. |
| `COMPAT-10` | `RETAINED` | Leave report/export remains domain-owned and unregistered; its route protection is audited separately in Section 12. |
| `COMPAT-11` | `RETAINED` | Leave participant/detail and attachment relationships remain domain-owned and unregistered. |
| `COMPAT-12` | `RETAINED` | Leave recovery and LIFF cancellation-decision exception remain intentional domain-owned boundaries. |
| `COMPAT-13` | `RETAINED` | Email Request remains explicitly `DEFERRED_AUTHORIZATION_SURFACE`; it is not migrated or grantable. |
| `COMPAT-14` | `RETAINED` | Presentation is still visibility/projection only and is not authority. |
| `COMPAT-15` | `RETAINED` | Team/Department separation and architecture boundaries remain current. |

The old capability inventory entries describing three Routine capabilities as
deferred are `SPLIT`/`SUPERSEDED` by the current 12-capability Routine registry.
No historical document is edited to make this reconciliation appear
retroactive.

## 5. Current operation ledger

การนับนี้ derive จาก current `app/api/**`, `app/api/line/**`, registered domain
callers และ presentation action projections. ไม่รวม Email Request ที่ deferred
และไม่สร้าง route จากชื่อ capability ที่ไม่มี caller.

Evidence keys:

- `E-ROUTE`: `__tests__/api/authorization-phase-12f-routine-route-seam.test.ts`;
  83 parameterized route cases exercise each protected row through a real
  route-to-domain authorization seam, with exact current route, capability and
  Dashboard/LIFF actor mapping.
- `E-ROUTE-DOMAIN`: the same Phase 12F suite plus the existing domain/transaction
  tests cited in the row; used where the route delegates the final predicate or
  transaction invariant to the domain.
- `E-PROJECTION`: `modules/stock/application/presentation-capabilities.test.ts`
  and current LIFF serialization/route projection tests. These rows are
  explicitly presentation-only; their mutation routes are separately listed.

### 5.1 Employee and Department

| ID | Current entry point | Capability | Actor channel | Resource/lifecycle boundary | Evidence | Classification |
|---|---|---|---|---|---|---|
| `LEDGER-EMP-01` | `GET /api/employees` | `employee.read` | `DASHBOARD` | Broad `ALL`; deleted Employee filtering, bootstrap/system exclusions, pagination and filters remain query-owned | `E-ROUTE-DOMAIN`; `modules/employee/infrastructure/persistence/employee-queries.test.ts`; `__tests__/api/employees-routes.test.ts` | `DIRECT` |
| `LEDGER-EMP-02` | `GET /api/employees/stats` | `employee.stats.read` | `DASHBOARD` | Broad aggregate default; current Employee/query filters remain authoritative | `E-ROUTE-DOMAIN`; Employee query/presentation tests | `DIRECT` |
| `LEDGER-EMP-03` | `POST /api/employees` | `employee.create` | `DASHBOARD` | No default; input, lifecycle, uniqueness and transaction rules remain domain-owned | `E-ROUTE-DOMAIN`; Employee mutation tests | `DIRECT` |
| `LEDGER-EMP-04` | `GET /api/employees/export` | `employee.export` | `DASHBOARD` | Broad export default; export limits, selected fields and audit remain enforced | `E-ROUTE-DOMAIN`; `__tests__/api/employees-routes.test.ts` | `DIRECT` |
| `LEDGER-EMP-05` | `POST /api/employees/import` | `employee.import` | `DASHBOARD` | No default; bounded input and partial-success import contract; no transaction-wide claim | `E-ROUTE-DOMAIN`; Employee import tests | `DIRECT` |
| `LEDGER-EMP-06` | `PATCH /api/employees/:id` | `employee.update` | `DASHBOARD` | User/Employee lock and current-state re-read; target lifecycle and command invariants | `E-ROUTE-DOMAIN`; Employee authorization/mutation tests | `DIRECT` |
| `LEDGER-EMP-07` | `DELETE /api/employees/:id` | `employee.delete` | `DASHBOARD` | User/Employee lock and current-state re-read; delete blockers and lifecycle rules | `E-ROUTE-DOMAIN`; Employee authorization/mutation tests | `DIRECT` |
| `LEDGER-DEPT-01` | `GET /api/departments` | `department.read` | `DASHBOARD` | Permanent broad reference-data default; Department is not an authorization source | `E-ROUTE-DOMAIN`; `modules/department/application/authorization.test.ts` | `DIRECT` |

### 5.2 Routine — Dashboard and LIFF

| ID | Current entry point | Capability | Actor channel | Context / domain boundary | Evidence | Classification |
|---|---|---|---|---|---|---|
| `LEDGER-ROU-01` | `GET /api/routines/tasks` | `routine.task.read` | `DASHBOARD` | Management context: default `CREATED + ASSIGNED`; creator/assignee/resource query predicates remain | `E-ROUTE-DOMAIN`; Routine query tests | `DIRECT` |
| `LEDGER-ROU-02` | `POST /api/routines/tasks` | `routine.task.create` | `DASHBOARD` | Default `OWN`; input, assignee/lifecycle, idempotency and transaction rules remain | `E-ROUTE-DOMAIN`; Routine mutation tests | `DIRECT` |
| `LEDGER-ROU-03` | `GET /api/routines/tasks/:id` | `routine.task.read` | `DASHBOARD` | Creator/assignee and task-detail relationship | `E-ROUTE-DOMAIN`; Routine task-detail tests | `DIRECT` |
| `LEDGER-ROU-04` | `PATCH /api/routines/tasks/:id` | `routine.task.update` | `DASHBOARD` | Creator/assignee relationship, lifecycle, version and transaction invariants | `E-ROUTE-DOMAIN`; Routine task mutation tests | `DIRECT` |
| `LEDGER-ROU-05` | `DELETE /api/routines/tasks/:id` | `routine.task.delete` | `DASHBOARD` | Default `CREATED`; creator/delete blockers, lifecycle and transaction invariants | `E-ROUTE-DOMAIN`; Routine delete tests | `DIRECT` |
| `LEDGER-ROU-06` | `GET /api/routines/occurrences` | `routine.occurrence.read` | `DASHBOARD` | Occurrence assignment workload, default `ASSIGNED`, domain filters | `E-ROUTE-DOMAIN`; Routine occurrence tests | `DIRECT` |
| `LEDGER-ROU-07` | `GET /api/routines/occurrences?view=tasks` | `routine.task.read` | `DASHBOARD` | Work-item Mine/All context mapping; client query selects view only | `E-ROUTE-DOMAIN`; Routine query tests | `DIRECT` |
| `LEDGER-ROU-08` | `GET /api/routines/occurrences/:id` | `routine.occurrence.read` | `DASHBOARD` | Occurrence assignee/resource relationship | `E-ROUTE-DOMAIN`; Routine occurrence-detail tests | `DIRECT` |
| `LEDGER-ROU-09` | `PATCH /api/routines/occurrences/:id` | `routine.occurrence.override` | `DASHBOARD` | Central-only `ALL` plus expected-version, target lifecycle and workflow rules | `E-ROUTE-DOMAIN`; Routine occurrence mutation tests | `DIRECT` |
| `LEDGER-ROU-10` | `PATCH /api/routines/occurrences/:id/assignees` | `routine.occurrence.reassign` | `DASHBOARD` | Central-only `ALL`; target Employee lifecycle and assignment locks | `E-ROUTE-DOMAIN`; Routine assignment tests | `DIRECT` |
| `LEDGER-ROU-11` | `PATCH /api/routines/occurrences/:id/due-date` | `routine.occurrence.change_due_date` | `DASHBOARD` | Central-only `ALL`; workflow/version and target state | `E-ROUTE-DOMAIN`; Routine occurrence mutation tests | `DIRECT` |
| `LEDGER-ROU-12` | `POST /api/routines/imports/preview` | `routine.import.manage` | `DASHBOARD` | Central-only `ALL`; bounded workbook, staging and validation; no transaction-wide claim | `E-ROUTE-DOMAIN`; Routine import tests | `DIRECT` |
| `LEDGER-ROU-13` | `GET /api/routines/imports/reference` | `routine.import.manage` | `DASHBOARD` | Central-only `ALL`; active/deleted Employee and notification-readiness projection | `E-ROUTE-DOMAIN`; Routine import reference tests | `DIRECT` |
| `LEDGER-ROU-14` | `GET /api/routines/imports/:batchId` | `routine.import.manage` | `DASHBOARD` | Batch ownership, lifecycle and validation remain import-owned | `E-ROUTE-DOMAIN`; Routine import tests | `DIRECT` |
| `LEDGER-ROU-15` | `GET /api/routines/imports/:batchId/rows` | `routine.import.manage` | `DASHBOARD` | Batch/row validation and bounded output | `E-ROUTE-DOMAIN`; Routine import tests | `DIRECT` |
| `LEDGER-ROU-16` | `PATCH /api/routines/imports/:batchId/rows/:rowId` | `routine.import.manage` | `DASHBOARD` | Central gate plus row version/selection validation | `E-ROUTE-DOMAIN`; Routine import staging tests | `DIRECT` |
| `LEDGER-ROU-17` | `POST /api/routines/imports/:batchId/apply` | `routine.import.manage` | `DASHBOARD` | Central gate plus apply/workbook/lifecycle rules; partial-success semantics preserved | `E-ROUTE-DOMAIN`; Routine import apply tests | `DIRECT` |
| `LEDGER-ROU-18` | `POST /api/routines/imports/:batchId/cancel` | `routine.import.manage` | `DASHBOARD` | Central gate plus terminal-state and batch cancellation rules | `E-ROUTE-DOMAIN`; Routine import tests | `DIRECT` |
| `LEDGER-ROU-19` | `GET /api/line/routine/tasks` | `routine.task.read` | `LIFF_SELF_SERVICE` | LIFF self-service task context; linked Employee and resource relationship | `E-ROUTE-DOMAIN`; LIFF Routine route/query tests | `DIRECT` |
| `LEDGER-ROU-20` | `POST /api/line/routine/tasks` | `routine.task.create` | `LIFF_SELF_SERVICE` | Linked Employee owns the task; client assignee/actor fields do not grant authority | `E-ROUTE-DOMAIN`; LIFF Routine self-service tests | `DIRECT` |
| `LEDGER-ROU-21` | `GET /api/line/routine/tasks/:id` | `routine.task.read` | `LIFF_SELF_SERVICE` | Creator/task-assignee/occurrence-assignee relationship and data minimization | `E-ROUTE-DOMAIN`; LIFF Routine detail tests | `DIRECT` |
| `LEDGER-ROU-22` | `PATCH /api/line/routine/tasks/:id` | `routine.task.update` | `LIFF_SELF_SERVICE` | Self-service relationship, version and current lifecycle checks | `E-ROUTE-DOMAIN`; LIFF Routine mutation tests | `DIRECT` |
| `LEDGER-ROU-23` | `DELETE /api/line/routine/tasks/:id` | `routine.task.delete` | `LIFF_SELF_SERVICE` | Self-service creator relationship and delete invariants | `E-ROUTE-DOMAIN`; LIFF Routine mutation tests | `DIRECT` |
| `LEDGER-ROU-24` | `GET /api/routines/export` | `routine.task.export` | `DASHBOARD` | Permanent default `ALL`; feature/format/2,000-row/field/audit rules | `E-ROUTE-DOMAIN`; `__tests__/api/authorization-phase-12f-routine-route-seam.test.ts`; Routine export tests | `DIRECT` |
| `LEDGER-ROU-25` | `GET /api/routines/summary` | `routine.summary.read` | `DASHBOARD` | Dashboard Mine `ASSIGNED` and All `ALL`; KPI/date/active-task predicates | `E-ROUTE-DOMAIN`; Routine summary tests | `DIRECT` |
| `LEDGER-ROU-26` | `GET /api/line/routine/summary` | `routine.summary.read` | `LIFF_SELF_SERVICE` | LIFF self-service `ASSIGNED`; bounded serializer and linked workforce | `E-ROUTE-DOMAIN`; LIFF Routine summary tests | `DIRECT` |
| `LEDGER-ROU-27` | `GET /api/routines/reference` | `routine.reference.read` | `DASHBOARD` | Default `OWN`; Dashboard reference may expand only through effective `ALL`; active Employee filtering | `E-ROUTE-DOMAIN`; Routine reference tests | `DIRECT` |
| `LEDGER-ROU-28` | `GET /api/line/routine/reference` | `routine.reference.read` | `LIFF_SELF_SERVICE` | LIFF `OWN`/self-service data minimization; no Employee list leakage | `E-ROUTE-DOMAIN`; LIFF Routine reference tests | `DIRECT` |

### 5.3 Stock — Dashboard, LIFF and presentation branches

| ID | Current entry point / branch | Capability | Actor channel | Resource/state boundary | Evidence | Classification |
|---|---|---|---|---|---|---|
| `LEDGER-STK-01` | `GET /api/stock/categories` | `stock.catalog.read` | `DASHBOARD` | Permanent catalog `ALL`; category query remains bounded by domain | `E-ROUTE-DOMAIN`; Stock route/query tests | `DIRECT` |
| `LEDGER-STK-02` | `POST /api/stock/categories` | `stock.inventory.manage` | `DASHBOARD` | Central-only `ALL`; validation and inventory mutation | `E-ROUTE-DOMAIN`; Stock route/mutation tests | `DIRECT` |
| `LEDGER-STK-03` | `DELETE /api/stock/categories` | `stock.inventory.manage` | `DASHBOARD` | Central-only `ALL`; foreign-key and inventory state rules | `E-ROUTE-DOMAIN`; Stock route/mutation tests | `DIRECT` |
| `LEDGER-STK-04` | `GET /api/stock/items` | `stock.catalog.read` | `DASHBOARD` | Permanent catalog `ALL`; filter/pagination semantics | `E-ROUTE-DOMAIN`; Stock route/query tests | `DIRECT` |
| `LEDGER-STK-05` | `POST /api/stock/items` | `stock.inventory.manage` | `DASHBOARD` | Central-only `ALL`; variant and SKU validation | `E-ROUTE-DOMAIN`; Stock route/mutation tests | `DIRECT` |
| `LEDGER-STK-06` | `PATCH /api/stock/items/:id` | `stock.inventory.manage` | `DASHBOARD` | Central-only `ALL`; item/variant locks, quantity and pending-request rules | `E-ROUTE-DOMAIN`; Stock item mutation tests | `DIRECT` |
| `LEDGER-STK-07` | `DELETE /api/stock/items/:id` | `stock.inventory.manage` | `DASHBOARD` | Central-only `ALL`; soft-delete and outstanding-state rules | `E-ROUTE-DOMAIN`; Stock item mutation tests | `DIRECT` |
| `LEDGER-STK-08` | `POST /api/stock/items/:id/adjust` | `stock.inventory.manage` | `DASHBOARD` | Central-only `ALL`; quantity/version/inventory invariants | `E-ROUTE-DOMAIN`; Stock adjustment tests | `DIRECT` |
| `LEDGER-STK-09` | `GET /api/stock/requests` | `stock.request.read` | `DASHBOARD` | `OWN`/`ALL`; requested query scope cannot broaden authority | `E-ROUTE-DOMAIN`; Stock request query tests | `DIRECT` |
| `LEDGER-STK-10` | `POST /api/stock/requests` | `stock.request.create` | `DASHBOARD` | Default `OWN`; current Employee requester, idempotency and transaction | `E-ROUTE-DOMAIN`; Stock request mutation tests | `DIRECT` |
| `LEDGER-STK-11` | `POST /api/stock/requests/:id/review` with `issue`/`approve` | `stock.request.process` | `DASHBOARD` | Central-only `ALL`; request state, stock availability and transaction | `E-ROUTE-DOMAIN`; Stock review route tests | `DIRECT` |
| `LEDGER-STK-12` | `POST /api/stock/requests/:id/review` with `reject`/`cancel` | `stock.request.cancel` | `DASHBOARD` | `OWN`/`ALL` policy plus request state and reason validation | `E-ROUTE-DOMAIN`; Stock review route tests | `DIRECT` |
| `LEDGER-STK-13` | `POST /api/stock/requests/:id/issue` | `stock.request.process` | `DASHBOARD` | Central-only `ALL`; atomic state claim, inventory availability and outbox | `E-ROUTE-DOMAIN`; Stock issue/transaction tests | `DIRECT` |
| `LEDGER-STK-14` | `POST /api/stock/requests/:id/cancel` | `stock.request.cancel` | `DASHBOARD` | `OWN`/`ALL`; current requester/state and idempotent transaction | `E-ROUTE-DOMAIN`; Stock cancellation tests | `DIRECT` |
| `LEDGER-STK-15` | `GET /api/stock/reports/export` | `stock.report.export` | `DASHBOARD` | Central-only `ALL`; report filters/serialization remain domain-owned | `E-ROUTE-DOMAIN`; Stock report tests | `DIRECT` |
| `LEDGER-STK-16` | `POST /api/uploads/image` | `stock.inventory.manage` | `DASHBOARD` | Central-only `ALL`; upload scope/file validation; preflight and immediate recheck, filesystem is not DB-atomic | `E-ROUTE-DOMAIN`; upload tests and Phase 12F structural-failure case | `DIRECT` |
| `LEDGER-STK-17` | `GET /api/line/stock/categories` | `stock.catalog.read` | `LIFF_SELF_SERVICE` | Catalog `ALL` with LIFF projection | `E-ROUTE-DOMAIN`; LIFF Stock route tests | `DIRECT` |
| `LEDGER-STK-18` | `GET /api/line/stock/items` | `stock.catalog.read` | `LIFF_SELF_SERVICE` | Active catalog `ALL`, serializer/data minimization | `E-ROUTE-DOMAIN`; LIFF Stock route tests | `DIRECT` |
| `LEDGER-STK-19` | `GET /api/line/stock/availability` | `stock.catalog.read` | `LIFF_SELF_SERVICE` | Validated variant IDs and catalog availability | `E-ROUTE-DOMAIN`; LIFF Stock route tests | `DIRECT` |
| `LEDGER-STK-20` | `GET /api/line/stock/requests` | `stock.request.read` | `LIFF_SELF_SERVICE` | Requester `OWN`; forged query authority is ignored | `E-ROUTE-DOMAIN`; LIFF Stock route tests | `DIRECT` |
| `LEDGER-STK-21` | `POST /api/line/stock/requests` | `stock.request.create` | `LIFF_SELF_SERVICE` | Linked Employee owns request; idempotency, availability and transaction | `E-ROUTE-DOMAIN`; LIFF Stock route tests | `DIRECT` |
| `LEDGER-STK-22` | `GET /api/line/stock/requests/:id` read branch | `stock.request.read` | `LIFF_SELF_SERVICE` | Owner/processor read relationship and serializer | `E-ROUTE-DOMAIN`; LIFF Stock detail tests | `DIRECT` |
| `LEDGER-STK-23` | Same request-detail response, issue-action projection | `stock.request.process` | `LIFF_SELF_SERVICE` | Presentation action only; POST issue route is the mutation authority | `E-PROJECTION`; `__tests__/api/line-stock-routes.test.ts` | `DIRECT` — `PRESENTATION_ONLY` |
| `LEDGER-STK-24` | Same request-detail response, cancel-action projection | `stock.request.cancel` | `LIFF_SELF_SERVICE` | Presentation action only; POST cancel route is the mutation authority | `E-PROJECTION`; `__tests__/api/line-stock-routes.test.ts` | `DIRECT` — `PRESENTATION_ONLY` |
| `LEDGER-STK-25` | `GET /api/line/stock/processing` queue | `stock.request.process` | `LIFF_SELF_SERVICE` | LIFF processor session, queue `ALL`, current role/workforce | `E-ROUTE-DOMAIN`; LIFF Stock processor tests | `DIRECT` |
| `LEDGER-STK-26` | Same processing response, cancel-action projection | `stock.request.cancel` | `LIFF_SELF_SERVICE` | Presentation action only; cancel mutation remains separately guarded | `E-PROJECTION`; `modules/stock/application/presentation-capabilities.test.ts` | `DIRECT` — `PRESENTATION_ONLY` |
| `LEDGER-STK-27` | `POST /api/line/stock/requests/:id/cancel` | `stock.request.cancel` | `LIFF_SELF_SERVICE` | Request ownership/state, idempotency and transaction | `E-ROUTE-DOMAIN`; LIFF Stock cancellation tests | `DIRECT` |
| `LEDGER-STK-28` | `POST /api/line/stock/requests/:id/issue` | `stock.request.process` | `LIFF_SELF_SERVICE` | Current LIFF processor authority, request state, availability and transaction | `E-ROUTE-DOMAIN`; LIFF Stock processor tests | `DIRECT` |

### 5.4 Leave — generic capability boundaries

| ID | Current entry point | Capability | Actor channel | Relationship/workflow boundary | Evidence | Classification |
|---|---|---|---|---|---|---|
| `LEDGER-LEV-01` | `GET /api/leave/me` | `leave.request.read` | `DASHBOARD` | Owner `OWN`; pagination, filters, deleted/lifecycle semantics | `E-ROUTE-DOMAIN`; Leave query tests | `DIRECT` |
| `LEDGER-LEV-02` | `GET /api/leave/approvals` | `leave.approval.read` | `DASHBOARD` | Effective assigned approver workload and pagination | `E-ROUTE-DOMAIN`; Leave approval query tests | `DIRECT` |
| `LEDGER-LEV-03` | `GET /api/leave/approvers` | `leave.approver.manage` | `DASHBOARD` | Central-only `ALL`; active approver/account lifecycle rules | `E-ROUTE-DOMAIN`; Leave approver tests | `DIRECT` |
| `LEDGER-LEV-04` | `PUT /api/leave/approvers` | `leave.approver.manage` | `DASHBOARD` | Central-only `ALL`; self-assignment, pending-request conflict and atomic writes | `E-ROUTE-DOMAIN`; Leave approver assignment tests | `DIRECT` |
| `LEDGER-LEV-05` | `POST /api/leave/request` | `leave.request.create` | `DASHBOARD` | Owner `OWN`; quota/date/overlap/notification and idempotency rules | `E-ROUTE-DOMAIN`; Leave request tests | `DIRECT` |
| `LEDGER-LEV-06` | `POST /api/leave/cancel` | `leave.request.cancel` | `DASHBOARD` | Owner/state/transition and current workforce revalidation | `E-ROUTE-DOMAIN`; Leave cancellation tests | `DIRECT` |
| `LEDGER-LEV-07` | `PUT /api/leave/cancel` | `leave.cancellation.decide` | `DASHBOARD` | Assigned/effective approver, exception precedence, owner exclusion and workflow state | `E-ROUTE-DOMAIN`; Leave cancellation-decision tests | `DIRECT` |
| `LEDGER-LEV-08` | `POST /api/leave/decision` | `leave.request.approve` | `DASHBOARD` | Assigned/effective approver, exception precedence, state/quota and atomic transition | `E-ROUTE-DOMAIN`; Leave approval tests | `DIRECT` |
| `LEDGER-LEV-09` | `POST /api/leave/not-taken` | `leave.request.not_taken` | `DASHBOARD` | Owner `OWN` or domain-approved recovery relationship; state/date rules | `E-ROUTE-DOMAIN`; Leave not-taken tests | `DIRECT` |
| `LEDGER-LEV-10` | `PUT /api/leave/not-taken` | `leave.request.not_taken` | `DASHBOARD` | Assigned/effective approver or explicit Dashboard ADMIN recovery; owner exclusion/state | `E-ROUTE-DOMAIN`; Leave not-taken tests | `DIRECT` |
| `LEDGER-LEV-11` | `GET /api/line/leave/me` | `leave.request.read` | `LIFF_SELF_SERVICE` | Linked Employee owner `OWN` | `E-ROUTE-DOMAIN`; LIFF Leave tests | `DIRECT` |
| `LEDGER-LEV-12` | `GET /api/line/leave/approvals` | `leave.approval.read` | `LIFF_SELF_SERVICE` | Effective assigned approver relationship | `E-ROUTE-DOMAIN`; LIFF Leave tests | `DIRECT` |
| `LEDGER-LEV-13` | `POST /api/line/leave/request` | `leave.request.create` | `LIFF_SELF_SERVICE` | Linked Employee owner; client actor fields cannot change ownership | `E-ROUTE-DOMAIN`; LIFF Leave tests | `DIRECT` |
| `LEDGER-LEV-14` | `POST /api/line/leave/cancel` | `leave.request.cancel` | `LIFF_SELF_SERVICE` | Linked Employee owner/state; unrelated-owner denial | `E-ROUTE-DOMAIN`; Phase 11C.2C.2 and Phase 12F direct route tests | `DIRECT` |
| `LEDGER-LEV-15` | `POST /api/line/leave/decision` | `leave.request.approve` | `LIFF_SELF_SERVICE` | Effective assigned approver and workflow state | `E-ROUTE-DOMAIN`; LIFF Leave approval tests | `DIRECT` |
| `LEDGER-LEV-16` | `POST /api/line/leave/not-taken` | `leave.request.not_taken` | `LIFF_SELF_SERVICE` | Owner `OWN`; no generic recovery override | `E-ROUTE-DOMAIN`; Phase 11C.2C.2 and Phase 12F direct route tests | `DIRECT` |
| `LEDGER-LEV-17` | `PUT /api/line/leave/not-taken` | `leave.request.not_taken` | `LIFF_SELF_SERVICE` | Effective assigned approver; `allowAdminOverride: false` | `E-ROUTE-DOMAIN`; Phase 11C.2C.2 and Phase 12F direct route tests | `DIRECT` |

### 5.5 Audit and ledger arithmetic

| ID | Current entry point | Capability | Actor channel | Boundary | Evidence | Classification |
|---|---|---|---|---|---|---|
| `LEDGER-AUD-01` | `GET /api/audit-logs` | `audit.read` | `DASHBOARD` | Central-only `ALL`; query filters and audit serialization remain domain-owned; no role-based bypass | `E-ROUTE-DOMAIN`; Audit authorization/query tests | `DIRECT` |
| `LEDGER-NOT-01` | `GET /api/notifications` | `notification.inbox.read` | `DASHBOARD` | Current actor `OWN` only | `E-ROUTE-DOMAIN`; Notification query tests | `DIRECT` |
| `LEDGER-NOT-02` | `GET /api/notifications/all` | `notification.inbox.read` | `DASHBOARD` | Current actor `OWN` only; history cursor/pagination remains bounded | `E-ROUTE-DOMAIN`; Notification query tests | `DIRECT` |
| `LEDGER-NOT-03` | `PATCH /api/notifications/:id/read` | `notification.inbox.update` | `DASHBOARD` | Current actor `OWN`; target notification user is server-side | `E-ROUTE-DOMAIN`; Notification command tests | `DIRECT` |
| `LEDGER-NOT-04` | `POST /api/notifications/mark-all-read` | `notification.inbox.update` | `DASHBOARD` | Current actor `OWN`; no arbitrary target user selection | `E-ROUTE-DOMAIN`; Notification command tests | `DIRECT` |

Ledger totals reconcile exactly:

| Domain/family | Rows |
|---|---:|
| Employee | 7 |
| Department | 1 |
| Routine | 28 |
| Stock | 28 |
| Leave | 17 |
| Audit | 1 |
| Notification | 4 |
| **Current operation ledger** | **86** |
| Protected migrated route/capability rows | 83 |
| Stock presentation-only projection rows | 3 |

Arithmetic: `86 = 7 + 1 + 28 + 28 + 17 + 1 + 4`; `86 = 83 + 3`.
Every protected migrated row is `DIRECT`; the three non-authoritative Stock
rows are `DIRECT` presentation evidence and are not used as server security
boundaries.

## 6. Authorization Administration operation ledger

Inventory นี้มาจาก current handlers ใน `app/api/authorization/administration/**`
โดยนับหนึ่ง row ต่อ meaningful route/command boundary. ทุก route ใช้
`requireAdminSession` และ
`requireAuthorizationAdministrationApiSession`; mutation application tests
ตรวจ validation, transaction และ audit semantics ต่อใน lower application seam.

| ID | Current endpoint / command | Security claim | Evidence | Classification |
|---|---|---|---|---|
| `LEDGER-ADM-01` | `GET /api/authorization/administration` overview | ADMIN-only; target data is inspection data, never operator actor | `E-ADMIN-SEAM`; `modules/authorization/application/administration.test.ts` | `DIRECT` |
| `LEDGER-ADM-02` | `POST /api/authorization/administration` Team create | ADMIN-only; validated Team input and atomic mutation | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |
| `LEDGER-ADM-03` | `GET /api/authorization/administration/teams/:id` | ADMIN-only Team detail; inactive Team remains inspectable, not authoritative | `E-ADMIN-SEAM`; `administration.test.ts` | `DIRECT` |
| `LEDGER-ADM-04` | `PATCH /api/authorization/administration/teams/:id` | ADMIN-only update; path `id` is target Team, not actor | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |
| `LEDGER-ADM-05` | `POST /api/authorization/administration/teams/:id/roles` | ADMIN-only TeamRole creation; Team target and input are validated | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |
| `LEDGER-ADM-06` | `PATCH /api/authorization/administration/teams/:id/roles/:roleId` | ADMIN-only TeamRole update; both path IDs are targets | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |
| `LEDGER-ADM-07` | `POST /api/authorization/administration/teams/:id/members` | ADMIN-only membership add; target User/Team are not trusted actor fields | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |
| `LEDGER-ADM-08` | `PATCH /api/authorization/administration/teams/:id/members/:userId` | ADMIN-only membership role change; target IDs are separated from trusted principal | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |
| `LEDGER-ADM-09` | `DELETE /api/authorization/administration/teams/:id/members/:userId` | ADMIN-only membership removal; atomic/audited command | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |
| `LEDGER-ADM-10` | `POST /api/authorization/administration/teams/:id/grants` | ADMIN-only Team grant; registry/scope/origin validated and no direct USER TEAM origin | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |
| `LEDGER-ADM-11` | `DELETE /api/authorization/administration/teams/:id/grants` | ADMIN-only Team grant removal; only selected source is revoked | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |
| `LEDGER-ADM-12` | `POST /api/authorization/administration/teams/:id/roles/:roleId/grants` | ADMIN-only TeamRole grant; Team and TeamRole origin are validated | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |
| `LEDGER-ADM-13` | `DELETE /api/authorization/administration/teams/:id/roles/:roleId/grants` | ADMIN-only TeamRole grant removal; source provenance is preserved | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |
| `LEDGER-ADM-14` | `GET /api/authorization/administration/users` directory | ADMIN-only; inactive/deleted users follow current inspection/query policy | `E-ADMIN-SEAM`; `administration.test.ts` | `DIRECT` |
| `LEDGER-ADM-15` | `GET /api/authorization/administration/users/:id` detail + Effective Access | ADMIN-only; target User ID is not actor ID; invalid config is fail-closed | `E-ADMIN-SEAM`; `administration.test.ts`; `UserAccessPanel.test.tsx` | `DIRECT` |
| `LEDGER-ADM-16` | `POST /api/authorization/administration/users/:id/grants` | ADMIN-only direct User grant; capability/scope/origin validation and atomic write | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |
| `LEDGER-ADM-17` | `DELETE /api/authorization/administration/users/:id/grants` | ADMIN-only direct User grant removal; no default-grant persistence | `E-ADMIN-SEAM`; `administration-mutations.test.ts` | `DIRECT` |

Administration ledger arithmetic: `17 = 17 DIRECT + 0 INDIRECT + 0 MISSING +
0 N/A`. The inspector is an operator-facing read model; it does not replace
the authorization boundary of any domain route.

## 7. Cross-cutting security regression matrix

Evidence notation used below:

- `E-CORE`: `modules/authorization/registry.test.ts`, `modules/authorization/application/{resolver,composition,grant-validation}.test.ts` and direct source inspection; evaluator behavior is exercised through resolver/composition tests.
- `E-AUTH`: `__tests__/auth/**`, `__tests__/api/**` session/workforce tests, `modules/auth/application/sessions.test.ts`, `__tests__/auth/liff.test.ts` and `__tests__/api/line-auth-routes.test.ts`.
- `E-ROUTE-SEAM`: the 83-case `authorization-phase-12f-routine-route-seam.test.ts` plus the exact current handler imports listed in Section 5.
- `E-ADMIN-SEAM`: the 3-test `authorization-phase-12f-administration-route-seam.test.ts` plus current Administration application tests.
- `E-DOMAIN`: current domain authorization/query/mutation/presentation tests in Employee, Department, Notification, Routine, Stock, Leave and Audit.
- `E-TX`: current transaction/current-state tests in Employee mutations, Routine authorization/queries, Stock mutations, Leave authorization/mutations and resolver transaction tests.
- `E-PRESENTATION`: `UserAccessPanel.test.tsx`, Stock presentation capability tests and domain Dashboard/LIFF projection tests.
- `E-INSPECTOR`: `modules/authorization/application/administration.test.ts` and `modules/authorization/presentation/dashboard/components/UserAccessPanel.test.tsx`.
- `E-ARCH`: `npm run architecture:check`, `scripts/check-architecture.mjs`, direct import-graph inspection and architecture documentation.

| ID | Regression invariant | Current evidence | Classification |
|---|---|---|---|
| `SEC-01` | Missing/invalid Dashboard session is denied before protected operation | `E-AUTH`; route/auth tests | `DIRECT` |
| `SEC-02` | Inactive User is denied by current session/workforce state | `E-AUTH`; session tests | `DIRECT` |
| `SEC-03` | Deleted User is denied and cannot act from stale session | `E-AUTH`; session tests | `DIRECT` |
| `SEC-04` | Inactive Employee is denied where workforce is required | `E-AUTH`; workforce and route tests | `DIRECT` |
| `SEC-05` | Deleted Employee is denied where workforce is required | `E-AUTH`; workforce and domain route tests | `DIRECT` |
| `SEC-06` | Invalid LIFF identity/token claims fail closed | `E-AUTH`; LIFF session tests | `DIRECT` |
| `SEC-07` | LIFF unlinked identity cannot create a workforce actor | `E-AUTH`; LIFF session route tests | `DIRECT` |
| `SEC-08` | LIFF linked but inactive workforce is denied | `E-AUTH`; LIFF/workforce tests | `DIRECT` |
| `SEC-09` | `userId`, `employeeId`, `systemRole` and `channel` come from server/session construction | `E-AUTH`; actor-builder tests; `E-ROUTE-SEAM` | `DIRECT` |
| `SEC-10` | Request body/query/route target/arbitrary headers/client state/inspector input cannot supply actor identity | `E-ADMIN-SEAM`, `E-AUTH`, domain route tests | `DIRECT` |
| `SEC-11` | Unknown capability is structurally denied | `E-CORE`; registry/resolver tests | `DIRECT` |
| `SEC-12` | Capability mismatch is rejected at composition boundary | `E-CORE`; composition tests | `DIRECT` |
| `SEC-13` | Unsupported channel is denied as channel-unsupported, not as ordinary no-grant | `E-CORE`; channel tests; `E-ROUTE-SEAM` | `DIRECT` |
| `SEC-14` | Invalid persisted capability fails closed | `E-CORE`; grant validation tests; `E-ROUTE-SEAM` | `DIRECT` |
| `SEC-15` | Unsupported persisted scope fails closed | `E-CORE`; grant validation tests; `E-ROUTE-SEAM` | `DIRECT` |
| `SEC-16` | Invalid Team grant origin is rejected | `E-CORE`; resolver/composition tests | `DIRECT` |
| `SEC-17` | TeamRole origin/membership mismatch is rejected | `E-CORE`; resolver tests | `DIRECT` |
| `SEC-18` | Direct USER TEAM scope without origin is rejected | `E-CORE`; resolver/composition tests | `DIRECT` |
| `SEC-19` | Structural error is distinct from `NO_APPLICABLE_GRANT` and never receives default fallback | `E-CORE`; all domain structural-denial tests | `DIRECT` |
| `SEC-20` | Department `department.read` no-grant default is `ALL` | `E-DOMAIN`; Department authorization tests | `DIRECT` |
| `SEC-21` | Employee read/stats/export broad defaults are deliberate and preserve filtering, exclusions and export limits | `E-DOMAIN`; Employee authorization/query/export tests | `DIRECT` |
| `SEC-22` | Notification inbox read/update remain current-actor `OWN` only | `E-DOMAIN`; Notification authorization/query/command tests | `DIRECT` |
| `SEC-23` | Routine default policy is context-sensitive across management, work-item, summary, reference, export and self-service | `E-DOMAIN`; Routine authorization/queries tests | `DIRECT` |
| `SEC-24` | Stock catalog/request defaults are `ALL`/`OWN` as domain adapters define; management/process/report remain central-only | `E-DOMAIN`; Stock authorization/presentation tests | `DIRECT` |
| `SEC-25` | Leave generic defaults preserve owner/assigned/workflow relationships; approver management remains central-only | `E-DOMAIN`; Leave authorization tests | `DIRECT` |
| `SEC-26` | ADMIN has empty Default Domain Policy and authority source is `SYSTEM_ROLE` where supported | `E-CORE`, `E-DOMAIN`; ADMIN tests | `DIRECT` |
| `SEC-27` | No default grant is persisted and no fake `DEFAULT_POLICY` grant is exposed as configured provenance | `E-CORE`, `E-ADMIN-SEAM`, persistence shape tests | `DIRECT` |
| `SEC-28` | No configured grant leaves normal USER Default Domain Policy active | `E-CORE`, `E-DOMAIN`, `E-INSPECTOR` | `DIRECT` |
| `SEC-29` | Narrower configured grant cannot narrow default authority | `E-CORE`; composition/domain tests | `DIRECT` |
| `SEC-30` | Broader configured grant expands effective authority where domain policy/channel permits | `E-CORE`, `E-DOMAIN`, `E-INSPECTOR` | `DIRECT` |
| `SEC-31` | Redundant configured grant remains visible but does not alter effective scope | `E-CORE`, `E-INSPECTOR`, `UserAccessPanel.test.tsx` | `DIRECT` |
| `SEC-32` | Multiple Team, TeamRole and direct User sources union correctly | `E-CORE`; resolver/administration tests | `DIRECT` |
| `SEC-33` | Revoking one configured source removes only that source | `E-CORE`, `E-ADMIN-SEAM`, administration mutation tests | `DIRECT` |
| `SEC-34` | Revoking all configured sources restores Default Domain Policy | `E-CORE`, `E-ADMIN-SEAM`, administration mutation tests | `DIRECT` |
| `SEC-35` | Provenance retains `TEAM`, `TEAM_ROLE`, `USER` and `SYSTEM_ROLE` source types | `E-CORE`, `E-INSPECTOR` | `DIRECT` |
| `SEC-36` | TEAM retains origin `teamId` and constraint; Department/manager/position/job title do not infer Team authority | `E-CORE`, `E-DOMAIN`, domain model/source inspection | `DIRECT` |
| `SEC-37` | Inactive Team/TeamRole, removed membership and revoked grants disappear on fresh resolution | `E-CORE`, `E-TX`, administration lifecycle tests | `DIRECT` |
| `SEC-38` | OWN/CREATED/ASSIGNED/TEAM/ALL remain inputs to domain/resource predicates, not replacement policy | `E-DOMAIN`; query predicate tests | `DIRECT` |
| `SEC-39` | ALL does not bypass lifecycle, workflow, validation, channel or transaction constraints | `E-DOMAIN`, `E-TX`, route tests | `DIRECT` |
| `SEC-40` | Routine Dashboard task read distinguishes management, work-item mine and work-item all | `E-DOMAIN`; Routine query/authorization tests; `E-ROUTE-SEAM` | `DIRECT` |
| `SEC-41` | Routine Dashboard/LIFF summary distinguishes mine/all and self-service context | `E-DOMAIN`; summary provider/route tests; `E-ROUTE-SEAM` | `DIRECT` |
| `SEC-42` | Routine Dashboard/LIFF reference obeys OWN/data-minimization policy | `E-DOMAIN`, `E-PRESENTATION`; route tests | `DIRECT` |
| `SEC-43` | Routine LIFF clamps configured ALL/ADMIN where policy requires and rejects unsupported LIFF export | `E-DOMAIN`; Routine authorization tests; `E-ROUTE-SEAM` | `DIRECT` |
| `SEC-44` | Stock Dashboard and LIFF semantics are audited separately | `E-DOMAIN`, `E-ROUTE-SEAM`; Stock route/presentation tests | `DIRECT` |
| `SEC-45` | Stock LIFF processor/system/configured authority follows Stock policy and is not copied from Routine | `E-DOMAIN`; Stock presentation and processor tests | `DIRECT` |
| `SEC-46` | Stock ownership, state, availability, idempotency and concurrency remain separate domain invariants | `E-DOMAIN`, `E-TX`; Stock mutation/concurrency tests | `DIRECT` |
| `SEC-47` | Leave owner, effective approver, exception precedence, owner exclusion and workflow state remain authoritative | `E-DOMAIN`, `E-TX`; Leave tests | `DIRECT` |
| `SEC-48` | LIFF cancellation-decision exception is separately protected by current domain/server-action policy | `E-DOMAIN`, `E-ROUTE-SEAM`; LIFF Leave tests | `DIRECT` |
| `SEC-49` | Generic capability migration is not claimed for Leave report/export, participant/detail, attachments or recovery; bespoke server protection is audited separately | `E-DOMAIN`; exact Leave route/source inspection in Section 16 | `N/A` |
| `SEC-50` | Every Administration route is ADMIN-only; target IDs, validation, registry/scope/origin rules and atomic claims are server-enforced | `E-ADMIN-SEAM`, `E-CORE`; administration tests | `DIRECT` |
| `SEC-51` | Presentation visibility/action availability never serves as the only server authorization | `E-PRESENTATION`, `E-ROUTE-SEAM`, `E-ADMIN-SEAM` | `DIRECT` |
| `SEC-52` | Effective Access keeps Default, Additional and Effective separate | `E-INSPECTOR`; application and UserAccessPanel tests | `DIRECT` |
| `SEC-53` | Inspector reports AVAILABLE/UNAVAILABLE/UNSUPPORTED/DEFERRED/INVALID_CONFIGURATION correctly, preserves contexts and does not claim resource/workflow/link/lifecycle success | `E-INSPECTOR`; provider/source inspection | `DIRECT` |
| `SEC-54` | Email Request is not claimed as migrated central authorization; its explicit deferred boundary remains separately documented/tested | `E-DOMAIN`; current Email route/source inspection in Section 16 | `N/A` |
| `SEC-55` | Architecture aggregate has no domain import into authorization core, no client import of server auth, no new persistence/default grant layer, and Team != Department | `E-ARCH`; architecture check plus direct source inspection | `INDIRECT` — aggregate architecture claim; evidence covers import rules and representative source paths. Exhaustive proof beyond the repository checker is optional for 12F; the checker is the mandatory guard. |
| `SEC-56` | One blanket transaction-wide revalidation guarantee exists for every operation | Current transaction inventory in Section 13 | `N/A` — Phase 12F does not claim this stronger invariant; each operation records only the locks/re-reads actually implemented. |
| `SEC-57` | All possible stale-state interleavings are exhaustively proven | `E-AUTH`, `E-TX`, stale-role/lifecycle/assignment/revocation representative tests | `INDIRECT` — representative stale-state transitions are direct, but exhaustive concurrency/interleaving proof is outside the current contract and optional for 12F. |
| `SEC-58` | No active compatibility authorization bypass remains in current production runtime | `E-CORE`, `E-ROUTE-SEAM`, current production source grep/inspection; historical names listed in Section 17 | `DIRECT` |

Cross-cutting arithmetic: `58 = 53 DIRECT + 2 INDIRECT + 0 MISSING + 3 N/A`.
The two INDIRECT rows state why stronger evidence is not mandatory for the
current contract. The three N/A rows explicitly scope out a stronger generic
claim; they do not hide a protected migrated operation.

## 8. Permanent Default Domain Policy

The resolver's `NO_APPLICABLE_GRANT` result is intentionally composed with a
domain-provided default for eligible normal USER actors. This is permanent
Phase 12 runtime behavior: it is not a compatibility fallback, it does not
create a persisted grant, and it is not used for structural errors,
unsupported channels, invalid persisted configuration or ADMIN authority.

| Domain / context | Capability boundary | No-configured-grant default verified from current adapter | Domain constraint that remains after default |
|---|---|---|---|
| Department | `department.read` | `ALL` | query filters, pagination and current route validation |
| Employee | `employee.read`, `employee.stats.read`, `employee.export` | `ALL` | deleted Employee filtering, bootstrap/system exclusions where applicable, pagination/filter/export limits |
| Employee | `employee.create`, `employee.update`, `employee.delete`, `employee.import` | empty | Central Only; lifecycle and mutation validation |
| Notification | `notification.inbox.read`, `notification.inbox.update` | `OWN` | current actor owns the inbox; arbitrary target User selection is not permitted |
| Routine Dashboard management | `routine.task.read` | `CREATED + ASSIGNED` | task/resource predicates and management context |
| Routine Dashboard work-item mine | `routine.task.read` | `ASSIGNED` | current employee assignment |
| Routine Dashboard work-item all | `routine.task.read` | `ALL` | workflow, lifecycle, query filters and transaction rules |
| Routine | `routine.task.create` | `OWN` | creator/current actor, validation and transaction |
| Routine | `routine.task.update` | `CREATED + ASSIGNED` | creator/assignee predicates and workflow |
| Routine | `routine.task.delete` | `CREATED` | creator, lifecycle and transaction |
| Routine | `routine.occurrence.read` | `ASSIGNED` | occurrence assignee and lifecycle |
| Routine | `routine.occurrence.override`, `.reassign`, `.change_due_date`, `routine.import.manage` | empty | Central Only; operation-specific validation/transaction |
| Routine | `routine.task.export` | `ALL` on Dashboard | export filters/limits and Dashboard-only channel |
| Routine Dashboard summary | `routine.summary.read` | mine `ASSIGNED`; all `ALL` | server-owned context mapping; serializer bounded by context |
| Routine reference | `routine.reference.read` | `OWN` | reference data minimization; LIFF self-service clamp |
| Stock | `stock.catalog.read` | `ALL` | catalog/category/variant validation and response bounds |
| Stock | `stock.request.read`, `stock.request.create`, `stock.request.cancel` | `OWN` | requester ownership, request state, availability, idempotency and transaction |
| Stock | `stock.inventory.manage`, `stock.request.process`, `stock.report.export` | empty | Central Only; current channel and workflow rules |
| Leave | `leave.request.read`, `.create`, `.cancel` | `OWN` | owner, lifecycle, dates/quota/overlap and workflow |
| Leave | `leave.approval.read`, `leave.request.approve` | `ASSIGNED` | effective approver, exception precedence, owner exclusion and state |
| Leave Dashboard | `leave.cancellation.decide` | `ASSIGNED` | effective approver and cancellation workflow; LIFF is unsupported by registry and has a separate exception path |
| Leave | `leave.request.not_taken` | `OWN + ASSIGNED` | owner/approver relationship, recovery policy and state |
| Leave | `leave.approver.manage` | empty | Central Only; active approver assignment and atomicity |
| Audit | `audit.read` | empty | Central Only; audit query/serialization policy |

Direct source/test support: Department `authorization.test.ts`; Employee
`application/authorization.test.ts` and query/export tests; Notification
`application/authorization.test.ts`; Routine `application/authorization.test.ts`
and `queries.test.ts`; Stock authorization/presentation tests; Leave
authorization/query/mutation tests; Audit authorization tests; plus the
83-case route seam. These tests assert no-grant defaults directly and also
assert structural failures do not bridge into a default.

The broad Employee and Department defaults are intentional current product
policy. Phase 12F records them as a regression requirement and does not narrow
them. Any future narrowing is a separate policy decision, not an audit fix.

## 9. Configured additive authority

The composition boundary unions configured USER authority with the applicable
Default Domain Policy. There is no explicit DENY or deny precedence in this
contract.

| Scenario | Expected current result | Direct evidence |
|---|---|---|
| USER with no grant | Default remains available where domain adapter supplies it; configured grant list remains empty | `composition.test.ts`, domain authorization tests, `administration.test.ts` |
| Narrower configured grant | Cannot reduce default scopes; effective result is union | `composition.test.ts`, Routine/Employee/Stock/Leave tests |
| Broader configured grant | Expands effective scopes only where registry/channel/domain policy permits | `composition.test.ts`, resolver/inspector tests |
| Redundant configured grant | Visible as Additional/provenance but effective scopes do not change | `composition.test.ts`, `administration.test.ts`, `UserAccessPanel.test.tsx` |
| Multiple Team + TeamRole + User sources | Supported scopes union; each source remains separately represented | resolver and administration tests |
| Revoke one source | Only that source disappears; other sources/default remain | administration mutation tests and resolver tests |
| Revoke all configured sources | Configured authority becomes empty and normal USER default is restored | administration mutation tests and composition tests |
| ADMIN | Default empty; SYSTEM_ROLE authority is evaluated separately; persisted USER grants are not used as ADMIN authority | resolver/composition/inspector tests |
| Invalid configured data | Structural invalidity is surfaced as error/invalid configuration, never converted to a permissive default | grant-validation, composition, route-seam and inspector tests |

`Default`, `Additional` and `Effective` are distinct data in both the
application result and inspector read model. No `DEFAULT_POLICY` grant row is
persisted and no source is fabricated to make default authority look like an
administrative grant.

## 10. Grant provenance and TEAM origin

Resolver output and Effective Access retain the authority source rather than
collapsing all grants into one scope list:

| Source | Required provenance | Phase 12F result |
|---|---|---|
| `SYSTEM_ROLE` | `role` (currently ADMIN where the capability supports it) | Preserved; ADMIN is not inferred from `ALL`. |
| `TEAM` | `origin.teamId`, and for TEAM-scoped authority `constraint.teamId` | Preserved and checked against the originating Team. |
| `TEAM_ROLE` | `origin.teamId`, `origin.teamRoleId`, and matching TeamRole membership | Preserved; mismatched membership is structural failure. |
| `USER` | `origin.userId` | Preserved; a direct USER grant cannot manufacture a TEAM origin. |

Direct resolver, composition, administration and inspector tests prove source
union and provenance. In particular, the following are deliberately not
authorization substitutions:

```text
Department != Team
manager != Team
position != Team
job title != Team
```

No implicit Team membership, Team origin, Team constraint or Team authority is
inferred from those business relationships. A direct USER `TEAM` scope without
an origin fails closed; a Team grant whose retained origin does not match the
Team constraint also fails closed.

## 11. Grant lifecycle and revocation

Fresh resolver evaluation reads the current applicable sources. The regression
matrix covers these transitions:

| Transition | Required result | Evidence |
|---|---|---|
| Team becomes inactive | Team-sourced authority is skipped on fresh resolution; inactive Team may remain inspectable in Administration | resolver lifecycle tests; `administration.test.ts` |
| TeamRole becomes inactive | TeamRole-sourced authority is skipped | resolver tests |
| User membership is removed | Team/TeamRole source no longer applies | resolver and Administration mutation tests |
| User TeamRole changes | Previous role source disappears; new matching source is evaluated | resolver provenance/membership tests |
| Team grant revoked | That grant disappears, other sources/default remain | mutation and resolver tests |
| TeamRole grant revoked | That grant disappears, other sources/default remain | mutation and resolver tests |
| direct User grant revoked | Direct source disappears, other sources/default remain | mutation and resolver tests |
| all configured sources revoked | Configured authority is empty and normal USER default is recomposed | composition and mutation tests |

The resolver does not claim to lock the entire authorization configuration
across arbitrary concurrent commits. `SEC-37` proves fresh applicability, not
an unimplemented snapshot/isolation guarantee.

## 12. Domain, scope and channel matrices

### 12.1 Scope is not a resource predicate

Production scopes are `OWN`, `CREATED`, `ASSIGNED`, `TEAM` and `ALL`.
Capability scope selects an authority envelope; the domain adapter still
constructs predicates and enforces lifecycle/workflow/transaction invariants.

| Scope/policy | Domain predicate retained |
|---|---|
| Notification `OWN` | Notification recipient/current actor only; target notification User is never client-selected. |
| Stock `OWN` | Request requester/current linked workforce; request state, availability, idempotency and concurrency remain authoritative. |
| Routine `CREATED` | Task/occurrence creator predicate; update/delete workflow and lifecycle still apply. |
| Routine `ASSIGNED` | Task/occurrence assignee predicate; work-item context and current assignment still apply. |
| Routine `TEAM` | Originating Team constraint is retained and checked against the resource; no implicit organizational mapping. |
| Leave `OWN` | Leave owner/current employee; owner state, dates/quota/overlap and transition rules remain. |
| Leave `ASSIGNED` | Effective approver/assignment relationship; arbitrary approver identity is not equivalent. |
| `ALL` | Broad capability scope only; it does not bypass validation, lifecycle, workflow, channel policy, ownership exceptions, availability or transaction/concurrency checks. |

Direct query/mutation tests assert the resulting resource predicates rather
than only checking a scope constant. This is why a broad capability default is
not treated as an unconditional bypass.

### 12.2 Routine context-sensitive policy

Routine is not reduced to one capability-only row. Current contexts are
server-owned:

| Context | Current policy and direct evidence |
|---|---|
| Dashboard management task read | `routine.task.read` maps to `CREATED + ASSIGNED`; query predicates remain creator/assignee bounded. `modules/routine/application/authorization.test.ts` and `queries.test.ts`. |
| Dashboard work-item mine | `routine.task.read` maps to `ASSIGNED`; the requested mine context cannot be changed into all by a client scope field. |
| Dashboard work-item all | `routine.task.read` maps to `ALL`; broad view still passes workflow/lifecycle/query rules. |
| LIFF task self-service | LIFF actor/workforce is server-derived; task create/read/update/delete use self-service resource rules and omit management/import fields. |
| Dashboard summary mine | `routine.summary.read` maps to `ASSIGNED`. |
| Dashboard summary all | `routine.summary.read` maps to `ALL` through a Dashboard server context, not raw client scope. |
| LIFF summary self-service | Summary is clamped to the LIFF self-service policy even when configured authority or ADMIN could be broader in the central resolver. |
| Dashboard reference | `routine.reference.read` uses Dashboard `OWN` default and bounded reference response. |
| LIFF reference | `routine.reference.read` remains self-service/data-minimized; serializer does not expose Dashboard management data. |
| Dashboard task export | `routine.task.export` is Dashboard-only and defaults to `ALL` subject to export filters/limits. |
| LIFF export | Registry channel support rejects it; it is `UNSUPPORTED`, not a normal no-grant result. |

Direct current route coverage is `LEDGER-ROU-24`–`LEDGER-ROU-28`; current
Routine adapter tests cover context mapping, configured additive authority,
ADMIN role source, LIFF clamping and export channel denial.

### 12.3 Stock channel semantics

Stock intentionally differs from Routine. The Stock LIFF processor path uses
its own current Stock policy; it is not assigned Routine's LIFF ADMIN clamp.

| Stock surface | Dashboard | LIFF self-service |
|---|---|---|
| Catalog | `stock.catalog.read`, default `ALL` | Same registered catalog capability and server-derived linked workforce. |
| Request read | `stock.request.read`, default `OWN` unless configured authority expands | Requester-owned read; serializer/resource relationship remains authoritative. |
| Request create | `stock.request.create`, requester `OWN` | Linked Employee creates for self; payload cannot choose another actor. |
| Request cancel | `stock.request.cancel`, owner/state checks | Same owner/state checks; separate LIFF route and current identity boundary. |
| Request process/issue | `stock.request.process`, central-only Dashboard | LIFF processor/system/configured authority as implemented by Stock; current role/workforce and request state are rechecked. |
| Inventory management | `stock.inventory.manage`, central-only | Unsupported by registry/route policy. |
| Report export | `stock.report.export`, central-only Dashboard | Unsupported by registry/route policy. |

Direct Stock route and presentation tests cover Dashboard/LIFF separation,
LIFF processor authority, requester ownership, state transitions, inventory
availability, idempotency and serializable/concurrency paths. The image upload
route and LIFF processor helper now convert malformed authorization
configuration into a sanitized 500 response after logging only safe error
metadata; structural failure cannot escape as an unhandled permissive path.

### 12.4 Leave relationship and workflow semantics

| Boundary | Current protection and evidence |
|---|---|
| Owner read/create/cancel | `leave.request.read/create/cancel` + current Employee owner/resource/state rules; Dashboard and LIFF are separate route seams. |
| Approval read/decision | `leave.approval.read` / `leave.request.approve` + effective approver relationship, exception precedence, owner exclusion and workflow state. `ASSIGNED` is not arbitrary approver authority. |
| Cancellation decision | Dashboard generic `leave.cancellation.decide` uses effective approver/state policy. The LIFF `PUT /api/line/leave/cancel` exception is separately domain-protected and intentionally not represented as LIFF support for the registered capability. |
| Not-taken request/decision | `leave.request.not_taken` uses owner/assigned relationship and state; Dashboard ADMIN recovery override is explicit and not available in LIFF. |
| Approver management | `leave.approver.manage` is Dashboard central-only; assignment, self-assignment and pending-request/atomicity rules remain domain-owned. |
| Exception approver | Current effective approver/exception precedence supersedes the original approver where the domain says so. Stale approver relationship is re-evaluated. |

The following current Leave endpoints are intentionally domain-owned and
unregistered. They are still protected and audited; absence of a generic key
is not treated as automatic migration failure:

| Surface | Current protection | Why no generic key / future status | Evidence |
|---|---|---|---|
| `GET /api/leave/export` | Active Dashboard workforce session plus current employee-scoped report query, schema, year/format validation, row limit and audit logging | Report/export remains Leave domain-owned; no new generic capability is invented in 12F | route/source inspection; Leave report tests |
| `GET /api/leave/admin/recovery` | Active workforce session plus persisted ADMIN role and domain recovery query | Recovery is an explicit Leave workflow exception, not generic `ASSIGNED` | route/source inspection; Leave management tests |
| `GET /api/leave/attachments/:attachmentId` | Active workforce or ADMIN session plus authorized attachment viewer predicate and private no-store response | Attachment relationship is resource-owned and unregistered | route/source inspection; attachment tests |
| `GET /api/line/leave/attachments/:id` | Verified linked LIFF workforce plus employee-scoped attachment lookup | LIFF attachment relationship/data minimization is domain-owned | route/source inspection; LIFF client/domain tests |
| `GET /api/line/leave/requests/:id` | Verified linked LIFF workforce plus employee-scoped authorized detail lookup and minimized serializer | Participant/detail relationship is domain-owned | route/source inspection; Leave detail tests |
| `PUT /api/line/leave/cancel` | Verified linked LIFF workforce, `allowAdminOverride: false`, current domain cancellation-decision workflow | Intentional LIFF exception; no unsupported generic capability is added | `LiffLeaveComponents.test.tsx`; LIFF cancellation route/source tests |

Future policy status for all rows above: preserve the current bespoke domain
boundary until a later policy phase explicitly decides whether a new capability
or scope is needed. Phase 12F neither creates keys nor labels these rows as
missing migrated capabilities.

### 12.5 Employee, Department and Notification broad/actor-owned policy

- `employee.read`, `employee.stats.read`, `employee.export` deliberately keep
  broad `ALL` default behavior. Query code still filters deleted employees,
  applies bootstrap/system exclusions where applicable, validates pagination and
  enforces export limits.
- `department.read` deliberately keeps `ALL` default behavior with current
  query filters and pagination.
- `notification.inbox.read` and `notification.inbox.update` are current actor
  `OWN` only. Neither configured nor default behavior authorizes arbitrary
  target-user selection unless a future domain policy explicitly adds it.

These are direct regression requirements, not accidental allowances.

### 12.6 ADMIN boundaries

ADMIN authority is a trusted persisted `systemRole`, represented as
`SYSTEM_ROLE` where the capability/channel supports it. ADMIN has empty
Default Domain Policy in composition. A USER with `ALL` remains a USER and
does not gain ADMIN status.

Across representative Dashboard and LIFF paths, ADMIN still cannot bypass:

```text
authentication and current User lifecycle
required workforce lifecycle
registered capability/channel support
validation and request limits
workflow/state/ownership exceptions
Routine LIFF self-service policy
Stock availability/idempotency/concurrency
Leave effective approver/owner exclusion
transaction-time current-state checks where the path claims them
```

ADMIN tests cover Dashboard system-role authority, LIFF-specific channel
semantics, stale persisted role downgrade, and the distinction between
`SYSTEM_ROLE` provenance and `scope=ALL`.

### 12.7 Explicit Dashboard vs LIFF security table

| Domain | Dashboard actor/channel | LIFF actor/channel | Intentional security difference |
|---|---|---|---|
| Routine | Session/workforce actor, Dashboard contexts management/mine/all | Signed LIFF identity + linked active workforce, self-service contexts | LIFF clamps management/export/reference behavior; Dashboard broad contexts are server-owned. |
| Stock | Session/workforce or explicit Dashboard ADMIN path | Signed LIFF identity + linked workforce; Stock processor path | LIFF has Stock-specific processor semantics; inventory/report are not LIFF capabilities. |
| Leave | Session/workforce, with Dashboard ADMIN recovery exception | Signed LIFF identity + linked workforce | Generic cancellation decision is Dashboard registry-only; LIFF has a separate no-admin-override domain exception. |
| Employee/Department/Notification/Audit | Current Dashboard APIs only where registry supports them | No invented LIFF support | Unsupported channel is structural denial; no `API` authorization channel exists. |

The actor `channel` is server-derived. A client cannot switch Dashboard and
LIFF semantics by sending a channel, role, scope, employee ID or target ID.

## 13. Transaction and current-state revalidation matrix

The following table records only guarantees traced in current production
paths. It intentionally does not turn a unit-level resolver test into a claim
that every operation runs under one transaction.

| Operation family | What is locked/re-read | Current actor state | Resolver placement | Target/resource recheck | Result / limitation |
|---|---|---|---|---|---|
| Employee update/delete | Transaction-time current User and target Employee are re-read/locked | Current persisted User role, User lifecycle, Employee lifecycle/link | Inside transaction through Employee authorization adapter | Target Employee and mutation lifecycle are rechecked before write | Directly covered; stale management authority cannot write. |
| Employee create/import | Input and application authorization before persistence; import may process rows with its documented partial-success behavior | Current route/workforce actor at the path boundary | No blanket transaction-wide resolver claim for create/import | Row/schema/business validation as implemented | Stronger transaction-wide revalidation is not claimed (`N/A` under `SEC-56`). |
| Routine task mutations | Current actor and relevant task/occurrence/assignee records are re-read/locked in transaction adapter | Current User/Employee identity and role | `resolveRoutineCapabilityInTransaction` where mutation path uses it | Creator, assignee, lifecycle, workflow and target state | Direct transaction tests cover revocation, reassignment and state changes. |
| Routine read/export/summary/reference | Route/session and domain query checks; read paths do not claim transaction-wide authorization snapshot | Current actor at route boundary | Resolver/domain adapter outside a mutation transaction where applicable | Query predicates, context mapping, serializers and export limits | No read-only transaction-isolation overclaim. |
| Routine import preview/apply | Preview validates and authorizes; apply uses current row/application rules and documented partial-success behavior | Current actor as provided by route/application path | No blanket transaction claim for preview/partial-success import | Batch/row state and validation as implemented | Stronger all-rows atomic authorization is not claimed. |
| Stock request create | Serializable transaction and current request/variant state | Current workforce actor re-read by Stock transaction adapter | Transaction resolver path | Ownership, availability, idempotency key and request state | Direct Stock mutation/concurrency tests. |
| Stock process/issue/cancel | Serializable transaction; current actor, request and inventory state are re-read/locked | Current User/Employee/LIFF processor identity | Transaction resolver path | Request state, inventory availability and transaction conflict | Direct tests cover already-claimed request, inactive workforce and retries. |
| Stock upload image | Preflight/current workforce authorization and immediate pre-write authorization | Current actor at helper/route boundary | Resolver/config error is sanitized; filesystem write is outside DB transaction | Image input/content type/storage rules | DB/filesystem atomicity is not claimed; malformed config now fails closed with safe 500. |
| Leave approve/decision | Transaction re-reads current User/Employee and locks relevant Leave/request/approver rows | Current workforce actor and current persisted role/lifecycle | Transaction authorization path in Leave mutation | Effective approver, exception precedence, owner exclusion, state/quota/overlap | Direct tests cover stale approver and workflow transitions. |
| Leave cancel/not-taken | Transaction re-reads current actor and relevant request/relationship rows | Current current-state workforce actor; Dashboard recovery flag is server-owned | Transaction/domain mutation path | Owner/approver relationship, lifecycle, request state and transition | Direct tests cover owner exclusion, stale relationships and recovery limits. |
| Leave approver management | Transactional assignment/update with current approver/request constraints | Current active workforce or trusted ADMIN path | Capability plus domain atomic command | Self-assignment, pending-request conflict and active assignment | Direct application/mutation tests. |
| Authorization grant/membership mutation | Administration transaction performs validated mutation and audit | Trusted ADMIN route principal | Administration mutation transaction; fresh subsequent resolver read | Target Team/Role/User and origin consistency | Direct administration tests; no claim that an already-running unrelated request is globally serialized. |

### 13.1 Stale-role and stale-identity transitions

Direct representative scenarios cover:

```text
route/session initially says ADMIN, persisted current User is USER -> denied
User becomes inactive or deleted -> session/workforce revalidation denies
Employee becomes inactive or is relinked -> workforce/LIFF actor is rejected
approver assignment changes -> effective approver is resolved from current state
Routine assignment changes -> current creator/assignee predicate is used
Team/TeamRole membership or grant is revoked -> fresh resolver omits source
```

The strongest guarantee is path-specific: current session/workforce reads,
transaction-time locks/re-reads where listed, and fresh resolver evaluation.
The audit does not claim atomic protection against every possible cross-request
interleaving or database isolation scenario.

## 14. Presentation is not authority

Dashboard and LIFF presentation projections are intentionally non-authoritative.
The following evidence checks that UI visibility/action availability is derived
from server-provided projection data and that the corresponding route/application
command still owns the decision:

| Consumer | Presentation evidence | Independent server boundary |
|---|---|---|
| Employee controls | Employee Dashboard projection tests, including historical ADMIN compatibility wording | Employee route/workforce/auth/application mutation tests for read/create/update/delete/import/export |
| Routine controls | Routine Dashboard/LIFF projections and context-specific action tests | Current Routine Dashboard/LIFF route ledger and domain authorization/transaction tests |
| Stock controls | `modules/stock/application/presentation-capabilities.test.ts` proves projection independence, Dashboard ADMIN and LIFF processor differences | Stock route/application authorization and transaction tests |
| Leave controls | Dashboard/LIFF component tests, including cancellation exception visibility | Leave route/application effective-approver/workflow tests; LIFF exception server action |
| Notification UI | Notification presentation/query/command tests | Notification routes enforce current actor `OWN` |
| Authorization Administration UI | `UserAccessPanel.test.tsx` proves status/provenance/context rendering | All 17 Administration route handlers require shared ADMIN server boundary; target IDs are not actor identity |

Hiding, disabling or omitting an action does not authorize it. A forged
request, direct route call or altered client projection must still reach the
server boundary and be denied/validated independently. The new direct route
seam suite deliberately exercises handlers without relying on a rendered UI.

## 15. Phase 12E Effective Access Inspector security evidence

Effective Access is an operator read model, not a pre-authorization result for
the inspected User or operator. Current provider/application tests prove:

| Inspector scenario | Expected projection | Evidence |
|---|---|---|
| `NO_APPLICABLE_GRANT` with non-empty domain default | `Default` is visible; `Effective` can be `AVAILABLE` even though central resolver permission alone is false | `administration.test.ts` no-grant/default case |
| Central-only capability with no grant | `UNAVAILABLE`; no default policy is manufactured | `administration.test.ts` |
| Broader configured grant | `Additional` and `Effective` expand where channel/domain policy permits | `administration.test.ts`, composition tests |
| Redundant configured grant | Grant remains visible as `Additional`/provenance, but effective scopes do not expand | `administration.test.ts`, `UserAccessPanel.test.tsx` |
| ADMIN | `Default` empty; `SYSTEM_ROLE` source visible; ADMIN is not represented as a default grant | resolver/composition/inspector tests |
| Routine contexts | Dashboard management/mine/all and LIFF self-service remain distinct records; they are not flattened | `administration.test.ts`, `UserAccessPanel.test.tsx` |
| LIFF context | Channel policy and data-minimization limitations remain visible | inspector/provider and UserAccessPanel tests |
| Unsupported channel | `UNSUPPORTED`, not ordinary no-grant `UNAVAILABLE` | inspector tests and registry tests |
| Email Request | `DEFERRED`, not migrated/active grantable access | inspector provider/source tests |
| Invalid configuration | `INVALID_CONFIGURATION`; no permissive effective rows | inspector and administration tests |
| Client-supplied target/role/scope | Ignored for actor authority; target User is the inspected subject | Admin route seam, route-auth and inspector source inspection |

The inspector explicitly does not claim that a capability projection has already
passed:

```text
resource ownership / resource existence
workflow or lifecycle transition
LIFF identity link/workforce eligibility
transaction-time state or concurrency
```

unless the provider actually represents that runtime eligibility. The operator
caveat is part of the read model and UI copy; an operator must still invoke the
real domain route/application command.

## 16. Deferred Email Request and other domain-owned surfaces

### 16.1 Deferred Email Request

The only registered deferred capabilities are:

```text
email.request.read
email.request.create
```

They remain `DEFERRED_AUTHORIZATION_SURFACE`. The current Email Request route
and in-app notification compatibility adapter are documented/source-audited
under their existing domain boundary; no central migrated capability grant is
activated, persisted or inferred. Their absence from the migrated operation
ledger is intentional and is not a missing test for the migrated 38 grantable
capabilities. Phase 12F does not migrate Email Request.

| Current Email Request boundary | Current protection and behavior | Evidence |
|---|---|---|
| `POST /api/email-request` (`email.request.create`, deferred) | `requireAdminSession` uses current persisted ADMIN state; idempotency key, body schema, service transaction/idempotency, audit and outbox behavior remain enforced. | `app/api/email-request/route.ts`; `__tests__/api/email-request.test.ts`; Email Request mutation tests |
| `GET /api/email-request` (`email.request.read`, deferred) | `requireApiSession` uses current server session; pagination is schema-validated; service scopes non-ADMIN reads to `requestedBy: auth.user.id` and ADMIN reads to the current admin service branch. | `app/api/email-request/route.ts`; `lib/services/email-request/queries.ts`; API/query tests |

This is explicit deferred/domain evidence, not migrated central capability
evidence. The route uses trusted `auth.user` values for requester scoping and
does not accept a client actor ID, role or capability grant.

### 16.2 Unregistered domain-owned inventory

The exact Leave report/export, participant/detail, attachment and recovery
paths are listed in Section 12.4 with current protection, evidence and future
policy status. Other source inspection found no additional unregistered
protected surface that is silently omitted from the current ledger. The rule
is: a domain-owned boundary can remain unregistered only when its own server
predicate is documented and tested; it is not treated as a generic migration
gap merely because a capability key is absent.

## 17. Compatibility-residue reconciliation

Production/current-state code has no active compatibility authorization bypass.
The following strings/names remain by deliberate boundary or historical reason,
and were checked against their call paths:

| Current residue | Why it remains | Authorization conclusion |
|---|---|---|
| `lib/auth/server.ts` “Compatibility adapter for legacy server API consumers” | Compatibility boundary for legacy session consumers | It still resolves current server account/session/workforce state; it is not a grant bypass. |
| `lib/services/notifications/in-app.ts` Email deferred compatibility adapter | Deferred Email behavior | Not part of migrated central authorization; no grant activation. |
| Stock review route “compatibility route” comment | Legacy route shape maps to current Stock process/cancel capability branches | Same current authorization branches; no bypass. |
| Audit migration-named helpers and `usedMigrationCompatibility: false` | Historical migration naming/telemetry contract | USER is not allowed without current central/domain authorization; no fallback. |
| Administration catalog compatibility enum | Type vocabulary remains available for historical/future-safe metadata | Current catalog has zero compatibility entries and zero activation-required rows. |
| Historical Phase 11/early Phase 12 docs/tests | Historical evidence and still-valid regression tests | Not rewritten or treated as current runtime policy. |

The source audit found no active runtime path that turns a structural error into
`NO_APPLICABLE_GRANT`, creates a compatibility grant, or bypasses resolver/domain
policy. Historical tests are retained when they still prove a current invariant;
obsolete compatibility assertions are not used as Phase 12F evidence.

## 18. Architecture boundary evidence

Current architecture checks and source inspection establish:

```text
authorization core does not import business domains
domain effective-access policy remains domain-owned
outer composition binds default/effective-access providers
client graph does not import server authorization implementation
Team is not Department and no implicit mapping exists
default policy is not persisted as a grant
no fake DEFAULT_POLICY grant is emitted
no new authorization persistence layer was introduced
```

`npm run architecture:check` is the mandatory aggregate guard. Direct source
inspection confirms the resolver/application contracts and domain adapter
direction; the only intentional broad architecture classification is `SEC-55`
INDIRECT because the repository checker is the exhaustive mechanical check and
the matrix does not claim a second independent import-graph implementation.

## 19. Mandatory regression backlog and accepted limitations

### 19.1 Mandatory backlog

| Item | Status | Reason |
|---|---|---|
| Protected migrated operation without DIRECT route evidence | `0` | All 83 protected rows are covered by the real route seam plus current domain evidence. |
| Structural failure bridged to default | `0` | Resolver/composition and route tests fail closed; Stock configuration response boundary was hardened. |
| Active compatibility authorization bypass | `0` | Current production source/call-path audit found none. |
| Invalid persisted authorization accepted | `0` | Registry/scope/origin validation and route/inspector tests fail closed. |
| Unresolved policy decision required to close a current claim | `0` | No new scope, capability, deny semantics or domain policy was invented. |
| **Mandatory MISSING rows** | **0** | No mandatory regression/security gap remains. |

### 19.2 Accepted limitations

- No production authorization database was queried or changed. An empty local
  seed is not evidence about production records.
- Phase 12F does not claim blanket transaction isolation, exhaustive concurrent
  interleaving proof, filesystem/DB atomicity for uploads, or all-rows atomicity
  for partial-success imports; Section 13 records the actual path-specific
  guarantees.
- Effective Access is an operator projection and does not decide resource,
  workflow, lifecycle, LIFF link or transaction eligibility unless represented
  by its provider.
- Leave report/export, participant/detail, attachments, recovery and the LIFF
  cancellation-decision exception remain bespoke domain boundaries pending an
  explicit future policy decision.
- Email Request remains deferred and is not migrated.
- Codex Security automated scan preflight was attempted but could not start:
  the environment exposes only the Microsoft Store Python alias at
  `C:\Users\Yingyot\AppData\Local\Microsoft\WindowsApps\python.exe`, with no
  usable Python interpreter for the required `config_preflight.py`. This is an
  tooling limitation, not a claimed green security-scan result. The current
  matrix instead records direct source, architecture-check and regression-test
  evidence; no production scan artifact is represented as completed.

## 20. Verification record and final quantified result

Final verification was executed from the Phase 12F working tree. Neither this
document nor the closure treats an unexecuted command as passed.

| Command | Result |
|---|---|
| `npm.cmd run test:run -- modules/authorization modules/department/application modules/notification/application modules/employee/application modules/routine/application/authorization.test.ts modules/routine/application/queries.test.ts modules/stock/application modules/leave/application/authorization.test.ts __tests__/api/authorization-phase-12f-routine-route-seam.test.ts __tests__/api/authorization-phase-12f-administration-route-seam.test.ts` | **PASS** — 35 test files, 543 tests |
| `npm.cmd run test:run -- __tests__/api/authorization-phase-12f-routine-route-seam.test.ts __tests__/api/authorization-phase-12f-administration-route-seam.test.ts` | **PASS** — 2 test files, 86 tests |
| `npm.cmd run test:run -- __tests__/api __tests__/auth __tests__/integration/authorization-administration.integration.test.ts __tests__/integration/authorization-persistence.integration.test.ts __tests__/integration/authorization-resolver.integration.test.ts` | **PASS** — 65 test files, 655 tests |
| `npm.cmd run test:run` | **PASS** — 320 test files, 2,956 tests, 0 failures, 0 skips |
| `npm.cmd run test:integration:mysql` | **PASS** — migrations applied/no pending migrations; 16 test files, 104 tests |
| `npm.cmd run architecture:check` | **PASS** — 1,134 repository source files checked |
| `npm.cmd run lint:strict` | **PASS** — exit 0, no warnings |
| `npm.cmd run typecheck` | **PASS** — exit 0 |
| `git diff --check` | **PASS** — exit 0 |

The required Codex Security automated scan was not started because its Python
preflight could not find a usable interpreter; this is recorded as a tooling
limitation in Section 19.2 and is not represented as a green scan result.

At the current audit baseline, the quantified matrix is:

| Artifact | Total | DIRECT | INDIRECT | MISSING | N/A |
|---|---:|---:|---:|---:|---:|
| Cross-cutting security matrix | 58 | 53 | 2 | 0 | 3 |
| Current operation ledger | 86 | 86 | 0 | 0 | 0 |
| — protected migrated operation subset | 83 | 83 | 0 | 0 | 0 |
| — presentation-only projection subset | 3 | 3 | 0 | 0 | 0 |
| Authorization Administration ledger | 17 | 17 | 0 | 0 | 0 |

Arithmetic is exact: `58 = 53 + 2 + 0 + 3`, `86 = 86 + 0 + 0 + 0`, and
`17 = 17 + 0 + 0 + 0`. Capability arithmetic is exact as recorded in
Section 3.1. Final verification arithmetic is also recorded in
`authorization-phase-12f-closure.md`.

## 21. Phase boundary

Phase 12F closes the code/runtime audit at the baseline stated at the top of
this document. It does not begin production rollout. The exact next phase is:

```text
Phase 12G — First Production Capability Deployment Readiness
```

Production inventory, rollout prerequisites, first real capability deployment,
rollback/observability and operational readiness belong to Phase 12G.
