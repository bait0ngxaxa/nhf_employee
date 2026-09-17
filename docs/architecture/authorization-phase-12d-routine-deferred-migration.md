# Authorization Phase 12D — Routine Deferred Capability Migration

สถานะ: **CLOSED**

Phase 12D ปิดการย้าย capability ของ Routine ที่ยังอยู่ในสถานะ `DEFERRED`
จาก boundary ของ Phase 12C.5 โดยใช้ additive Default Domain Policy ที่ Phase
12A ล็อกไว้และ composition seam จาก Phase 12B เดิม ไม่มีการออกแบบ resolver,
scope, channel, Prisma schema, Team, seed, backfill หรือ grant migration ใหม่

## Boundary และ capability ที่ย้าย

- Starting commit: `5affaf5b8ba4d244f91509b2f30a62122c0ea644`
  (`feat(auth): migrate leave to additive default policy`)
- Phase 12A, 12B และ Phase 12C.1–12C.5 เป็น closed ก่อนเริ่ม phase นี้
- ย้ายเฉพาะ capability ที่ registered และยัง deferred สามรายการ:

| Capability | Registered scopes | Registered channels | Phase 12D status |
|---|---|---|---|
| `routine.task.export` | `ALL` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY`, `GRANTABLE` |
| `routine.summary.read` | `ASSIGNED`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY`, `GRANTABLE` |
| `routine.reference.read` | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY`, `GRANTABLE` |

Email Request (`email.request.read`, `email.request.create`) ยังคง
`DEFERRED`. Leave report/export, participant/detail, attachment,
unavailable-approver recovery และ LIFF cancellation decision ยังคงเป็น
Leave-owned/unregistered boundaries; future IT และ Email Request ไม่ได้ถูกย้าย

## พฤติกรรมก่อนย้ายที่ยืนยันจาก source และ tests

ก่อน Phase 12D มีพฤติกรรมดังนี้:

- `GET /api/routines/export?format=xlsx` ผ่าน authentication/workforce
  boundary แล้วเรียก exporter ที่ใช้ `getRoutineTaskWorkItems()` ด้วย
  `authorizationMode: "DEFERRED_EXPORT"` เพื่อ query active task set แบบ broad
  `scope=all`. Export ไม่ได้ resolve `routine.task.export` เอง
- Dashboard summary validate view เป็น `mine` หรือ `all`; normal USER ใช้
  `scope=all` ได้และได้ organization-wide KPI ตาม query เดิม. LIFF route
  force `scope="mine"`
- Reference query คืน active Routine units/categories ตามสัญญาเดิม. Dashboard
  normal USER เห็นเฉพาะ current linked active Employee; Dashboard ADMIN เห็น
  eligible active Employees ทั้งหมด. LIFF route ใช้ self-service actor และ
  `serializeLiffRoutineReference()` ไม่ส่ง `employees` ใน response
- Routine task/query/export metrics, relevant occurrence, timing/date
  calculations, active filtering, row limit, XLSX columns และ export audit
  behavior มี tests เดิมคุมไว้ และถูกนำมาใช้เป็น preservation baseline

ข้อสังเกตที่สำคัญคือ broad Dashboard summary และ export เป็น behavior ที่
Phase 12A ตัดสินให้คงเป็น default ถาวร ไม่ใช่เหตุผลให้ client query parameter
หรือ role check กลายเป็น authority เอง

## Default Domain Policy และ runtime enforcement

Routine adapter ที่ `modules/routine/application/authorization.ts` เปลี่ยนจาก
รายชื่อ “enforced เก้ารายการ” เป็น `ROUTINE_CAPABILITIES` ครบทั้ง 12 รายการ.
ทั้งสาม capability ใช้ `authorization.resolve()`/`resolveMany()` และ
`composeAuthorizationAuthority()` เดียวกับ Routine capability อื่น ๆ ผลลัพธ์
ยังแยก `decision`, `defaultScopes`, effective `scopes`, configured grant
provenance, `isAdministrative` และ LIFF policy state ออกจากกัน โดยไม่สร้าง
grant ปลอมชื่อ `DEFAULT_POLICY`

### `routine.task.export`

- eligible normal USER บน Dashboard ได้ default `ALL`
- Dashboard ADMIN ได้ default scopes ว่าง และต้องได้ authority จาก central
  resolver `SYSTEM_ROLE / ADMIN`
- LIFF ถูกปฏิเสธตาม registry channel (`CHANNEL_NOT_SUPPORTED`)
- `getRoutineTaskExportData()` เป็น application-layer orchestration ที่ resolve
  capability ก่อนสร้าง active all-scope task predicate. XLSX generation ยังคง
  อยู่ใน `modules/routine/infrastructure/reports/routine-workbook.ts` และ
  response preparation อยู่ใน infrastructure report adapter
- ลบ `DEFERRED_EXPORT`, option ที่รองรับ bypass และการ authorize โดยยืม
  `routine.task.read`, `canReadTasks` หรือ role identity ออกจาก production
  path แล้ว
- คง feature guard, authentication/workforce lifecycle, format validation,
  maximum 2,000 rows, active-task filter, deterministic batching/order,
  source-field omission, serialization, response error handling และ
  after-response export audit logging

### `routine.summary.read`

สำหรับ eligible normal USER ค่า default เป็น context-sensitive และ map เฉพาะ
จาก trusted server context:

| Context | Default scope | Query behavior |
|---|---|---|
| Dashboard + validated `scope=mine` | `ASSIGNED` | current Employee task-assignee KPI |
| Dashboard + validated `scope=all` | `ALL` | organization-wide active-task KPI ตาม behavior เดิม |
| LIFF self-service | `ASSIGNED` | linked self-service task-assignee KPI เท่านั้น |

Route เป็นผู้ validate `scope`; channel มาจาก `createRoutineCommandActor()`
และ route boundary ไม่ใช่ request input. Application จึง resolve capability,
compose default, apply Routine channel policy แล้วจึงเลือก query predicate.
Configured `ASSIGNED` ไม่สามารถ narrow Dashboard `scope=all` ได้. LIFF ADMIN
และ configured LIFF `ALL` ถูก clamp เป็น self-service `ASSIGNED` และไม่อาจได้
organization-wide summary. Metric semantics, active-task behavior,
relevant-occurrence selection, date window และ timing calculations ไม่เปลี่ยน

### `routine.reference.read`

- normal Dashboard USER ได้ default `OWN`; query ยังคง current linked active
  Employee semantics
- Dashboard ADMIN ได้ default ว่าง และ central `SYSTEM_ROLE / ADMIN` ให้
  `ALL`
- configured normal USER `OWN` คง baseline; configured `ALL` สามารถขยายเฉพาะ
  Dashboard Employee reference list ตามกฎ active Employee เดิม
- active shared units/categories ยังคง query ได้ตาม reference contract และไม่
  ถูกซ่อนเพราะ Employee portion เป็น OWN-scoped
- filtering `status=ACTIVE`, `deletedAt=null` และ active linked User ยังคงอยู่
- LIFF ใช้ self-service channel policy เป็น `OWN` และ serializer ยังคง omit
  Employee list แม้ central/configured authority จะมี `ALL`; application query
  ยังป้องกัน broad Employee query ใน LIFF ด้วย trusted actor channel

ทั้งสาม path ไม่อนุมาน authority จาก Department, position, manager hierarchy,
Team name หรือ role name. Resource predicates, lifecycle และ data-minimization
ยังเป็น domain-owned rules หลัง capability authorization

## Configured grants และ structural failures

Generic Authorization Administration Team, TeamRole และ direct User commands
ยอมรับสาม capability ตาม scopes ใน registry: export `ALL`, summary `ASSIGNED`/
`ALL`, และ reference `OWN`/`ALL`. Team/TeamRole/direct User authority เป็น
additive union; grant แคบไม่ลด default ที่กว้างกว่า และ direct User grant ไม่
สามารถสร้าง Team origin เอง. `TEAM` origin validation และ scope validation
เดิมยังทำงานเหมือนเดิม

`UNKNOWN_CAPABILITY`, `CHANNEL_NOT_SUPPORTED`, capability/scope mismatch,
invalid persisted capability/scope/origin และ resolver/persistence/configuration
failures ยังคง fail closed. Expected channel denial อาจ project เป็น `false`
สำหรับ presentation ตาม contract แต่ unknown/configuration/system failure ไม่
ถูกแปลงเป็น default allow หรือ empty success object

## Presentation และ consumer behavior

`RoutinePresentationCapabilities` เพิ่ม operation-level fields:

- `canExportTasks`
- `canReadSummary`
- `canReadReference`

`getRoutinePresentationCapabilities()` เรียก central `resolveMany()` หนึ่งครั้ง
ด้วย inventory ครบ 12 capability แล้ว project fields จาก operation ที่ตรงกัน.
Presentation ยังไม่ใช่ authorization boundary:

- Dashboard export control ใช้ `canExportTasks`; export API resolve
  `routine.task.export` ซ้ำอย่างอิสระ
- Dashboard summary/reference loaders ใช้ projection เพื่อไม่ยิง request ที่
  ไม่พร้อม แต่ server ยังคงเป็นผู้ validate scope และสร้าง predicate
- LIFF Routine availability ใช้ summary projection ร่วมกับ task-read; reference
  loaders ใช้ reference projection. ไม่มีการเปิด broad Employee list หรือ
  export ใน LIFF

ไม่มีการ redesign Routine UI หรือใช้ `canReadTasks`/role เป็น semantic export
permission อีกต่อไป

## Administration catalog และ readiness

เฉพาะสามรายการข้างต้นถูกย้ายจาก `DEFERRED` เป็น
`CENTRAL_WITH_DEFAULT_POLICY` และ `GRANTABLE`. Registry ยังมี 40 รายการ จึงมี
ค่าที่คาดหวังหลัง Phase 12D ดังนี้:

```text
CENTRAL_WITH_DEFAULT_POLICY  25
CENTRAL_WITH_COMPATIBILITY    0
CENTRAL_ONLY                 13
DEFERRED                      2
TOTAL                        40

