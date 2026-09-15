# NHF Employee Authorization Phase 11B.3 — Closure

สถานะ: **CLOSED**

Baseline: `e4303a0cf39f8651d54439e173672c6fdf090e8f`
วันที่ตรวจสอบ: 2026-09-15
ขอบเขต: lifecycle, transaction, relationship และ scope semantics ของ capability ที่ migrate แล้ว

Phase นี้เป็น security hardening และ regression proof เท่านั้น ไม่ได้เปิดใช้งาน Team policy, ไม่ได้เลิก compatibility floor และไม่ได้ migrate capability ที่ถูก defer ไว้

## 1. ผลสรุป

เส้นทางที่ตรวจสอบยืนยันว่า production mutation ที่มี transaction revalidation ใช้ลำดับต่อไปนี้:

```text
trusted actor
  -> central capability decision
  -> domain-owned effective scopes
  -> current lifecycle / capability revalidation
  -> current resource relationship
  -> workflow, validation, concurrency and idempotency rules
  -> persistence and side effects
```

Production hardening ที่เพิ่มใน Phase นี้มีเพียง:

- Routine ล็อก target Employee ก่อน re-read สถานะ active ใน `assertActiveEmployeesInTransaction()` เพื่อไม่ให้ lifecycle mutation แทรกก่อนเขียน task/occurrence assignees
- Leave approver assignment ล็อก affected Employee และ proposed approver Employee เป็นชุดเดียวกัน ก่อนอ่าน eligibility และเขียน manager relation
- Leave exception-approver resolution ล็อกเจ้าของ leave ก่อนอ่าน current manager และล็อก/re-read candidate Admin rows ก่อนเลือก fallback
- Stock image upload ทำ authorization re-check หลัง validation และทันทีหน้าการเขียน filesystem

ไม่มีการเปลี่ยน scope registry, role policy, Team policy, compatibility floor หรือ deferred capability inventory

## 2. Lifecycle + scope matrix

คำย่อในคอลัมน์ transaction:

- `U`: re-read/lock current User lifecycle
- `E`: re-read/lock current Employee lifecycle เมื่อ capability นั้นต้องใช้ workforce
- `R`: re-read current persisted system role
- `C`: เรียก `authorization.resolveInTransaction()` ด้วย persistence context เดิม
- `rel`: re-evaluate หรือ lock persisted resource relationship
- `—`: path นี้ไม่มี transaction-time revalidation ตาม contract ปัจจุบัน

### 2.1 Employee

| Capability | Channel | Central scopes | Compatibility เมื่อ `NO_APPLICABLE_GRANT` | Domain predicate | Transaction revalidation | User / Employee / role / central re-resolve | Business invariant หลัง authorization | Remaining risk |
|---|---|---|---|---|---|---|---|---|
| `employee.read` | DASHBOARD | `ALL` | eligible API actor ได้ `ALL` ตาม legacy broad-read floor | organization-wide Employee query; deleted/bootstrap filters เป็น query-owned | read-only; — | — / — / — / — ใน transaction | input filters, pagination และ query failure | broad Employee visibility ยังเป็น policy question เดิม |
| `employee.stats.read` | DASHBOARD | `ALL` | eligible API actor ได้ `ALL` | organization-wide aggregates ตาม implementation ปัจจุบัน | read-only; — | — / — / — / — | aggregate/query behavior เดิม | filtering ของ stats ต่างจาก list ตาม legacy behavior |
| `employee.export` | DASHBOARD | `ALL` | eligible API actor ได้ `ALL` | organization-wide non-deleted export | read-only/export; — | — / — / — / — | row limit, filters และ export serialization | broad HR/PII export ยัง deferred policy question |
| `employee.create` | DASHBOARD | `ALL` | `ADMIN` ได้ `ALL` | ไม่มี ownership; data/organization-email uniqueness เป็น Employee-owned | direct `prisma.employee.create`; — | preflight มี User/Employee eligibility และ role แต่ไม่มี transaction re-read / central re-resolve | schema, email domain/uniqueness และ create response | direct compatibility path มี preflight-to-write lifecycle window; คงไว้ตาม Employee migration contract |
| `employee.update` | DASHBOARD | `ALL` | `ADMIN` ได้ `ALL` | selected Employee; lifecycle operation เป็น Admin/Employee-owned | `U+E+R+C`, target lock, account lifecycle lock | ใช้ current User, linked Employee, role และ current capability | self-offboarding, last active Admin, subordinate/Leave dependency, account lifecycle, audit | ไม่พบ gap ใน path นี้; existing contract ถูกยืนยันด้วย tests |
| `employee.delete` | DASHBOARD | `ALL` | `ADMIN` ได้ `ALL` | selected Employee; offboarding dependency | `U+E+R+C`, target lock, account lifecycle lock | current User/Employee/role/capability | same offboarding, dependency, rollback และ audit rules | ไม่พบ gap ใน path นี้ |
| `employee.import` | DASHBOARD | `ALL` | `ADMIN` ได้ `ALL` | row-by-row import validation | direct partial-success path; — | preflight เท่านั้น; ไม่มี transaction-wide re-read | row parsing, per-row uniqueness และ partial-success contract | partial-success compatibility path คงไว้; ไม่เปลี่ยนเป็น bulk transaction ใน 11B.3 |

