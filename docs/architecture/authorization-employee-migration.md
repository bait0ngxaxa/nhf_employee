# Employee Authorization Migration — Phase 8A

สถานะ: Phase 8A **server authorization migration — CLOSED**<br>
Phase 8B **presentation capability migration — NOT STARTED**<br>
Phase 8C **complete-surface audit and regression hardening — NOT STARTED**<br>
ขอบเขต: Employee server operations เท่านั้น; ไม่รวม Employee presentation, Department หรือ Team policy

เอกสารนี้บันทึกการย้าย authoritative Employee server authorization จาก
`requireAdminSession()`/authenticated-only route decisions ไปยัง Employee-owned
adapter และ central authorization resolver โดยคง compatibility behavior เดิมตาม
[authorization-contract.md](authorization-contract.md),
[authorization-resolver.md](authorization-resolver.md) และ precedent ของ
[authorization-stock-migration.md](authorization-stock-migration.md) กับ
[authorization-leave-migration.md](authorization-leave-migration.md)

## 1. Registered capability mapping

ใช้ Capability Registry เดิมเป็น source of truth โดย Phase 8A ไม่เพิ่ม เปลี่ยน
ลบ หรือขยาย capability, scope หรือ channel:

| Capability | Scope | Execution channel | Server operation |
|---|---|---|---|
| `employee.read` | `ALL` | `DASHBOARD` | `GET /api/employees` |
| `employee.stats.read` | `ALL` | `DASHBOARD` | `GET /api/employees/stats` |
| `employee.create` | `ALL` | `DASHBOARD` | `POST /api/employees` |
| `employee.update` | `ALL` | `DASHBOARD` | `PATCH /api/employees/:id` |
| `employee.delete` | `ALL` | `DASHBOARD` | `DELETE /api/employees/:id` |
| `employee.import` | `ALL` | `DASHBOARD` | `POST /api/employees/import` |
| `employee.export` | `ALL` | `DASHBOARD` | `GET /api/employees/export` |

`/api/**` เป็น transport surface เท่านั้น ไม่ใช่ authorization channel; routes
ทั้งหมดในขอบเขตนี้สร้าง actor ด้วย `DASHBOARD` และไม่สร้าง `API` channel

## 2. Employee authorization boundary

`modules/employee/application/authorization.ts` เป็น boundary เดียวของ Employee
ที่รับผิดชอบ:

- สร้าง trusted `AuthorizationActor` จาก authenticated API/session user และ
  fixed `DASHBOARD` channel
- เรียก `authorization.resolve()` และ
  `authorization.resolveInTransaction()` ผ่าน central resolver
- ตรวจ capability ที่อยู่ใน Employee inventory และบังคับ scope `ALL`
- แปล compatibility floor เฉพาะเมื่อ decision มี reason เป็น
  `NO_APPLICABLE_GRANT`
- re-read และ lock current User/Employee lifecycle ก่อน transaction-backed
  update/delete capability resolution

ลำดับการตัดสินใจคือ:

```text
requireApiSession() / current API workforce eligibility
  -> Employee adapter + central resolver
  -> explicit ALLOW: honor resolver scopes, including normal USER grants
  -> NO_APPLICABLE_GRANT: apply the recorded compatibility floor
  -> UNKNOWN_CAPABILITY, unsupported channel, configuration/persistence failure
     or any other unexpected failure: deny or propagate; never use the floor
  -> Employee lifecycle/resource/business invariants
  -> persistence and existing audit/account-session effects
```

Explicit `ALLOW` เป็น authoritative แม้ actor จะเป็น `USER`; system role จะมี
ความหมายใน compatibility floor เท่านั้น ไม่ใช่การ promote actor และไม่ใช่
business-rule bypass

## 3. Compatibility floor

Compatibility ใช้ได้เฉพาะ `NO_APPLICABLE_GRANT` และคง behavior ก่อน migration:

| Capability | `NO_APPLICABLE_GRANT` compatibility |
|---|---|
| `employee.read` | `ALL` สำหรับ eligible authenticated API actor |
| `employee.stats.read` | `ALL` สำหรับ eligible authenticated API actor |
| `employee.export` | `ALL` สำหรับ eligible authenticated API actor |
| `employee.create` | `ALL` เฉพาะ current system role `ADMIN` |
| `employee.update` | `ALL` เฉพาะ current system role `ADMIN` |
| `employee.delete` | `ALL` เฉพาะ current system role `ADMIN` |
| `employee.import` | `ALL` เฉพาะ current system role `ADMIN` |

ดังนั้น normal `USER` ที่ไม่มี applicable grant ยังอ่าน list/stats/export ได้ตาม
เดิม แต่ไม่ผ่าน mutation compatibility floor; normal `USER` ที่มี effective
explicit grant สามารถผ่าน capability boundary ได้โดยไม่เปลี่ยน role เป็น `ADMIN`

