# NHF Employee Authorization Phase 11B.4 — Final Enforcement Audit & Routine All-View Policy Readiness

สถานะ: **CLOSED — final enforcement audit และ migration-readiness decision**<br>
Baseline: `0ab2ff04cd618d0bdaa0ed5b519eb8b1bfb09958`<br>
วันที่ตรวจ: 2026-09-15<br>
Production policy: **ไม่เปลี่ยนแปลง**

เอกสารนี้ปิด Phase 11B.4 ในฐานะการตรวจบังคับใช้และการกำหนด readiness boundary
เท่านั้น ไม่ได้เริ่ม compatibility retirement, ไม่ได้เปิด Team policy และไม่ได้
เปลี่ยนผลลัพธ์ของ Routine `scope=all` ใน production

## Executive conclusion

ผลสรุปที่ตรวจสอบจาก source, callers, registry, persistence contracts,
architecture checker และ tests คือ:

```text
CURRENT:
  legacy Routine compatibility ยังสามารถให้ broad all-view access ได้

TARGET:
  broad Routine access ต้องมี effective central
  routine.task.read / ALL จาก trusted authorization

MIGRATION:
  ต้อง migrate list + summary + export + UI + focus/deep-link behavior
  และ grant readiness ใน authorization-policy cutover เดียวกัน
```

ไม่พบ enforcement regression ที่เป็น bypass ใหม่ใน migrated authorization
surfaces และไม่พบรายการที่ยังไม่ถูกจัดประเภทเป็น `LEGACY_AUTHORIZATION_BYPASS`.
อย่างไรก็ตาม Routine broad-view compatibility และ deferred summary/export
ยังเป็น accepted current risk ที่ต้องแก้ใน phase ที่ได้รับอนุมัติแยกต่างหาก
เท่านั้น

## 1. ขอบเขตและวิธีตรวจ

การตรวจรอบนี้อ่านและ trace เอกสาร closure ก่อนหน้า แล้วตรวจ production source
และ test evidence ต่อไปนี้ ไม่ได้อาศัย closure claims อย่างเดียว:

- `docs/architecture/authorization-phase-11a-audit.md`
- `docs/architecture/authorization-phase-11b1-closure.md`
- `docs/architecture/authorization-phase-11b2-closure.md`
- `docs/architecture/authorization-phase-11b3-closure.md`
- `docs/architecture/authorization-current-state.md`
- `docs/architecture/authorization-contract.md`
- `docs/architecture/authorization-resolver.md`
- `docs/architecture/authorization-routine-pilot.md`
- `docs/architecture/dependency-rules.md`
- `docs/architecture/module-boundaries.md`
- `scripts/check-architecture.mjs`
- central evaluator/resolver และ domain authorization adapters
- Routine routes, queries, export implementation, Dashboard/LIFF presentation
  และ authorization architecture tests

กรอบการตรวจใช้เจตนาของ Phase นี้เป็นหลัก: ปิด audit ให้ได้ก่อนตัดสินใจ
เปลี่ยนนโยบาย และเลือกวิธีที่เล็กที่สุดที่รักษาผลลัพธ์ปัจจุบันไว้ได้ จึงไม่มี
production flag, resolver ใหม่ หรือ compatibility deletion ใน Phase 11B.4

## 2. Final enforcement audit

### 2.1 ผลตรวจตาม domain/surface

| Domain / surface | Authentication และ actor | Central authorization | Domain / transaction enforcement | ผลตรวจ |
|---|---|---|---|---|
| Employee | `requireApiSession()` และ actor ที่สร้างจาก authenticated account | `modules/employee/application/authorization.ts` ใช้ central resolver สำหรับ registered capabilities | Employee ownership, lifecycle, PII/query scope, lock และ mutation invariants อยู่ใน Employee layer | ผ่าน; compatibility มีการจัดประเภทและใช้เฉพาะ `NO_APPLICABLE_GRANT` |
| Department | authenticated API session | `department.read` ผ่าน Department adapter/resolver | reference-data query และ filter ยังเป็น Department-owned; ไม่อนุมาน Team | ผ่าน; legacy reference floor ถูกจัดประเภทแล้ว |
| Routine | Dashboard workforce/admin session; LIFF verified session และ route-derived channel | migrated task/occurrence/import operations ผ่าน Routine adapter/resolver; summary/export เป็น deferred โดยเจตนา | creator/assignee/occurrence predicates, active rows, focus และ B3 transaction revalidation อยู่ใน Routine layer | ผ่านตาม current classification; broad all-view เป็น readiness risk ที่ยอมรับไว้ |
| Stock | Dashboard/LIFF trusted session | Stock adapter และ `resolveInTransaction()` สำหรับ mutation-sensitive paths | requester/processor/inventory ownership, claim/status, quantity, lock และ concurrency อยู่ใน Stock layer | ผ่าน; compatibility และ Admin account-only seams ถูกจัดประเภทแล้ว |
| Leave | Dashboard/LIFF trusted session | Leave adapter/resolver และ transaction resolver | effective approver, workflow, lifecycle, affected approver locks และ recovery rules อยู่ใน Leave layer | ผ่าน; deferred/domain exceptions ไม่ถูกลดทอนเป็น allow |
| Audit | authenticated Dashboard session | `audit.read` ผ่าน Audit adapter/resolver | query filters/pagination แยกจาก cleanup และ export-event instrumentation | ผ่าน; cleanup/export-event ไม่ถูกนับเป็น `audit.read` bypass |
| Notification | authenticated account จาก session | inbox read/update ผ่าน Notification adapter/resolver | `userId` ของ owner ถูก derive จาก actor ใน persistence/query | ผ่าน; read/update เป็น capability แยกกัน |
| Authorization Administration | trusted authenticated ADMIN boundary | capability registry/readiness และ administration commands ผ่าน central contract | input validation, readiness gate, serializable transaction และ audit ใน transaction เดียวกัน | ผ่าน; ไม่มี client-supplied role หรือ grant authority |