`employee.create` และ `employee.import` ถูกบันทึกเป็น compatibility/lifecycle seam ที่รู้จักแล้ว ไม่ถูกอ้างว่าเป็น transaction-safe path ใหม่ และไม่มีการขยายสิทธิ์จาก seam นี้

### 2.2 Routine

| Capability | Channel | Central scopes | Compatibility เมื่อ `NO_APPLICABLE_GRANT` | Domain predicate | Transaction revalidation | User / Employee / role / central re-resolve | Business invariant หลัง authorization | Remaining risk |
|---|---|---|---|---|---|---|---|---|
| `routine.task.read` | DASHBOARD, LIFF_SELF_SERVICE | `CREATED`, `ASSIGNED`, `ALL` | management: `CREATED+ASSIGNED`; work-item/mine: `ASSIGNED`; work-item/all: `ALL` | management ใช้ creator หรือ current task assignee; work-item ใช้ current assignee ตาม view | read-only; — | route/session + central preflight; — / — / — / — | active task, metadata/focus filters และ response redaction | work-item/all `ALL` เป็น high-risk frozen compatibility behavior |
| `routine.task.create` | DASHBOARD, LIFF_SELF_SERVICE | `OWN`, `ALL` | USER ได้ `OWN`; Admin path มาจาก central/established behavior | creator ถูก derive จาก trusted actor; assignees เป็น persisted Employee IDs | `U+E+R+C+rel`; target assignees lock/re-read เพิ่มใน Phase นี้ | current actor, current role/capability และ active target Employees | input normalization, active references, idempotency, schedule/reminder rules | compatibility floor เดิมยังคงอยู่ |
| `routine.task.update` | DASHBOARD, LIFF_SELF_SERVICE | `CREATED`, `ASSIGNED`, `ALL` | USER ได้ `CREATED+ASSIGNED` | `createdById === actor.userId` หรือ current task assignee; creator กับ assignee แยกกัน | `U+E+R+C+rel`; target assignee lock/re-read | current actor, role, capability, task relationship | task version, active references, workflow/lifecycle, reminder generation | ไม่พบ creator/assignee broadening |
| `routine.task.delete` | DASHBOARD, LIFF_SELF_SERVICE | `CREATED`, `ALL` | USER ได้ `CREATED` | USER ต้องเป็น creator; assignee อย่างเดียวลบไม่ได้ | `U+E+R+C+rel` และ current task/version state | current actor, role, capability, creator relation | delete state, current task row และ audit | ไม่พบ gap |
| `routine.occurrence.read` | DASHBOARD | `ASSIGNED`, `ALL` | USER ได้ `ASSIGNED` | occurrence-level assignee; ไม่ใช้ task creator แทน | read-only; — | — / — / — / — | active task, occurrence/focus predicates | TEAM scope ไม่กลายเป็น broad query |
| `routine.occurrence.override` | DASHBOARD | `ALL` | ไม่มี USER bridge | occurrence row และ active target assignees | `U+E+R+C+rel`; target rows lock/re-read | current actor/capability and target Employee state | due-date validity, active task, reminder version, workflow/audit | ไม่พบ gap |
| `routine.occurrence.reassign` | DASHBOARD | `ALL` | ไม่มี USER bridge | occurrence-level assignee relation | `U+E+R+C+rel`; target rows lock/re-read | current actor/capability and target Employee state | optimistic `reminderVersion`, atomic delete/create assignees, audit | ไม่พบ gap |
| `routine.occurrence.change_due_date` | DASHBOARD | `ALL` | ไม่มี USER bridge | occurrence row; no generic relationship bypass | `U+E+R+C` และ occurrence/version checks | current actor/capability | calendar/business-date and optimistic concurrency rules | ไม่พบ gap |
| `routine.import.manage` | DASHBOARD | `ALL` | ไม่มี USER bridge | batch/row ownership และ active reference Employees | staging/apply ใช้ `U+E+R+C+rel` ตาม transaction path | current actor/capability/reference state | batch state, row state, active references, idempotency และ rollback | deferred summary/reference/export ไม่ถูกแตะต้อง |