GRANTABLE                    38
POLICY_ACTIVATION_REQUIRED    0
DEFERRED                      2
TOTAL                        40
```

ตัวเลขนี้ตรวจสอบจาก `buildCapabilityAdministrationCatalog()` และ tests ไม่ได้
เพิ่ม seed, backfill หรือ production grant migration. Authorization
Administration effective-access visualization ยังเป็น Phase 12E

## Verification

Focused และ repository closure checks ที่รันจริง:

- `npm.cmd run typecheck` — ผ่าน
- Routine authorization/query/presentation/export และ Administration focused
  suite — ผ่าน 6 test files, 136 tests
- Routine route/UI/LIFF/presentation focused suite — ผ่าน 15 test files,
  169 tests
- `npm.cmd run architecture:check` — ผ่าน (1123 source files)
- `npm.cmd run lint:strict` — ผ่าน (`eslint . --max-warnings=0`)
- `npm.cmd run test:run` — ผ่าน (317 test files, 2,861 tests)
- `git diff --check` — ผ่าน (มีเฉพาะ Git line-ending warnings ที่ไม่ใช่ diff error)

## Remaining boundary และ next phase

หลัง Phase 12D registered `DEFERRED` เหลือเพียง:

- `email.request.read`
- `email.request.create`

ยังไม่ย้ายและไม่ควรนับเป็น generic registered capability: Leave report/export,
Leave participant/detail, Leave attachment, Leave unavailable-approver recovery
และ Leave LIFF cancellation decision contract. ไม่มีการนำ Email Request หรือ
future IT เข้ามาใน phase นี้

Phase ถัดไปที่แนะนำและเป็น handoff ที่แน่นอนคือ:

**Phase 12E — Authorization Administration effective-access UX completion**