หลักฐานตัวแทนที่ตรวจซ้ำ ได้แก่ `modules/authorization/application/evaluator.ts`,
`modules/authorization/application/resolver.ts`, adapter ของ Employee,
Department, Routine, Stock, Leave, Audit และ Notification รวมถึง route/application
call sites ของแต่ละ domain

### 2.2 Bypass classification ledger

การนับในเอกสารนี้นับเฉพาะ findings ที่ควรเป็น migrated authorization
enforcement แต่ยังไม่มี classification:

```text
unclassified LEGACY_AUTHORIZATION_BYPASS = 0
```

รายการที่พบถูกจำแนกดังนี้:

| รูปแบบที่อาจดูเหมือน bypass | Classification | เหตุผล |
|---|---|---|
| Routine work-item USER `NO_APPLICABLE_GRANT` แล้ว bridge เป็น `ALL` เมื่อ `taskReadView=work-item` และ requested scope เป็น `all` | `COMPATIBILITY_POLICY` | trigger ถูกจำกัดด้วย capability, normal USER, reason ที่ตรงกัน, view และ requested scope; เป็น policy ที่ freeze ไว้ ไม่ใช่ structural error fallback |
| Employee/Department/Notification/Stock/Leave compatibility floors | `COMPATIBILITY_POLICY` | adapter ตรวจ central decision ก่อน และแปลเฉพาะ `NO_APPLICABLE_GRANT` ตาม migration contract |
| Routine summary, task export และ reference path | `DEFERRED_AUTHORIZATION_SURFACE` | registry และ administration catalog ระบุ deferred อย่างชัดเจน; ไม่อ้างว่า migrated แล้ว |
| `isAdminRole`, `role === ADMIN` ใน Dashboard/page/presentation หรือ workflow-specific code | `PRESENTATION_OR_DOMAIN/LIFECYCLE` | ใช้เลือก UI, account/workforce exception หรือ domain workflow; ไม่แทน route/application authorization ใน migrated path |
| `scope`, `employeeId`, assignee และ resource IDs จาก request | `QUERY_OR_TARGET_INPUT` | เป็น filter/target ที่แยกจาก actor ซึ่ง route สร้างจาก trusted session; ไม่สามารถแทน user ID, role, channel หรือ capability |
| Routine browser imports | `ARCHITECTURE_BOUNDARY` | `scripts/check-architecture.mjs` เดิน client graph และปฏิเสธ server entry, persistence, auth และ Node/Next server dependencies |
| unimplemented `TEAM` scope ใน Routine predicate builder | `FAIL_CLOSED_DOMAIN_SEMANTICS` | คืน impossible predicate ไม่ใช่ `{}` และไม่มีการสร้าง Team origin เอง |

ดังนั้นไม่มี finding ที่ควรถูกปิดบังด้วยคำว่า compatibility หรือ presentation
โดยไม่ระบุขอบเขต

### 2.3 ข้อสรุปด้าน enforcement

#### Trusted actor และ authentication

Protected operations เข้าผ่าน trusted server authentication ก่อนถึง adapter:

- Dashboard API ใช้ authenticated cookie/session และ active User/Employee
  boundary ตาม route contract; Admin account-only exception มีเฉพาะ helper
  paths ที่อนุมัติไว้
- LIFF ใช้ verified LIFF session, current active User/Employee และตรวจ
  `LineAccountLink` กับ claim ปัจจุบัน
- `modules/routine/server/command-actor.ts` copy actor จาก `auth.user` และ
  รับ mode จาก server-side caller; request ไม่สามารถกำหนด `id`, role หรือ
  channel ให้ actor ได้

request body/query/route/header จึงเป็น input, filter หรือ target เท่านั้น
ไม่ใช่ authorization authority

#### Central resolver

