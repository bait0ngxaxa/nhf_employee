# Remaining Presentation Authorization Migration — Phase 9B

สถานะ: **Phase 9B — CLOSED**
Phase 9A: **CLOSED**
Phase 9C: **NOT STARTED**
วันที่: 2026-09-13

เอกสารนี้บันทึกการเชื่อมต่อ presentation และ Dashboard entry points ของ
capabilities ที่ย้าย server authorization ใน Phase 9A แล้ว โดย presentation
projection เป็น trusted UX/entry-point projection เท่านั้น ไม่ใช่ security
authority แทน API

## 1. ขอบเขตและ capability mapping

Phase 9B เพิ่มเฉพาะ immutable domain-owned projections ต่อไปนี้:

| Server capability | Presentation field | Scope ที่ตรวจ | Domain |
|---|---|---|---|
| `department.read` | `canReadDepartments` | `ALL` | Department reference data |
| `audit.read` | `canReadAuditLogs` | `ALL` | Audit Dashboard |
| `notification.inbox.read` | `canReadInbox` | `OWN` | Notification inbox |
| `notification.inbox.update` | `canUpdateInbox` | `OWN` | Notification read-state mutations |

ไม่มีการเพิ่ม capability key, wildcard, explicit DENY, Team policy หรือ
Department-as-Team semantics

Projection functions อยู่ใน domain application authorization boundary:

- `getDepartmentPresentationCapabilities()` ใน Department
- `getAuditPresentationCapabilities()` ใน Audit
- `getNotificationPresentationCapabilities()` ใน Notification

แต่ละ function เรียก `authorization.resolveMany()` ตาม inventory ของ domain,
ใช้ decision/compatibility translation ของ Phase 9A และคืน `Object.freeze()`
เท่านั้น. Decision ที่ resolver omit หรือ `UNKNOWN_CAPABILITY` ไม่ถูกแปลงเป็น
allow; resolver/configuration failure ถูกปล่อยต่อ; structural denial ถูก
project เป็น unavailable ตาม precedent ของ presentation projections เดิม

## 2. Semantics ที่คงจาก Phase 9A

### Department

`department.read / ALL` ที่ resolver ALLOW ให้ `canReadDepartments: true`.
หลังผ่าน authenticated account และ current active Employee แล้ว
`NO_APPLICABLE_GRANT` ยังคงใช้ compatibility `ALL` สำหรับ reference-data
visibility. Scope อื่นและ structural denial ไม่ทำให้ field เป็น allow.

Department ยังเป็น reference data เท่านั้น ไม่มีหน้า Dashboard, menu,
administration UI หรือการอนุมานสิทธิ์จาก Employee/Department/Team

### Audit

`audit.read / ALL` ใช้ผลจาก central resolver โดยตรง:

- ADMIN ได้ผลจาก central `SYSTEM_ROLE` authority
- normal USER ที่มี explicit User/Team/TeamRole grant เปิด Audit ได้
- USER ที่ได้ `NO_APPLICABLE_GRANT` ถูก project เป็น `false`
- ไม่มี role-local compatibility หรือ `requiredRole: ADMIN` เป็น Audit authority

### Notification

`canReadInbox` และ `canUpdateInbox` ถูก project แยกกันจาก
`notification.inbox.read / OWN` และ `notification.inbox.update / OWN` ใน
`resolveMany()` เดียว:

```text
READ ≠ UPDATE
```

Phase 9A compatibility สำหรับ `NO_APPLICABLE_GRANT` ยังคงเป็น `OWN` ต่อ
capability เท่านั้น ไม่เคยแปลเป็น `ALL`. ดังนั้น read-only user อ่านและนำทาง
ได้โดยไม่มี PATCH/POST read-state mutation; update-only user ไม่มี inbox
presentation

## 3. Trusted current-user projection

`app/_lib/auth/current-user.ts` ยังคงรักษาลำดับ:

```text
authenticated account
    -> current active Employee projection
    -> trusted DASHBOARD actors
    -> domain presentation projections
    -> AuthenticatedUser / DashboardUser
```

หลัง current active Employee สำเร็จ projection ของ Department, Audit,
Notification และ projection เดิม Leave/Routine/Stock/Employee ถูก resolve แบบ
อิสระใน `Promise.all()`. Actor ทุกตัว derive จาก authenticated account `userId`,
`role`, current Employee ID และ `DASHBOARD`; ไม่มี browser-supplied permission
state, user ID หรือ role ที่ใช้เป็น authority

`AuthenticatedUser` และ `DashboardUser` จึงมี:

```text
departmentCapabilities
auditCapabilities
notificationCapabilities
```

client auth refresh ยังคงรับ trusted `AuthenticatedUser` จาก `/api/auth/me`
และไม่ fetch raw grants; field ใหม่จึงอยู่ใน projection เดียวกับ SSR initial
user

## 4. Audit Dashboard presentation

Audit menu ใช้ `auditCapabilities.canReadAuditLogs === true` ใน
`getAvailableMenuGroups()` และ `DashboardProvider.handleMenuClick()`.
Audit menu จึงรองรับ normal USER ที่มี explicit `audit.read / ALL` และไม่ใช้
role เป็น authority ส่วน Email Request ยังคงใช้ `requiredRole: ADMIN` ตามเดิม

`/dashboard/audit` ใช้ trusted server-side
`requireDashboardAuditCapability()`:

```text
ไม่มี trusted current user -> /login
มี user แต่ canReadAuditLogs !== true -> /access-denied
canReadAuditLogs === true -> render Audit surface
```

`requireDashboardAdmin()` ไม่ถูกแก้และยังคงใช้กับ deferred/legacy surfaces เช่น
Email Request

## 5. Notification presentation

