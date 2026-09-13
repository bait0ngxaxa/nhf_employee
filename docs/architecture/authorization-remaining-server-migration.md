# Remaining Server Authorization Migration — Phase 9A

สถานะ: **Phase 9A — CLOSED**  
Baseline: `139022923f8bfd9db059bad2026ebd059e345287`  
วันที่: 2026-09-13  
Phase 9B: **NOT STARTED**  
Phase 9C: **NOT STARTED**

เอกสารนี้บันทึกการย้าย server authorization ของ Department, Audit read และ
Notification inbox ไปยัง domain-owned adapters และ central authorization
resolver โดยไม่เปลี่ยน locked authorization architecture, capability registry,
business behavior หรือ presentation.

## 1. Scope and execution context

Phase 9A ครอบคลุมเฉพาะ registered capabilities ต่อไปนี้:

| Capability | Scope | Channel | Production surface |
|---|---|---|---|
| `department.read` | `ALL` | `DASHBOARD` | `GET /api/departments` |
| `audit.read` | `ALL` | `DASHBOARD` | `GET /api/audit-logs` |
| `notification.inbox.read` | `OWN` | `DASHBOARD` | `GET /api/notifications`, `GET /api/notifications/all` |
| `notification.inbox.update` | `OWN` | `DASHBOARD` | `PATCH /api/notifications/[id]/read`, `POST /api/notifications/mark-all-read` |

HTTP `/api/**` เป็น transport surface ไม่ใช่ authorization channel. ทุก route
ใน scope ใช้ `requireApiSession()` เป็น authentication และ legacy API workforce
eligibility boundary ก่อนสร้าง trusted actor ที่มี `DASHBOARD` channel. Actor
ใช้ user ID และ role จาก authenticated server state เท่านั้น; target routes ไม่
รับ client role, capability claims, Team ID, Employee ID หรือ user ID มาเป็น
authority. สำหรับ capabilities ใน Phase 9A ไม่มี Employee relationship เป็น
resource scope จึงใช้ `employeeId: null` โดยตั้งใจ; active Employee lifecycle
ยังคงถูกบังคับโดย `requireApiSession()` ก่อนถึง adapter.

## 2. Domain authorization boundaries

### Department

`modules/department/application/authorization.ts` เป็น Department adapter เดียว
ที่ resolve `department.read` ผ่าน central resolver และบังคับ `ALL` ก่อนเรียก
`listDepartments()`. `requireApiSession()` ยังคงเป็น prerequisite ที่ตรวจ active
account และ eligible active Employee. เมื่อ resolver คืน `NO_APPLICABLE_GRANT`
จึงค่อยแปลเป็น compatibility scope `ALL` สำหรับ eligible authenticated API user
เพื่อคง behavior เดิม; explicit ALLOW เป็น authoritative และ denial เหตุอื่นไม่
ถูก compatibility กลบ.

Department query ยังคงเป็นเจ้าของ `findMany({ orderBy: { name: "asc" } })`,
reference representation, complete list และ response `{ departments }`. ไม่มีการ
ใช้ Department, `departmentId`, Department manager หรือชื่อ Department เพื่อ
อนุมาน Team หรือ authorization.

### Audit

`modules/audit/application/authorization.ts` เป็น Audit adapter สำหรับ
`audit.read / ALL`. Route เปลี่ยนจาก `requireAdminSession()` เป็น
`requireApiSession()` ที่คง custom `403` response factories เดิม แล้วให้ central
resolver ตัดสินใจ:

- ADMIN ได้ authority จาก central resolver (`SYSTEM_ROLE` grant)
- normal USER ที่มี explicit `audit.read / ALL` grant ผ่านได้โดยไม่ promote role
- normal USER ที่ไม่มี applicable grant (`NO_APPLICABLE_GRANT`) ยังคงถูกปฏิเสธ
- unknown capability, unsupported channel และ resolver/configuration failure ไม่
  ถูกแปลเป็น compatibility access

Audit query filters, pagination, serialization, retention, persistence และ
privacy semantics ไม่เปลี่ยน. `getAuditLogs()` จะไม่ถูกเรียกหลัง capability
authorization fail.

### Notification

`modules/notification/application/authorization.ts` resolve capability ตาม
operation โดยแยก read และ update:

- latest/history ใช้ `notification.inbox.read / OWN`
- mark-one-read/mark-all-read ใช้ `notification.inbox.update / OWN`
- `NO_APPLICABLE_GRANT` แปลเป็น compatibility scope `OWN` เฉพาะหลังผ่าน
  `requireApiSession()`; explicit ALLOW ใช้ scope จาก resolver