`modules/authorization/application/evaluator.ts` และ
`modules/authorization/application/resolver.ts` เป็น source เดียวสำหรับ
registry, channel, ADMIN system-role semantics, persisted USER grants,
normalization และ fail-closed decisions. Unknown capability, unsupported
channel, invalid persisted scope, mismatched Team origin และ configuration
errors ไม่ถูกแปลงเป็น compatibility allow.

Domain adapters เรียก central decision ก่อนแปล scope หรือเข้าถึง protected
resource ตาม approved architecture. `resolveInTransaction()` ถูกใช้ใน
mutation paths ที่ต้อง revalidate current lifecycle/authorization ภายใน
transaction

#### Scope กับ domain policy

`ALL` จาก central resolver หมายถึงไม่จำกัด relationship predicate ของ scope
นั้นเท่านั้น ไม่ได้ข้าม active/deleted state, creator/assignee/requester,
workflow, validation, row lock หรือ concurrency. Routine scope builders ที่ยัง
ไม่รองรับ `TEAM` fail closed และไม่แปลง Team เป็น organization-wide access.

#### Transaction และ lifecycle

Phase 11B.3 protections ยังอยู่ครบ: Routine lock/re-read target Employees
ก่อนเขียน assignees, Leave lock/re-read affected approver rows และ mutation
paths revalidate current User/Employee/capability ตาม contract. Known local
filesystem upload TOCTOU limitation ที่บันทึกใน B3 ยังเป็น limitation เดิม
ไม่ใช่ regression ของ B4.

#### Team origin

`TEAM`/`TEAM_ROLE` authority มาจาก persisted grant พร้อม Team IDs ที่ central
resolver ตรวจ origin เท่านั้น. Direct User `TEAM` grant ทำให้เกิด
`DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN`; ADMIN ไม่ได้สร้าง Team origin เอง และ
ไม่มี Department-to-Team, hierarchy หรือชื่อ Team/TeamRole inference.

#### Presentation และ Routine browser boundary

Presentation projection (`canReadTasks`, `LiffCapabilities`, role labels และ
resource `canEdit/canDelete`) ไม่ใช่ security boundary. API/application layer
ยังต้องตัดสินซ้ำทุกครั้ง

Phase 11B.1 graph enforcement ใน `scripts/check-architecture.mjs` และ tests
ใน `__tests__/architecture/check-architecture.test.ts` ยังคงป้องกัน:

- Dashboard/LIFF route ที่ไม่ compose ผ่าน `@/modules/routine/client`;
- transitive import ไป Routine server/application/infrastructure,
  persistence, auth/workforce, `next/server`, `next/headers`, `server-only`,
  Node built-ins และ runtime Prisma;
- Routine internals ที่ re-enter public server/client barrel ผิด boundary

ผล regression audit จึงเป็น **ผ่าน**, โดยไม่ blanket-ban role/lifecycle หรือ
presentation usage ที่ยังมีความหมายตาม domain

### 2.4 Architecture regression check หลัง Phase 11A

ตรวจ implementation ที่เพิ่มหรือเปลี่ยนใน B1-B3 และ production call graph
ปัจจุบันกับ pattern ที่เสี่ยงต่อการถอยกลับ ได้ผลดังนี้:

| Pattern ที่ตรวจ | ผลและ classification |
|---|---|
| direct business authorization ด้วย `isAdminRole` | ไม่พบใน migrated server authority; ที่พบอยู่ใน presentation, account-only lifecycle exception หรือ domain workflow ที่ถูกจัดประเภทไว้ |
| request-supplied role/actor/channel/capability | ไม่พบ; query scope, IDs และ filters ยังคงเป็น input แยกจาก actor ที่ session สร้าง |
| direct central-resolver bypass | ไม่พบใน migrated adapters; application operations ใช้ domain adapter และ registered capability |
| protected repository access ก่อน required authorization | ไม่พบใน representative migrated paths; deferred paths ถูกระบุเป็น deferred ไม่ได้อ้างว่า migrated |
| Routine browser server-boundary crossing | ไม่พบ; checker และ 251 architecture tests ป้องกัน direct/transitive violation |
| unscoped `TEAM` หรือ Team-to-broad translation | ไม่พบ; resolver รักษา Team origin และ Routine builder fail closed |
| authorization/configuration error downgraded เป็น compatibility allow | ไม่พบ; bridge ตรวจ exact `NO_APPLICABLE_GRANT` เท่านั้น |
| duplicated authorization logic นอก approved adapters | ไม่พบใน audited migrated call graph; remaining role/domain checks มี owner และเหตุผลชัดเจน |

ข้อสรุปนี้เป็น semantic classification ไม่ใช่ blanket-ban การใช้ role ใน
presentation/lifecycle/domain code ที่ไม่ได้ทำหน้าที่เป็น server authorization.

## 3. Routine all-view surface map

### 3.1 Dashboard surface

```text
Dashboard UI (`RoutineSection`)
  -> work-item list
  -> summary
  -> export
  -> focus/deep link behavior
```