`DashboardNavbar` mount `NotificationDropdown` เฉพาะเมื่อ
`canReadInbox === true`; เมื่อไม่มี read capability จะไม่มี inbox SWR request
จาก Navbar และไม่มี divider ของ dropdown ที่ถูกทิ้งค้างไว้

`/dashboard/notifications` เป็น server RSC boundary ที่ตรวจ current-user
projection ก่อน compose client section:

```text
ไม่มี user -> /login
ไม่มี canReadInbox -> /access-denied
มี canReadInbox -> render NotificationsSection
```

page ส่ง `canUpdateInbox` เป็น serializable prop ลง client surface:

- read + update: mark-one และ mark-all behavior เดิมยังทำงาน
- read-only: history, dropdown, action/navigation links ยังทำงาน แต่ไม่เรียก
  `PATCH /api/notifications/[id]/read`, ไม่เรียก
  `POST /api/notifications/mark-all-read` และไม่แสดง mutation controls
- update-only: ไม่ mount dropdown และไม่ compose Notifications page
- neither: ไม่มี inbox presentation

เมื่อคลิก notification แบบ read-only ระบบข้าม mark-read mutation แต่ยังคง
normalize และนำทางไปยัง action URL ที่ถูกต้อง

## 6. Department reference-data consumers

จากการค้นหา production callers พบ Employee Add และ Edit forms เป็นผู้บริโภค
`GET /api/departments` ผ่าน SWR:

- Add Employee ใช้ key เป็น route เฉพาะเมื่อ `canReadDepartments === true`
- Edit Employee ใช้ key เป็น route เฉพาะเมื่อ form เปิดและ read capability เป็น
  true
- ไม่มีการใช้ `employee.create`, `employee.update`, `employee.read` หรือ ADMIN
  role แทน `department.read`

เมื่อไม่มี Department read capability selector ถูกปิดและแสดงสถานะไม่มีสิทธิ์
เข้าถึงข้อมูลอ้างอิง แยกจากกรณี authorized empty dataset. `departmentId` ยังคง
required ตาม schema เดิม; Add flow จึงไม่เสนอ submit ที่ใช้งานไม่ได้ ขณะที่ Edit
ยังแก้ฟิลด์อื่นได้และรักษา Department เดิมใน form state. ไม่มีการเปลี่ยน
Employee validation หรือ business rules

## 7. Server-authority invariant และ Email Request guardrail

Phase 9A server routes ไม่เปลี่ยน:

```text
GET /api/departments -> department.read / ALL
GET /api/audit-logs -> audit.read / ALL
GET /api/notifications, /all -> notification.inbox.read / OWN
PATCH /api/notifications/[id]/read,
POST /api/notifications/mark-all-read -> notification.inbox.update / OWN
```

Presentation booleans ไม่ถูกส่งเป็น claims ไปยัง API และ forged browser state
ยังต้องถูกปฏิเสธที่ server boundary

Email Request / future IT module ยังคง **DEFERRED**. Phase 9B ไม่ย้าย
`email.request.read`, `email.request.create`, `/dashboard/email-request`,
`app/api/email-request/**`, Email Request provider/context หรือ requester/admin
policy. Generic `requiredRole` support จึงยังคงอยู่สำหรับ Email Request และ
surface ที่ยัง deferred

## 8. Verification

Focused Phase 9B presentation invocation:

```text
npm.cmd exec vitest run modules/department/application/presentation-capabilities.test.ts modules/audit/application/presentation-capabilities.test.ts modules/notification/application/presentation-capabilities.test.ts modules/notification/presentation/dashboard/NotificationDropdown.test.tsx modules/notification/presentation/dashboard/NotificationsPageContent.test.tsx modules/employee/presentation/dashboard/employee-department-reference.test.tsx __tests__/auth/current-user-projection.test.ts __tests__/constants/dashboard-menu.test.ts __tests__/context/DashboardProvider.test.tsx __tests__/components/DashboardNavbar.test.tsx __tests__/dashboard-route-access.test.ts __tests__/dashboard-presentation-pages.test.tsx
```

ผล: **12 test files และ 92 tests ผ่าน**

Phase 9A server regression invocation:

```text
npm.cmd exec vitest run modules/department/application/authorization.test.ts modules/audit/application/authorization.test.ts modules/notification/application/authorization.test.ts __tests__/api/departments-route.test.ts __tests__/api/audit-log-route.test.ts __tests__/api/notifications.test.ts
```

ผล: **6 test files และ 48 tests ผ่าน**

ตรวจเพิ่มเติมที่ผ่านแล้ว: `npm.cmd run typecheck`,
`npm.cmd run lint:strict` และ `npm.cmd run architecture:check`.
ผล architecture check ตรวจ module boundaries ของ source repository โดยไม่
สร้าง Department client entry และคง Department server-only boundary

Repository-required check:

```text
npm.cmd run check
```

ผล: ผ่านทั้งหมด — architecture check ตรวจ **1,067 source files**, strict lint
ผ่าน, typecheck ผ่าน และ full Vitest ผ่าน **301 test files / 2,634 tests**.

## 9. Phase 9C handoff

Phase 9B ปิดเฉพาะ remaining presentation integration ของ Phase 9A capabilities.
Phase 9C ยังไม่เริ่ม และต้องไม่ตีความเอกสารนี้ว่าได้ทำสิ่งต่อไปนี้:

- complete-surface closure ของ capability อื่น
- Authorization Administration UI, grant assignment หรือ effective inspector
- Team-based production policy activation
- explicit DENY, wildcard permissions หรือ compatibility-floor retirement
- Email Request/future IT module migration
- server authorization, Audit persistence, Notification persistence หรือ
  Employee business-rule redesign