### 2.3 Stock

| Capability | Channel | Central scopes | Compatibility เมื่อ `NO_APPLICABLE_GRANT` | Domain predicate | Transaction revalidation | User / Employee / role / central re-resolve | Business invariant หลัง authorization | Remaining risk |
|---|---|---|---|---|---|---|---|---|
| `stock.catalog.read` | DASHBOARD, LIFF_SELF_SERVICE | `ALL` | eligible actor ได้ `ALL` | catalog-wide; active item/variant/category filters เป็น Stock-owned | read-only; — | — / — / — / — | active catalog/query filters | ไม่มี request ownership จาก catalog scope |
| `stock.inventory.manage` | DASHBOARD | `ALL` | Dashboard Admin compatibility `ALL`; USER ไม่มี bridge | inventory item/variant rows; ALL แค่ไม่จำกัด relationship | `U+E+R+C`; Admin อาจ account-only ตาม approved exception | current User/role; Employee optional เฉพาะ legacy Admin capability; central current grant | active item/variant, quantities, non-negative/concurrency/foreign-key rules | image upload แยก filesystem boundary ดูหัวข้อ 5 |
| `stock.request.read` | DASHBOARD, LIFF_SELF_SERVICE | `OWN`, `ALL` | USER ยังคง `OWN` แม้ request view เป็น all; Admin mine=`OWN`, all=`ALL` | `requestedBy === actor.userId` เมื่อ OWN; ALL ขยายเฉพาะ requester relation | read-only; — | — / — / — / — | request existence, filters และ detail hiding | client `scope=all` ไม่สามารถสร้าง `ALL` ได้ |
| `stock.request.create` | DASHBOARD, LIFF_SELF_SERVICE | `OWN` | USER/Admin compatibility `OWN` ตาม current floor | requester derive จาก trusted actor ไม่รับ ownership จาก body | `U+E+R+C`; current actor re-read | current User/Employee/role/capability | idempotency, active item/variant, reservation/availability | ไม่พบ gap |
| `stock.request.cancel` | DASHBOARD, LIFF_SELF_SERVICE | `OWN`, `ALL` | USER=`OWN`; Admin compatibility=`ALL` | OWN ตรวจ `requestedBy`; ALL ขยาย relation เท่านั้น | `U+R+C`; Employee optional เฉพาะ approved Dashboard Admin path; request row/claim current | pending status, atomic claim, notification/audit semantics | Admin account-only เป็น compatibility seam ที่ตั้งใจคงไว้ |
| `stock.request.process` | DASHBOARD, LIFF_SELF_SERVICE | `ALL` | Admin compatibility `ALL`; USER ไม่มี bridge | ALL ไม่ข้าม pending request, stock หรือ item relation | `U+R+C`; Employee optional เฉพาะ approved Admin path; request/inventory rows lock | atomic pending claim, active item/variant, sufficient quantity, ledger and rollback | ไม่พบ auth bypass |
| `stock.report.export` | DASHBOARD | `ALL` | Admin compatibility `ALL`; USER ไม่มี bridge | report organization-wide ตาม report implementation | export/query; — | — / — / — / — | filters, row limits, serialization | broad report access เป็น current compatibility/policy floor |

### 2.4 Leave