| Surface | Production path | สถานะ migration ปัจจุบัน | พฤติกรรมสำคัญ |
|---|---|---|---|
| Dashboard UI | `modules/routine/presentation/dashboard/RoutineSection.tsx` | presentation projection เท่านั้น | เมื่อ `canReadTasks === true` แสดง `รายการของฉัน` และ `รายการทั้งหมด`; export control ก็อยู่ใน surface นี้ และการแสดง control ไม่ใช่ authorization |
| Work-item list | `GET /api/routines/occurrences?view=tasks&scope=all` -> `getRoutineTaskWorkItems()` | **MIGRATED + compatibility bridge ยัง active** | route auth/validation/trusted actor -> `routine.task.read` -> work-item scope -> domain task predicate; current normal USER no-grant all ใช้ exact bridge เป็น effective `ALL` |
| Summary | `GET /api/routines/summary?scope=all` -> `getRoutineSummary()` | **DEFERRED / legacy** | query ใช้ requested scope และ existing Routine domain behavior โดยตรง; ยังไม่เทียบเท่า central `routine.task.read / ALL` |
| Export | `GET /api/routines/export?format=xlsx` -> `prepareRoutineTaskExport()` | **DEFERRED / intentional bypass of migrated task-read** | export เรียก `getRoutineTaskWorkItems(..., { authorizationMode: "DEFERRED_EXPORT" })` และ query `scope: "all"`; policy export ยังไม่ได้ migrate |
| Focus/deep link | `taskId`, `occurrenceId`, `routineTab` ใน Dashboard URL และ query | list ใช้ migrated focus authorization; summary/export ยังตาม deferred behavior | เมื่อมี `taskId` หรือ `occurrenceId`, `RoutineSection` เลือก all tab; service อนุญาต unscoped focus เฉพาะ effective `ALL` (หรือ deferred export context) และใช้ creator/assignee predicates เมื่อ scope แคบ |

หลักฐานใน source อยู่ที่ `modules/routine/application/authorization.ts:24,
126,174,238,460`, `modules/routine/application/queries.ts:211,536,585,846,1112`,
`app/api/routines/occurrences/route.ts`, `app/api/routines/summary/route.ts`,
`app/api/routines/export/route.ts`, `modules/routine/infrastructure/reports/routine-export.ts`
และ `modules/routine/presentation/dashboard/RoutineSection.tsx:485`.

### 3.2 LIFF isolation

LIFF ไม่ใช่ Dashboard all-view policy surface และยังคง invariant เดิม:

- `app/api/line/routine/tasks/route.ts` สร้าง actor ด้วย
  `LIFF_SELF_SERVICE` และส่ง `scope: "mine"` ให้ service เสมอ ไม่รับ
  client `scope=all`, `employeeId` หรือ `assigneeId` มาเพิ่ม authority;
- `app/api/line/routine/summary/route.ts` ส่ง `scope: "mine"` เสมอ;
- LIFF presentation API ไม่ส่ง scope all และไม่มี Dashboard all tab/export;
- task detail/mutation ใช้ linked `auth.employeeId` และ Routine service
  self-service predicates; LIFF Admin ถูก clamp เป็น self-service semantics;
- focus ผ่าน `taskId`/`occurrenceId` ยังคงอยู่ใน mine relationship boundary
  ไม่เปลี่ยนเป็น Dashboard broad view

หลักฐาน regression อยู่ใน `__tests__/api/line-routine-routes.test.ts` และ
`__tests__/api/line-routine-self-service-routes.test.ts` โดยมี characterization
ที่ส่ง forged `scope=all`/identity parameters แล้วตรวจว่า service ได้ `mine`
และ actor/employee ที่มาจาก session

## 4. Current production behavior

### Normal Dashboard USER

สำหรับ active workforce USER ที่ผ่าน current Dashboard capability projection:

1. `routine.task.read` work-item + requested `scope=mine` ใช้ effective
   `ASSIGNED` ผ่าน compatibility เมื่อ central reason เป็น
   `NO_APPLICABLE_GRANT`.
2. `routine.task.read` work-item + requested `scope=all` ใช้ effective `ALL`
   ผ่าน bridge เดิม เมื่อเข้าเงื่อนไขครบ: normal USER, capability ตรง,
   central deny reason ตรง, `taskReadView=work-item` และ requested scope all.
   จึงยังสามารถ query active tasks โดยไม่มี assignee narrowing.
3. `GET /api/routines/summary?scope=all` ยังตอบตาม deferred requested-scope
   query path และอาจเป็น organization-wide ตาม behavior เดิม.
4. export ยัง query all ผ่าน `DEFERRED_EXPORT` และไม่พึ่ง migrated
   `routine.task.read` authorization.
5. UI แสดง mine/all จาก `canReadTasks`; role หรือการซ่อน tab ไม่ได้ป้องกัน
   direct API request.