- read ไม่ imply update และ update ไม่ imply read
- adapter ปฏิเสธ scope ที่เป็น `ALL`; Notification inbox ไม่สามารถถูกขยายเป็น
  cross-user route โดยผล resolver ที่กว้างเกิน registered contract

Actor user ID ถูก parse จาก authenticated session ตาม behavior เดิม และส่งต่อ
จาก `authorization.actor.userId`. Notification domain/persistence ยังคงเป็นผู้
บังคับ ownership:

- latest/unread/history query ใช้ `where: { userId: actor.userId, ... }`
- mark one ใช้ `where: { id: notificationId, userId: actor.userId }`
- mark all ใช้ `where: { userId: actor.userId, isRead: false }`

ไม่มีการ fetch ทั้งระบบแล้ว filter ใน memory และไม่มี request query/body/route
user ID ที่ใช้แทน actor identity. Cursor, filter, unread count, response shape,
invalid-session `400`, unauthenticated response, missing/non-owned notification
behavior และ idempotent mark-all behavior คงเดิม.

## 3. Explicitly excluded boundaries

Audit routes ต่อไปนี้ไม่ใช่ `audit.read` และคง implementation เดิม:

- `POST /api/audit-logs/cleanup` เป็น maintenance/system boundary ที่ใช้
  `x-cleanup-secret`; ไม่ใช่ User capability
- `POST /api/audit-logs/export` บันทึก authenticated export event ผ่าน Audit
  instrumentation; ไม่ได้อ่าน Audit logs และไม่ใช่ authority ในการ export data

ไม่มีการย้าย Dashboard Audit page guard, menus, Notification presentation,
Department forms หรือ client capability visibility. Presentation work อยู่ใน
Phase 9B.

Email Request เป็น **REGISTERED BUT DEFERRED / NOT YET MIGRATED** สำหรับ future IT
module. Phase 9A ไม่แก้ `email.request.read`, `email.request.create`,
`app/api/email-request/**`, requester/admin policy หรือ Email Request
presentation และไม่ถือว่า Email Request migration เสร็จ.

## 4. Compatibility and invariants

Compatibility bridge ใช้เฉพาะ exact resolver reason `NO_APPLICABLE_GRANT` และไม่
override real resolver decisions:

| Domain | Explicit ALLOW | `NO_APPLICABLE_GRANT` | Other denial/configuration failure |
|---|---|---|---|
| Department | ใช้ resolver scope `ALL` | eligible API user ได้ legacy `ALL` | deny/propagate; ไม่ fallback |
| Audit | ใช้ resolver scope `ALL` รวม explicit normal USER | deny ตาม legacy Admin-only behavior | deny/propagate; ไม่ fallback |
| Notification | ใช้ capability เฉพาะและ `OWN` | eligible API user ได้ legacy own inbox `OWN` | deny/propagate; ไม่ fallback |

Authentication, active account และ legacy eligible workforce lifecycle ยังคงเป็น
prerequisite แยกจาก authorization. ADMIN ไม่ bypass lifecycle, validation,
resource ownership หรือ business rules. Department/Audit `ALL` ไม่มีการสร้าง
per-record scope; Notification `OWN` ไม่ถูกขยายเป็น `ALL`.

## 5. Verification

Focused Phase 9A invocation:

```text
npm.cmd run test:run -- modules/authorization/application/resolver.test.ts modules/department/application/authorization.test.ts modules/audit/application/authorization.test.ts modules/notification/application/authorization.test.ts __tests__/api/departments-route.test.ts __tests__/api/audit-log-route.test.ts __tests__/api/audit-log-cleanup-route.test.ts __tests__/api/notifications.test.ts modules/department/application/queries.test.ts modules/audit/application/queries.test.ts modules/notification/application/queries.test.ts modules/notification/application/commands.test.ts modules/notification/infrastructure/persistence/repository.test.ts
```

ผล: **13 test files และ 122 tests ผ่าน**. ชุดนี้ครอบคลุม resolver, adapter,
Department/Audit/Notification routes, Audit cleanup boundary, Notification
query/command/persistence ownership และ response compatibility.

Repository-required check ที่รันจริง:

```text
npm.cmd run check
```

ผล: ผ่านทั้งหมด — architecture check ตรวจ **1,058 source files**, strict lint
ผ่าน, typecheck ผ่าน และ full Vitest ผ่าน **294 test files / 2,584 tests**.

## 6. Phase 9B handoff

งานถัดไปที่ยังไม่เริ่มคือ presentation migration และ capability-derived
visibility ตาม scope ที่อนุมัติแยกต่างหาก. ยังไม่เปิด Team-based production
policy, ไม่ retire compatibility floors, ไม่เพิ่ม explicit DENY และไม่ย้าย
Email Request/future IT module.