| Capability | Channel | Central scopes | Compatibility เมื่อ `NO_APPLICABLE_GRANT` | Domain predicate | Transaction revalidation | User / Employee / role / central re-resolve | Business invariant หลัง authorization | Remaining risk |
|---|---|---|---|---|---|---|---|---|
| `leave.request.read` | DASHBOARD, LIFF_SELF_SERVICE | `OWN` | `OWN` | current Employee owner | read/query; — | — / — / — / — | own history/profile filters | participant/detail/attachment policy ยังเป็น Leave-owned |
| `leave.approval.read` | DASHBOARD, LIFF_SELF_SERVICE | `ASSIGNED` | `ASSIGNED` | effective approver: exception approver first, otherwise original approver | read/query; — | — / — / — / — | actionable state and assigned relationship | `managerId` naming ไม่ถูกตีความเป็น generic hierarchy |
| `leave.request.create` | DASHBOARD, LIFF_SELF_SERVICE | `OWN` | `OWN` | current Employee owner equals actor Employee | `U+E+R+C+rel`; requester User/Employee lock; current manager/approver read under owner relation lock | current actor, role, capability and current owner relation | overlap, quota, working day, special reason, active manager approver, idempotency, audit/outbox rollback | no new manager lock added; existing owner lock and offboarding dependency contract retained |
| `leave.request.cancel` | DASHBOARD, LIFF_SELF_SERVICE | `OWN` | `OWN` | owner for pending/self cancellation; effective approver for approved cancellation decision | `U+E+R+C+rel`; request row lock; effective approver/current manager resolution | current actor and current capability; relationship is checked again before conditional update | status/date, cancellation generation, approver availability, atomic claim | no generic Admin override |
| `leave.request.approve` | DASHBOARD, LIFF_SELF_SERVICE | `ASSIGNED` | `ASSIGNED` | current effective approver Employee; owner excluded | `U+E+R+C+rel`; actor User/Employee lock and conditional approver update | current role/capability and effective approver relation | pending workflow, quota, over-quota reason, atomic claim, audit/outbox | no gap found |
| `leave.cancellation.decide` | DASHBOARD | `ASSIGNED` | Dashboard `ASSIGNED`; no LIFF bridge | effective approver; Admin recovery only when unavailable and reason supplied | `U+E+R+C+rel`; leave row lock, current effective approver and conditional update | current actor/role/capability | cancellation workflow/date, owner exclusion, override reason, quota/audit | LIFF cancellation decision remains deferred Leave-domain exception |
| `leave.request.not_taken` | DASHBOARD, LIFF_SELF_SERVICE | `OWN`, `ASSIGNED` | `OWN+ASSIGNED` | owner requests; effective approver confirms | `U+E+R+C+rel`; request lock and current effective approver checks | current actor/role/capability | date/status, quota decrement, reason, atomic claim, audit/outbox | Admin recovery is Leave-specific, not generic ALL |
| `leave.approver.manage` | DASHBOARD | `ALL` | Admin `ALL` | selected Employee manager relation, no self-assignment, no pending request | `U+R+C+rel`; account-only Admin permitted; target + proposed approver rows are locked before eligibility read | current User/role/capability; Employee required for explicit normal USER grant | active target/approver, user/email eligibility, pending-request all-or-nothing and audit | lock order/transaction deadlock behavior should remain covered by DB integration if concurrency changes |

### 2.5 Audit และ Notification

| Capability | Channel | Central scopes | Compatibility | Domain predicate | Transaction revalidation | Notes |
|---|---|---|---|---|---|---|
| `audit.read` | DASHBOARD | `ALL` | ไม่มี compatibility bridge | Audit query is organization-wide after capability decision | read-only; — | Admin and explicit USER/Team/TeamRole authority come only from central resolver; invalid configuration is not allowed |
| `notification.inbox.read` | DASHBOARD | `OWN` | eligible API actor ได้ `OWN` เฉพาะ `NO_APPLICABLE_GRANT` | repository always constrains `userId` to trusted actor | no artificial transaction test; read/query path | client-supplied User IDs are ignored |
| `notification.inbox.update` | DASHBOARD | `OWN` | eligible API actor ได้ `OWN` เฉพาะ `NO_APPLICABLE_GRANT` | mark-read/update always constrains trusted `userId` | no artificial transaction test; one-user read-state mutation | broader/unknown scope never becomes all-user inbox access |