Explicit persisted grant มีผลตาม central resolver: grant ที่แคบกว่าไม่ถูก
ขยายเพราะ request ขอ all และ central `ALL` จึงเป็น authority ที่แท้จริงเมื่อ
มี grant พร้อมใช้ แต่ compatibility bridge ยังครอบคลุม no-grant case ตามที่
freeze ไว้

### Dashboard ADMIN

ADMIN ถูก resolve เป็น central `SYSTEM_ROLE` authority ตาม capability/channel
registry และเมื่อ capability รองรับ `ALL` จะได้ central `ALL`. Admin ยังต้อง
ผ่าน authentication, account lifecycle, input validation และ domain rules.

สำหรับ Routine API helper ปัจจุบัน `requireActiveWorkforceOrAdminSession()`
รองรับ active account-only Admin ใน approved API paths; Dashboard page และ
navigation ยังคงใช้ current-user/page boundary ของ Dashboard. Task list,
summary และ export behavior ยังแยกตามสถานะ migrated/deferred ข้างต้น และ
requested `mine` ยังคงเป็น query view ที่แคบลงได้. `isAdminRole` ใน
`RoutineSection` ใช้เลือก settings/manage presentation ไม่ใช่ API authority

### LIFF USER และ LIFF ADMIN

ทั้งสอง role ต้องผ่าน verified LIFF account/link และ active workforce boundary.
Task list และ summary ถูกบังคับ `mine`; client ส่ง forged all/employee/assignee
ไม่ได้ทำให้ broad access เกิดขึ้น. LIFF Admin ไม่ถูกยกระดับเป็น Dashboard Admin
ใน Routine self-service paths. Create/update/delete และ focus ยังคงใช้ linked
Employee/domain relationship rules.

### ผู้ใช้ที่พึ่งพา compatibility และ grant readiness

จาก code ระบุได้แน่นอนว่า population ที่พึ่งพา bridge คือ normal eligible USER
ที่ `routine.task.read` central decision เป็น `NO_APPLICABLE_GRANT` และไม่มี
explicit applicable grant. Repository ไม่มี production user/grant inventory
จึงระบุรายชื่อหรือจำนวนจริงไม่ได้.

`modules/authorization/application/seed.ts:23-30` กำหนด teams, roles,
memberships, team grants, team-role grants และ user grants เป็น arrays ว่าง
ทั้งหมด และ `prisma/seed.ts:107` เพียงเรียก seed configuration นี้. Schema
รองรับ `TeamCapabilityGrant`, `TeamRoleCapabilityGrant` และ
`UserCapabilityGrant` (`prisma/schema.prisma:81-127`) แต่ไม่ใช่หลักฐานว่ามี
ข้อมูลที่เหมาะสมอยู่ใน production database. ไม่มี database inventory/query
ใน Phase นี้ และไม่สร้างหรือ seed grant ใด ๆ.

ดังนั้นยังสรุปไม่ได้ว่า production มี `routine.task.read / ALL` grants เพียงพอ
สำหรับ intended population. การ map intended population, Team/TeamRole หรือ
direct User exception เป็น **product / organizational policy decision required**.

ทางเทคนิค Team/TeamRole infrastructure สามารถแทนกลุ่มในอนาคตผ่าน active
membership/role และ central grants ได้. Direct User grant ก็รองรับใน schema
แต่ไม่เหมาะเป็น broad organizational policy หลัก เพราะต้องดูแลรายบุคคลและมี
ความเสี่ยง drift; direct User `TEAM` ยังคงใช้ไม่ได้เพราะไม่มี origin. ปัจจุบัน
administration catalog ยังจัด Routine compatibility เป็น
`CENTRAL_WITH_COMPATIBILITY` และ `POLICY_ACTIVATION_REQUIRED` จึงไม่เปิด ordinary
grant mutation ให้ตัดสิน policy โดยพลการ.

## 5. Target authorization policy

Target architecture ที่บันทึกไว้โดยยังไม่ activate คือ:

```text
requested scope = "all"
        !=
authorization authority
```

ในระยะ target:

```text
effective routine.task.read contains ALL
```

ต้องมาจาก trusted central authorization เช่น Dashboard ADMIN system-role
หรือ persisted Team/TeamRole/User grant ที่ผ่าน central resolver และได้รับการ
อนุมัติให้แทน broad Routine population.

หลักเดียวกันต้องผูกกับ work-item list, summary และ export ใน cutover เดียวกัน
(หากยังใช้ capability แยกสำหรับ summary/export การตัดสิน broad ต้องมี central
`ALL` ที่เทียบเท่าและได้รับอนุมัติ ไม่ใช่ใช้ requested scope เป็น authority;
capability แยกเป็นเงื่อนไขเพิ่มเติมได้ แต่ห้ามใช้แทน broad
`routine.task.read / ALL` gate)

เมื่อ client ขอ `scope=all` แต่ effective central authorization ไม่มี `ALL`:

```text
client request all + no effective central ALL
        -> ห้ามส่ง organization-wide Routine data
```