## 4. Route and application migration

Employee routes ยังคงใช้ `requireApiSession()` เป็น authentication และ legacy
workforce eligibility boundary เพื่อคง active/non-deleted User และ Employee
semantics รวมถึง route-specific 401/403 behavior และ validation ordering:

- list ตรวจ query ก่อน `employee.read / ALL`; query ยังคง organization-wide
- stats ตรวจ `employee.stats.read / ALL`; aggregate query และ filtering เดิม
  ไม่เปลี่ยน
- export ตรวจ user identity/filter validation ก่อน `employee.export / ALL`;
  export query, bootstrap/deleted filtering, row limit, batching, CSV/Thai
  header และ audit callback เดิม
- create/import ตรวจ capability หลัง authentication และก่อนอ่าน request body
  เพื่อคง auth-before-body behavior; import ยังคง limit 1,000 rows และ
  row-by-row partial success
- update ยังคง parse id/body/schema ก่อน authentication ตาม route contract แล้ว
  ตรวจ `employee.update / ALL`
- delete ยังคง authenticate ก่อน parse id แล้วตรวจ
  `employee.delete / ALL`

Mutation application commands receive an `EmployeeAuthorizedCommandActor`; no
production Employee mutation retains a plain role/email-only actor as an
authorization authority

## 5. Transaction-time authorization and domain invariants

Existing serializable Employee update/delete transactions now call
`resolveEmployeeCapabilityInTransaction()` before existing Employee locks and
business rules. The adapter locks/re-reads the current actor User and linked
Employee, derives the current persisted role/Employee identity, and invokes the
central resolver with the transaction persistence context. A stale route-time
role or capability decision is not reused.

This boundary does not replace Employee lifecycle or domain authority. The
following remain unchanged and continue to run after authorization succeeds:

- self-offboarding prevention and last-active-Admin protection
- subordinate and Leave offboarding dependencies
- linked User synchronization, account deactivation and refresh-session
  revocation
- target/actor row locks, serializable transaction and concurrency behavior
- Employee lifecycle and fallback audit ordering/semantics
- existing not-found, validation and domain conflict outcomes

Create remains the existing direct persistence path. Import does not gain a new
large transaction; its 1,000-row limit and partial-success behavior remain
row-by-row as before

## 6. Query, Department and Team boundaries

`employee.read / ALL`, `employee.stats.read / ALL` and `employee.export / ALL`
do not introduce Team or Department filtering. List/export retain their
non-deleted/bootstrap-account filtering, while stats retains its existing
organization-wide aggregate behavior, including its deliberate filtering
difference from list/export.

No Employee authorization decision is derived from `departmentId`, Department
name, Team name or magic TeamRole name. Team/TeamRole/User grants are consumed
only by the central resolver; Employee owns no grant persistence or duplicate
permission table

## 7. Audit and presentation boundaries

Employee create/update/delete/export audit behavior remains in its existing
Employee/audit producers. The adapter does not emit, suppress, duplicate or
reorder audit events. Authorization configuration remains owned by the
authorization subsystem.

Phase 8A does not migrate Employee Dashboard presentation capability checks,
`isAdmin` UI behavior, menu visibility or UI control projections. Those are
Phase 8B work. Complete production-surface audit and additional regression
hardening are Phase 8C work

## 8. Focused regression coverage

`modules/employee/application/authorization.test.ts` covers the adapter
inventory, trusted Dashboard actor, broad read/export and Admin mutation
compatibility, explicit normal-USER grants, exact fallback reason handling,
scope assertions, current lifecycle re-read/locking and transaction resolver
calls.

`modules/employee/application/mutations.test.ts` continues to cover Employee
profile/lifecycle behavior, self-offboarding, last active Admin, subordinate
and Leave dependencies, account synchronization, refresh revocation, locking,
rollback and audit behavior with the authorization revalidation seam present.

`__tests__/api/employees-routes.test.ts` and
`__tests__/api/authorization-current-state.test.ts` cover route composition,
read/stats/export capability entry points, explicit USER mutation reachability,
capability-denial HTTP 403 behavior, no service/audit scheduling after denial,
auth-before-body, invalid IDs, audit scheduling and import row limits.

No Employee authorization schema, seed grant, scope, registry entry or new
transaction architecture was added

## 9. Complete-surface audit and closure state

Repository search accounted for the seven registered Employee server operations
under `app/api/employees/**`: list, stats, export, create, update, delete and
import. No separate Employee detail GET route or additional registered
Employee server operation was found. The audit export logging endpoint
(`POST /api/audit-logs/export`) records an event only; it is not the Employee
data-export authority and remains outside this capability migration.

Phase 8A is **CLOSED** for the registered Employee server capabilities.
Employee presentation capability migration remains **Phase 8B — NOT STARTED**.
Employee complete-surface audit and regression hardening remains
**Phase 8C — NOT STARTED**