## 3. Scope conclusions

Central scope names are authorization vocabulary. They are not a repository-wide query algorithm.

### `OWN`

The owning domain decides what is owned:

- Stock request ownership is `StockRequest.requestedBy === actor.userId`
- Leave request ownership is current linked `Employee.id === actor.employeeId`
- Routine task creation derives creator/owner from the trusted actor; the request body cannot supply `createdById`
- Notification ownership is the authenticated `User.id`

No adapter substitutes a request-supplied owner, requester, employee or user ID for the trusted actor relationship.

### `CREATED`

Routine is the migrated domain that uses it. The predicate is exactly the existing creator relationship, `RoutineTask.createdById === actor.userId`. It is independent of assignee access. A task created by another actor does not become editable or visible merely because the caller has unrelated access, and request metadata cannot manufacture creator ownership.

### `ASSIGNED`

Assignment remains domain-specific:

- Routine task and occurrence assignment use their own persisted assignee relations; task assignment is not occurrence assignment
- Leave assignment uses the effective approver (`exceptionApproverId ?? approverId`) and active approver eligibility
- No Department, manager hierarchy, position or other inferred relationship is substituted for the persisted relation

Routine target Employee rows and Leave approver rows are now locked/re-read in the mutation paths that write these relationships.

### `TEAM`

Team origin is preserved only by central effective grant evidence:

```text
decision.grants[].source
decision.grants[].constraint.teamId
```

`decision.scopes` alone is not enough to reconstruct Team origin. The existing central resolver tests continue to cover direct User TEAM denial, membership/TeamRole origin matching, inactive Team/TeamRole denial and multiple membership origins.

No migrated domain activates Team query semantics in 11B.3. In particular:

- no Team membership/grant is seeded or created
- no Department-to-Team or hierarchy inference is added
- Routine task/occurrence scope builders treat an unimplemented `TEAM` scope as an empty relationship scope, not `{}`
- no domain treats unknown/TEAM as unrestricted access

### `ALL`

`ALL` removes only the relationship narrowing owned by that capability. It does not bypass authentication, active/deleted User state, required Employee state, feature flags, resource existence, input validation, workflow state, optimistic version checks, idempotency, stock/quota/business rules, audit or transaction consistency.

Examples:

- Routine `ALL` can produce an unscoped task/occurrence predicate, but active task/workflow/target/version/reminder rules still apply
- Stock `ALL` can remove `requestedBy` narrowing, but pending status, inventory quantity, active item/variant and atomic claim rules still apply
- Leave `ALL` on approver management permits selected assignments to be considered, but active target/approver, self-assignment, pending-request and audit rules still apply
- Employee `ALL` is broad data/capability scope, not permission to bypass account, Employee, offboarding or lifecycle invariants

Therefore `ALL != unrestricted execution` and `ADMIN != invariant bypass`.

## 4. Routine `scope=all` work-item compatibility

The current behavior is intentionally frozen and was characterized without changing it.

### Exact trigger and effect

The bridge produces `["ALL"]` only when all of the following are true:

1. capability is `routine.task.read`
2. actor is a normal `USER`
3. central resolver returns `allowed: false`
4. decision reason is exactly `NO_APPLICABLE_GRANT`
5. `taskReadView` is `work-item`
6. requested scope is `all`

`getRoutineTaskWorkItems()` then translates that effective `ALL` through the existing work-item path. With no extra assignee filter, the query can return all active Routine tasks. This remains a high-risk migration compatibility behavior, not a target policy decision.

### Precedence and isolation

- An explicit central grant remains authoritative. For example, `allowed: true` with `ASSIGNED` remains `ASSIGNED`; a request for `all` cannot manufacture `ALL`
- `UNKNOWN_CAPABILITY`, `CHANNEL_NOT_SUPPORTED` and invalid persisted authorization configuration do not bridge to `ALL`
- The normal management task view receives its own `CREATED+ASSIGNED` compatibility behavior; it does not inherit work-item/all behavior
- The LIFF task route creates `scope: "mine"` server-side and does not expose a client `scope=all` input. LIFF Admin is still clamped to self-service Routine semantics