ผลลัพธ์หลังจากนั้นจะเป็น narrow relationship view หรือ explicit denial ตาม
API contract ที่อนุมัติ แต่ทั้งสองกรณีต้องไม่กลายเป็น broad access. การตัดสินใจ
นี้ต้องเกิดที่ server และต้องใช้กับ direct API request ไม่ใช่เพียง UI.

## 6. Strategy decision

### Option A — Retain current broad compatibility permanently

ความหมาย: normal eligible USER ยังคงได้ organization-wide Routine visibility
ผ่าน compatibility behavior.

ข้อดี:

- backward compatibility สูงสุด;
- ไม่เปลี่ยน UI/product behavior.

ข้อเสีย:

- requested `scope=all` ยังผูกกับ authority;
- central authorization ไม่ใช่ source of truth ของ broad visibility;
- least-privilege migration ไม่สมบูรณ์;
- explicit grant ไม่สามารถอธิบาย effective access ปัจจุบันได้ถูกต้อง.

คำตัดสิน: **ไม่แนะนำเป็น target architecture** และยังไม่ลบใน 11B.4.

### Option B — Narrow only the migrated work-item API

ความหมาย: เปลี่ยน `GET /api/routines/occurrences?view=tasks&scope=all` แต่
ปล่อย summary/export ตามเดิม.

คำตัดสิน: **reject**.

เหตุผลคือจะสร้าง semantics ไม่สอดคล้องกันใน product surface เดียวกัน และยัง
เหลือ direct broad-data APIs ที่ normal USER เรียกได้. อาจเกิดสภาพ list แคบ
แต่ summary หรือ export ยัง organization-wide ซึ่งเป็น split-authority
configuration ที่ห้ามเกิด.

### Option C — Atomic migration to centrally authorized ALL

ความหมาย: ทุก broad Routine surface ต้องใช้ effective central `ALL` รวมถึง:

- work-item list;
- summary;
- export;
- focused/deep-linked access ที่ต้องการ broad access;
- Dashboard presentation projection;
- capability/grant readiness;
- compatibility retirement และ rollback.

คำตัดสิน: **recommended target architecture** แต่ **ยังไม่ execute ใน Phase
11B.4**.

## 7. Future presentation และ direct-API contract

Dashboard ใน target ควรได้รับ server-derived bounded projection เช่น
`canReadAllTasks` หรือชื่อเทียบเท่าที่บอกผลจาก effective `routine.task.read`
จริง. Invariant ที่ต้องรักษาคือ:

```text
show broad-data UI
    <- trusted server authorization projection
```

ไม่ใช่:

```text
show broad-data UI
    <- client role guess / canReadTasks alone / requested scope
```

`canReadTasks` ในปัจจุบันเพียงบอก task-read entry eligibility และยังไม่ใช่
หลักฐาน `ALL`. `role === ADMIN`, presence ของ query parameter และ tab visibility
จึงไม่ควรเป็น source ของ broad-data control ใน target. Phase 11B.4 ไม่เพิ่ม
field ใหม่ เพราะยังไม่ทำ policy activation.

ทุก direct request ใน target ต้องถูก enforce ที่ server อย่างน้อย:

- `/api/routines/occurrences?view=tasks&scope=all`;
- `/api/routines/summary?scope=all`;
- `/api/routines/export?format=xlsx`.

การซ่อน tab/button เป็น UX projection เท่านั้น ไม่ใช่การป้องกัน bypass.

Focus/deep-link contract ต้องกำหนดด้วยว่า `taskId`/`occurrenceId` ที่ทำให้ UI
เลือก all tab จะได้รับ unscoped focus ได้ต่อเมื่อ effective central `ALL`
เท่านั้น; หากไม่มี `ALL` ต้องใช้ relationship predicate หรือ deny ตาม policy
ที่อนุมัติ โดยต้องไม่ทำให้ deep link กลายเป็น implicit broad authority.

## 8. Migration gates ก่อน retire compatibility

Compatibility bridge ห้ามถูกลบจนกว่าจะผ่าน gates ทั้งหมดใน cutover เดียวกัน:

1. **Intended population approved** — ระบุผู้ที่ควรเห็น broad Routine data และ
   ผู้ที่ไม่ควรเห็น โดยมี product/organizational owner รับรอง
2. **Grant strategy approved** — ตัดสินว่าจะใช้ Dashboard ADMIN, Team,
   TeamRole, direct User exception หรือการผสมที่ตรวจสอบได้ โดยไม่ infer จาก
   Department
3. **Necessary persisted grants ready** — inventory production จริง, ตรวจ
   coverage/absence/stale membership และเตรียม grant ให้ครบก่อนเปลี่ยนผลลัพธ์
4. **Summary authorization migrated** — `getRoutineSummary()` ต้องใช้
   server central decision และไม่ให้ requested all เป็น authority เอง
5. **Export authorization migrated** — เอา `DEFERRED_EXPORT` ออกจาก broad export
   path หรือแทนที่ด้วย policy ที่ central ตรวจและมี row/serialization contract
6. **Work-item compatibility retirement prepared** — list/focus ใช้ central
   effective `ALL` จริงและมี explicit behavior สำหรับ no-ALL ก่อนลบ bridge
7. **Server-derived UI projection prepared** — Dashboard ใช้ projection เช่น
   `canReadAllTasks` สำหรับ tabs/focus/export affordances และยังคง server checks
8. **Direct API regression suite prepared** — list, summary, export, focus และ
   forged query cases ยืนยันว่า USER ไม่มี central ALL แล้วไม่เห็น broad data
9. **LIFF isolation confirmed** — tasks/summary ยังคง route-forced `mine`,
   focus และ Admin self-service ไม่รั่วจาก Dashboard policy
10. **Rollout/rollback criteria defined** — list+summary+export policy เปลี่ยน
    พร้อมกัน, มี observability สำหรับ denial/coverage/error และ rollback ต้อง
    คืนทั้ง policy projection กับ server enforcement โดยไม่ทิ้ง split state

Invariant ของ cutover คือห้ามเกิด:

```text
task list = narrowed
summary   = organization-wide
export    = organization-wide
```

หรือรูปแบบใด ๆ ที่ใช้ authority คนละชุดใน product surface เดียวกัน.

## 9. Tests และ regression evidence

Phase 11B.4 ไม่เพิ่ม test matrix ใหม่ เพราะ evidence ที่มีอยู่ครอบคลุม
invariants ที่ขาดไม่ได้แล้ว และการเพิ่ม snapshot/documentation tests จะไม่
เพิ่ม signal ที่มีความหมาย. Tests ที่นำกลับมาใช้มีดังนี้:

- `modules/routine/application/authorization.test.ts` — exact compatibility
  trigger, explicit grant precedence, structural denial ไม่ bridge เป็น ALL,
  configuration error propagation, scope translation และ fail-closed TEAM;
- `modules/routine/application/queries.test.ts` — work-item all/mine,
  focus, creator/assignee predicates และ LIFF detail behavior;
- `__tests__/api/routines-occurrences.test.ts` — authenticated route, task-view
  path, scope/filter forwarding และ direct API behavior;
- `__tests__/api/routine-summary.test.ts` — USER/Admin scope characterization,
  รวม current USER `scope=all` behavior;
- `__tests__/api/routine-export.test.ts` และ
  `modules/routine/infrastructure/reports/routine-export.test.ts` — export
  actor, all-scope `DEFERRED_EXPORT`, row limit และ audit behavior;
- `modules/routine/presentation/dashboard/RoutineSection.test.tsx` — all tab,
  summary/list requests, export control และ focus-to-all behavior;
- `__tests__/api/line-routine-routes.test.ts` และ
  `__tests__/api/line-routine-self-service-routes.test.ts` — forged all/identity
  inputs ยังถูกบังคับเป็น mine และ linked actor/employee;
- `modules/authorization/application/resolver.test.ts` และ
  `modules/authorization/application/grant-validation.test.ts` — central
  default deny, Team origin, invalid configuration และ ADMIN/USER semantics;
- `__tests__/architecture/check-architecture.test.ts` — Routine client graph,
  direct/transitive server dependency และ route composition protections.

ไม่มี test ใหม่ที่จำเป็นต่อ final-audit evidence ณ baseline นี้.

## 10. Accepted current risk และ non-goals

ยอมรับอย่างเปิดเผยว่า broad Routine all-view compatibility ยัง active:

- normal eligible Dashboard USER ที่อยู่ใน exact no-grant bridge อาจได้
  effective `ALL` สำหรับ work-item all view;
- summary all และ export all ยังอยู่บน deferred/legacy behavior และยังไม่ใช่
  central `routine.task.read / ALL` contract;
- Dashboard all tab/export affordance ยัง derive จาก current capability/read
  projection และไม่ใช่ broad authorization boundary;
- production population และ persisted `ALL` grant coverage ยังไม่ได้พิสูจน์.

ความเสี่ยงนี้เป็น compatibility ที่ตั้งใจ freeze ไม่ใช่ “แก้แล้ว” และไม่ใช่
เหตุผลให้ลบ bridge เฉพาะ list ใน Phase นี้.

Phase นี้ไม่ activate Team policy, ไม่ seed grants, ไม่ map Department ไป Team,
ไม่เพิ่ม DENY/wildcard/ABAC/policy DSL, ไม่ migrate deferred Leave/Email
Request/future IT, ไม่เปลี่ยน Employee PII หรือ broad-data policy และไม่เริ่ม
Phase 11C.

## 11. Verification record

ผลการรันจริงกับ baseline หลังการเปลี่ยนแปลงมีดังนี้:

```text
npm run architecture:check  -> PASS (1,119 source files checked)
npm run lint:strict         -> PASS
npm run typecheck           -> PASS
npm run test:run            -> FAILED (exit code 1; 1 timeout)
  Test Files: 313 passed, 1 failed (314 total)
  Tests: 2,758 passed, 1 failed (2,759 total)
git diff --check            -> PASS
```

บน Windows รันคำสั่งเทียบเท่าด้วย `npm.cmd run test:run`. Full suite
จบด้วย exit code `1` เพราะ test
`reads changed runtime imports again on a later scan of the same root` ใน
`__tests__/architecture/check-architecture.test.ts` timeout ที่ default
`5000ms` (สังเกตการทำงาน `5277ms`). จึงต้องบันทึก required command เป็น
**FAILED** แม้ผลที่ล้มเหลวจะเป็น timeout ของ test runner และไม่ใช่หลักฐานของ
authorization assertion failure. ห้ามตีความผลนี้ใหม่เป็น PASS และไม่มีการเพิ่ม
global timeout หรือแก้ test เพื่อสร้างผลเขียว.

Focused verification เป็น supplemental evidence เท่านั้น: 13 non-architecture
authorization/Routine files ผ่านรวม 446 tests และ architecture suite ผ่าน 251
tests เมื่อ rerun ด้วย `--testTimeout=30000 --hookTimeout=30000`; ผลดังกล่าวไม่ใช่
สิ่งทดแทนการรัน full suite ตามคำสั่งที่กำหนด.

ไม่มีการรัน production build หรือ development server เพราะไม่จำเป็นต่อ audit
และไม่มี GitHub CI evidence จึงไม่อ้างว่าเป็นผล CI.

## 12. Phase decision และ established roadmap

Phase 11B สามารถถือว่า **CLOSED ในมิติ enforcement architecture และ final
audit** ได้ เพราะ:

- migrated architecture ถูก re-audit แล้ว;
- `0` unclassified `LEGACY_AUTHORIZATION_BYPASS` findings เหลืออยู่;
- trusted actor, central resolver, Team-origin, domain/lifecycle และ browser
  boundary regression protections ยังทำงาน;
- Routine current risk ถูกจำแนกและ target/migration boundary ไม่คลุมเครือ.

การ CLOSED นี้ไม่หมายความว่า target broad Routine policy ถูก activate หรือว่า
compatibility ถูก retire แล้ว.

roadmap ที่ตกลงไว้ยังคงเป็น:

```text
Phase 11B
Architecture Enforcement & Legacy Bypass Prevention

Phase 11C
Security Regression Matrix

Phase 11D
Residue Cleanup & Final Authorization Closure
```

### Next established phase

**Phase 11C — Security Regression Matrix** เป็น phase ถัดไปที่แนะนำ
(ยังไม่เริ่ม). ขอบเขตควรสร้าง cross-domain authorization regression matrix
โดย consolidate และ reuse หลักฐานจาก Phase 11A–11B เป็นหลัก ครอบคลุมอย่างน้อย:

- unauthenticated access;
- inactive/deleted User และ inactive/deleted Employee เมื่อ workforce เป็น
  prerequisite;
- stale route-time role เทียบกับ current persisted role;
- capability/grant revocation;
- unsupported channel, unknown capability และ invalid persisted authorization
  configuration;
- request actor/role/channel/capability spoof attempts;
- OWN, CREATED และ ASSIGNED relationship failure;
- TEAM missing/invalid origin ที่ต้อง fail closed;
- `ALL` ต้องไม่ bypass business, lifecycle หรือ workflow invariants;
- Dashboard กับ LIFF channel isolation;
- transaction-time revalidation และ resource-relationship race ในจุดที่รองรับ;
- Admin ต้องไม่ bypass lifecycle/business invariants;
- direct API behavior ที่ต้องถูกบังคับใช้โดยไม่ขึ้นกับ UI presentation.

Phase 11C ไม่รวม Team policy activation, Routine compatibility retirement หรือ
Routine all-view migration ในเอกสารแก้ไขนี้ และไม่ควรเริ่มจนกว่าจะมีการอนุมัติ
ขอบเขตของ phase แยกต่างหาก.

### Deferred policy migration

**Routine All-View Authorization Migration & Compatibility Retirement** เป็น
future explicitly approved authorization policy migration track แยกจาก roadmap
Phase 11B–11D และไม่ถูกกำหนดเป็น Phase 11C. การเริ่ม migration นี้ต้องผ่าน
10 migration gates ที่บันทึกไว้ในเอกสารนี้ ได้แก่การอนุมัติ intended broad-view
population และ grant strategy, ความพร้อมของ persisted grants, การ migrate
work-item list, summary, export, UI และ focus/direct APIs อย่างสอดคล้องกัน,
server-derived presentation contract, direct-API regression, LIFF isolation
และ rollout/rollback ที่เป็น atomic policy cutover. Compatibility bridge จะ
เกษียณได้ต่อเมื่อ gates ทั้งหมดผ่านและมี approval แยกต่างหากเท่านั้น.