The exact adapter cases are covered in `modules/routine/application/authorization.test.ts`; management/work-item query and LIFF isolation behavior is covered by the existing Routine query and route suites. The behavior is preserved because removing it would be a compatibility/policy decision outside 11B.3.

## 5. Stock image upload

`POST /api/uploads/image` now has this order:

```text
requireActiveWorkforceOrAdminSession()
  -> stock.inventory.manage preflight
  -> parse multipart
  -> validate scope and File
  -> current auth + current stock capability re-check
  -> saveLocalImageUpload()
```

The first authentication/capability check happens before multipart parsing and before any file processing. Invalid scope or missing/non-File input returns before the side effect. An initial capability denial and a denial on the immediate current re-check both return 403 without calling `saveLocalImageUpload()`.

The second check reduces the race where a User or grant becomes invalid after preflight. It is not a fake database transaction: the filesystem write cannot be rolled back atomically with User/grant state. Authority can still change after the second check and before/during `mkdir`/`writeFile`; that is an accepted residual TOCTOU boundary for the current local-storage design. A later phase would need an explicit storage/authorization consistency decision before attempting stronger guarantees.

Admin session status does not bypass `stock.inventory.manage`; the route still requires the central capability decision. Scope remains only `item` or `variant`, and storage path validation remains in the upload adapter.

Regression coverage is in `__tests__/api/uploads-image-route.test.ts` and existing `__tests__/uploads/local.test.ts`.

## 6. Lifecycle and transaction race results

The representative race model was:

```text
T1 preflight allow
T2 User/Employee/role/grant/relationship changes
T3 mutation transaction starts
T4 current state is re-read where the contract requires it
T5 unauthorized or invalid mutation does not commit
```

### Confirmed transaction-time protections

- Employee update/delete: current User, linked Employee, persisted role and capability are re-read/locked before target lifecycle/business writes. Existing tests cover inactive/deleted account and Employee, stale role, dependency rejection and rollback.
- Routine task/occurrence mutations and import apply: current actor/capability are re-resolved; active target Employees are now locked before their status re-read. Version/reminder/workflow and active-reference checks remain after authorization.
- Stock request cancel/process and inventory-sensitive mutations: current User/role and approved Admin Employee-optional exception are re-read; central capability is re-resolved; request/inventory claims and row locks protect workflow/quantity invariants.
- Leave request/approval/cancellation/not-taken/approver assignment: current actor and capability are revalidated; LeaveRequest rows are locked for decision paths; effective approver predicates are checked again; manager/proposed approver relationship rows are locked where the operation writes or snapshots them.
- Transaction failures happen inside the existing serializable transaction. Existing rollback tests cover Employee lifecycle, Routine invalid-assignee/atomic mutation, Stock claim/inventory paths and Leave approver assignment. No side effect is treated as committed before the surrounding transaction commits.

### Role and grant changes

Employee, Routine, Stock and Leave transaction adapters use the persisted current role where their approved contract requires it, and call `resolveInTransaction()` with the current actor. The existing tests cover stale route-time role and transaction persistence context. A revoked/changed grant therefore denies in these transaction-sensitive paths unless that module's explicitly frozen `NO_APPLICABLE_GRANT` compatibility floor applies.

Structural errors remain errors/denials. They are not converted to compatibility authority:

```text
UNKNOWN_CAPABILITY
CHANNEL_NOT_SUPPORTED
invalid persisted scope/capability/origin
invalid Team/TeamRole membership origin
```

### Paths intentionally without transaction revalidation

- Employee create/import retain their documented direct/partial-success compatibility paths
- read-only query surfaces do not receive artificial transaction tests
- Notification read-state updates remain one-user-owned operations with trusted `userId` predicates
- filesystem upload uses immediate re-check, but cannot be DB-atomic

These are explicit current-state seams, not evidence that preflight authorization is permanent authority in a path that claims transaction revalidation.

## 7. Findings classification

### Confirmed safe behavior

- Central resolver receives trusted actor and server-selected capability, not request actor/role/channel/scope data
- Domain adapters retain their own meaning for OWN, CREATED and ASSIGNED
- TEAM grants retain origin evidence and invalid/no-origin Team authority fails closed
- ALL does not bypass lifecycle, workflow, validation, resource existence, version, idempotency or business invariants
- ADMIN does not bypass current account/workforce rules where required, nor domain invariants
- Routine creator and assignee relationships remain independent
- Stock requester ownership remains User-owned; Leave owner/approver relationships remain Employee-owned
- Transactional authorization/lifecycle failures occur before commit and existing rollback mechanisms preserve protected state

### Frozen compatibility behavior

- Routine USER work-item `scope=all` exact `NO_APPLICABLE_GRANT` bridge to `ALL`
- Employee direct create and row-by-row import behavior
- Employee broad read/stats/export, Stock compatibility floors, Leave compatibility floors and Notification eligible-user floor
- Deferred Routine summary/reference/export, deferred Leave reporting/participant/attachment/recovery decisions and LIFF Leave cancellation decision

### Accepted residual race

- Stock local filesystem upload still has a non-atomic post-recheck TOCTOU window. The Phase 11B.3 fix moves the current auth/capability check immediately before the write, but no DB transaction can roll back a local file already written.

### Real security defects fixed

- Routine could validate an active target Employee and then write an assignee relation without locking that Employee against lifecycle mutation. Target row locking now serializes the lifecycle decision and assignment.
- Leave approver assignment could read an active proposed approver and write the manager relation while that approver lifecycle changed. The affected/proposed Employee rows are now locked before eligibility is read.
- Leave exception fallback could read a stale owner.manager or fallback Admin snapshot. Owner locking plus candidate lock/re-read now makes the resolution use current transaction state.
- Stock image upload had no current authorization check between preflight and filesystem side effect. An immediate second check now blocks the meaningful stale-authority window that is observable before the write.

### Deferred policy question

The broad Routine work-item compatibility behavior remains intentionally unresolved. It needs an explicit product/security decision about the target visibility policy and migration-floor retirement; this Phase does not make that decision.

## 8. Evidence and verification

Existing suites reused include:

- central authorization resolver/origin suite
- Employee authorization and mutation/lifecycle/rollback suites
- Routine authorization, query, mutation, occurrence and LIFF route suites
- Stock authorization, request/inventory mutation, route and local-upload suites
- Leave authorization, active-employee transaction guard, request input/idempotency, approval/cancellation/not-taken route, approver assignment and exception-approver suites
- Audit and Notification authorization/query/persistence suites

New regression coverage:

- `modules/routine/application/authorization.test.ts`: exact Routine task-read compatibility views, structural-denial non-bridge, TEAM fail-closed domain translation and target Employee lock-before-re-read
- `modules/leave/application/approvals/approver-assignment.test.ts`: affected/proposed approver row lock coverage
- `modules/leave/application/approvals/exception-approver.test.ts`: owner lock and fallback Admin re-read coverage
- `__tests__/api/uploads-image-route.test.ts`: auth-before-parse, capability-before-parse, invalid input no-write, current re-check race and Admin capability boundary

Required checks:

| Command | Result |
|---|---|
| `npm run architecture:check` | passed |
| `npm run lint:strict` | passed |
| `npm run typecheck` | passed |
| `npm run test:run` | passed — 314 files / 2,759 tests |
| `git diff --check` | passed (Git emitted only the existing LF→CRLF normalization warning) |

Focused post-change verification already passed:

- 5 focused files, 82 tests passed for Routine/Leave exception/assignment/LINE notification/upload route
- 12 focused files, 238 tests passed for Routine mutations/queries, Leave and Stock mutation/route surfaces
- `typecheck` passed
- `lint:strict` passed

MySQL integration tests were not run because `TEST_DATABASE_URL` is not configured in this workspace. No CI/GitHub check is claimed.

## 9. Exact recommended Phase 11B.4 scope

Phase 11B.4 should be a separately approved **Routine work-item visibility policy decision and bounded migration plan**:

1. choose the target policy for Dashboard USER work-item `scope=all`
2. decide whether to retain, narrow, or retire the exact `NO_APPLICABLE_GRANT -> ALL` compatibility bridge
3. define grant seeding/readiness and rollout/rollback criteria without activating Team inference
4. update the affected Routine query/route tests and documentation only after that policy approval

It should not include new Team semantics, unrelated Leave/Employee broad-data policy, deferred exports/reports, or a general authorization-model redesign. Phase 11B.4 has not been started.
