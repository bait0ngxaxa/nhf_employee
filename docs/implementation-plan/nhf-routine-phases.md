# NHF Routine Module — Phase-by-Phase Implementation Prompts

## วิธีใช้งาน

1. ส่ง **Prompt: Phase 1** ให้ Agent
2. ตรวจ code diff, migration, test และทดลอง flow
3. แก้ข้อบกพร่องของ Phase 1 ให้จบ
4. Merge หรือ commit checkpoint
5. จึงส่ง **Prompt: Phase 2**
6. ทำตามลำดับจนถึง Phase 4

ห้ามส่งทุก Phase พร้อมกัน เพราะต้องการให้ Agent หยุดหลังจบแต่ละ Phase เพื่อให้ตรวจ architecture และ data integrity ก่อนเดินหน้าต่อ

---

# Prompt: Phase 1 — Core Routine Task Management

คุณกำลังทำงานใน repository `nhf_employee`

ต้องการเพิ่มโมดูลใหม่ชื่อ **NHF Routine** สำหรับบันทึกและติดตามงานประจำขององค์กร โดยยึดรูปแบบข้อมูลจากไฟล์:

`NHF Routine list_cost_update270625.xls`

Phase นี้เป็น **Core Vertical Slice** เท่านั้น:

> Admin สร้างแม่แบบงานได้ → ระบบสร้างงานแต่ละรอบ → ผู้รับผิดชอบเห็นงานของตนเอง → เริ่มงานและปิดงานได้ → มีประวัติและ Audit Log

## กฎสำคัญก่อนเริ่ม

1. ตรวจสอบ codebase ปัจจุบันก่อนแก้ไข ห้ามออกแบบจากสมมติฐาน
2. ใช้ architecture และ coding pattern ที่ repository ใช้อยู่
3. รักษา encoding ภาษาไทยเป็น UTF-8 ห้ามเกิด mojibake
4. ห้ามเปลี่ยนข้อความภาษาไทยเป็นภาษาอังกฤษโดยไม่ได้รับอนุญาต
5. ตรวจ official documentation หรือ Context7 เมื่อไม่แน่ใจ API ของ Next.js, Prisma, Zod หรือ library ที่ใช้
6. ให้ความสำคัญตามลำดับ:

   * Correctness
   * Data integrity
   * Security
   * Maintainability
   * Performance
7. ใช้หลัก KISS, SRP, DRY และ early return
8. ห้าม over-engineer เป็น generic workflow engine
9. ห้าม implement ระบบแจ้งเตือน, Excel importer, LINE digest หรือ holiday calendar ใน Phase นี้
10. ห้ามเริ่ม Phase 2 หลังทำ Phase นี้เสร็จ
11. รันเฉพาะ:

    * lint
    * typecheck
    * test ที่เกี่ยวข้อง
    * test suite หากจำเป็นเพื่อตรวจ regression
12. ไม่ต้องพยายามรัน dev server หรือ production build เว้นแต่มีเหตุผลจำเป็นและอธิบายไว้

---

## 1. วิเคราะห์ Codebase ก่อนแก้ไข

ตรวจสอบอย่างน้อย:

* `prisma/schema.prisma`
* authentication และ authorization helpers
* ความสัมพันธ์ `User`, `Employee`, `Department`
* `AuditLog` และ `AuditAction`
* dashboard menu และ dashboard section routing
* feature flag system
* API route conventions
* service/command/query pattern ของโมดูล Leave และ Stock
* validation pattern ด้วย Zod
* error response และ SSOT routes/messages
* test conventions ของ repository

ก่อน implement ให้สรุปสั้น ๆ ใน reasoning หรือ working notes ว่าจะ reuse pattern ใดบ้าง

---

## 2. ขอบเขต Data Model

เพิ่ม model สำหรับ NHF Routine โดยให้ชื่อและรายละเอียด final สอดคล้องกับ naming convention ของ repository

### 2.1 RoutineUnit

ใช้แทนหน่วยงานตามไฟล์ Excel เช่น:

* มสช.
* ม.สคส.
* มสส.
* มส.ผส.

ห้ามใช้ `Department` แทน เพราะมีความหมายทางธุรกิจต่างกัน

ข้อมูลขั้นต่ำ:

* id
* code unique
* name
* isActive
* createdAt
* updatedAt

### 2.2 RoutineCategory

ข้อมูลขั้นต่ำ:

* id
* name unique
* sortOrder
* isActive

หมวดเริ่มต้น:

* สาธารณูปโภค
* อาคาร / สถานที่
* ระบบคอมพิวเตอร์
* บุคลากร
* ยานพาหนะ
* การเงิน / บัญชี
* อื่น ๆ

### 2.3 RoutineTask

RoutineTask คือแม่แบบงานประจำ ไม่ใช่งานแต่ละรอบ

ข้อมูลขั้นต่ำ:

* id
* unitId
* categoryId
* title
* description nullable
* scheduleType
* scheduleConfig JSON nullable
* scheduleText nullable
* contractStartDate nullable
* contractEndDate nullable
* contractText nullable
* extraDetails nullable
* businessDayPolicy
* isActive
* version สำหรับ optimistic concurrency
* sourceFileName nullable
* sourceSheet nullable
* sourceRow nullable
* createdById
* updatedById
* createdAt
* updatedAt

รองรับ schedule type ใน Phase นี้:

* `MONTHLY_DAY`
* `MONTH_END`
* `INTERVAL_MONTHS`
* `YEARLY_DATE`
* `ONE_TIME`
* `MANUAL`

ยังไม่ต้อง implement `RELATIVE_EVENT` ใน Phase นี้

Business-day policy ใน Phase นี้รองรับ enum ไว้ก่อน:

* `NONE`
* `PREVIOUS_BUSINESS_DAY`
* `NEXT_BUSINESS_DAY`

แต่ยังไม่ต้องสร้าง holiday calendar ให้เลื่อนเฉพาะเสาร์–อาทิตย์ก่อน พร้อมเขียน limitation ไว้ชัดเจน

### 2.4 RoutineTaskAssignee

ผูกผู้รับผิดชอบกับ `Employee` ไม่ใช่ `User`

เหตุผล:

* ความรับผิดชอบเป็นข้อมูลบุคลากร
* Employee อาจยังไม่มีบัญชีผู้ใช้
* ประวัติหน้าที่ไม่ควรหายตาม User session

รองรับ:

* `OWNER`
* `CO_OWNER`

ใช้ composite unique หรือ composite primary key เพื่อป้องกัน assignee ซ้ำ

### 2.5 RoutineOccurrence

RoutineOccurrence คืองานแต่ละรอบที่เกิดขึ้นจริง

ข้อมูลขั้นต่ำ:

* id
* taskId
* periodKey
* dueDate แบบ date
* originalDueDate แบบ date
* status
* scheduleVersion
* startedAt nullable
* completedAt nullable
* completedById nullable
* completionNote nullable
* referenceNo nullable
* skippedAt nullable
* skippedById nullable
* skipReason nullable
* cancelledAt nullable
* cancelledById nullable
* cancellationReason nullable
* createdAt
* updatedAt

Status:

* `TODO`
* `IN_PROGRESS`
* `COMPLETED`
* `SKIPPED`
* `CANCELLED`

ห้ามเก็บ `OVERDUE` เป็น persisted status

ให้คำนวณ overdue จาก:

* status ยังไม่ terminal
* dueDate น้อยกว่าวันปัจจุบันใน timezone `Asia/Bangkok`

ต้องมี unique constraint:

* `[taskId, periodKey]`

เพื่อป้องกัน occurrence รอบเดียวกันถูกสร้างซ้ำ

### 2.6 RoutineOccurrenceAssignee

ต้อง snapshot ผู้รับผิดชอบของแต่ละ occurrence

เหตุผล:

* เมื่อเปลี่ยนผู้รับผิดชอบของ RoutineTask ในอนาคต
* occurrence เก่าต้องยังแสดงผู้รับผิดชอบเดิม

ข้อมูลขั้นต่ำ:

* occurrenceId
* employeeId
* role

---

## 3. Schedule Engine

สร้าง pure functions สำหรับคำนวณ occurrence และ due date

ห้ามฝัง logic วันที่กระจายใน API route หรือ React component

ตัวอย่าง config:

### MONTHLY_DAY

```json
{
  "day": 10,
  "monthOffset": 0
}
```

### MONTH_END

```json
{}
```

### INTERVAL_MONTHS

```json
{
  "intervalMonths": 3,
  "anchorDate": "2026-01-01"
}
```

### YEARLY_DATE

```json
{
  "month": 3,
  "day": 31
}
```

### ONE_TIME

```json
{
  "date": "2026-07-21"
}
```

### MANUAL

ไม่สร้าง occurrence อัตโนมัติ

กฎที่ต้องรองรับ:

* วันที่ 31 ต้องไม่ overflow ไปเดือนถัดไป
* `MONTH_END` ใช้วันสุดท้ายจริงของเดือน
* leap year
* `monthOffset`
* interval months จาก anchor date
* annual date
* previous/next weekday สำหรับเสาร์–อาทิตย์
* ประมวลผลวันที่ตาม `Asia/Bangkok`
* หลีกเลี่ยง timezone conversion ที่ทำให้วันเลื่อน

---

## 4. Occurrence Generation

สร้าง service สำหรับ generate occurrence ของ RoutineTask

ต้องมีคุณสมบัติ:

* idempotent
* เรียกซ้ำแล้วไม่สร้างข้อมูลซ้ำ
* ใช้ `[taskId, periodKey]` เป็น database safety net
* snapshot assignees ตอนสร้าง occurrence
* เก็บ `scheduleVersion` จาก task version
* ไม่สร้าง occurrence ของ inactive task
* ไม่สร้าง occurrence ของ `MANUAL`
* ไม่สร้าง occurrence ที่เลยช่วงสัญญา หากมี `contractEndDate`
* ไม่ generate occurrence ย้อนหลังจำนวนมากโดยไม่ตั้งใจ

สำหรับ Phase 1 ให้สร้าง occurrence ผ่าน:

1. ตอน Admin สร้าง RoutineTask
2. ตอน Admin แก้ schedule
3. Admin action หรือ internal service สำหรับ generate ช่วงเวลาที่กำหนด

ยังไม่ต้องสร้าง cron endpoint ใน Phase นี้

กำหนด generation horizon แบบเรียบง่าย เช่น:

* เดือนปัจจุบัน
* ล่วงหน้า 2 เดือน

ให้รวมค่าดังกล่าวไว้ใน service constant หรือ config ที่หาได้ง่าย ห้ามกระจาย magic number

---

## 5. Authorization

### User ทั่วไป

สามารถ:

* ดู occurrence ที่ตนเองเป็น assignee
* ดูรายละเอียด occurrence ของตนเอง
* เปลี่ยนจาก `TODO` เป็น `IN_PROGRESS`
* เปลี่ยนจาก `TODO` หรือ `IN_PROGRESS` เป็น `COMPLETED`

ไม่สามารถ:

* ดูงานของผู้อื่น
* สร้างหรือแก้ RoutineTask
* เปลี่ยน due date
* skip
* cancel
* reopen
* reassign

### Admin

สามารถ:

* ดูงานทั้งหมด
* สร้างและแก้ RoutineTask
* activate/deactivate task
* ดู occurrence ทั้งหมด
* skip occurrence พร้อมเหตุผล
* cancel occurrence พร้อมเหตุผล
* reopen occurrence พร้อมเหตุผล
* เปลี่ยน due date พร้อมเหตุผล
* เปลี่ยน assignee ของ occurrence

ทุก write operation ต้องตรวจ:

* User active
* Employee active หาก operation เป็นของ workforce
* Employee ไม่ถูก soft delete
* authorization ภายใน server
* ห้ามพึ่งการซ่อนปุ่มฝั่ง UI เป็น security boundary

---

## 6. Transaction และ Concurrency

คำสั่งสำคัญต้องทำใน Prisma transaction เดียว

### การ Complete งาน

ใน transaction:

1. อ่าน occurrence ปัจจุบัน
2. ตรวจสิทธิ์ assignee หรือ admin
3. ตรวจ current status
4. ป้องกัน complete ซ้ำ
5. update status
6. บันทึก completedAt
7. บันทึก completedById
8. บันทึก note/reference
9. เขียน AuditLog
10. commit

### การแก้ RoutineTask

ใช้ `version` ป้องกัน lost update

ตัวอย่าง:

* Client ส่ง version ปัจจุบัน
* update ต้องมี where id + version
* increment version เมื่อสำเร็จ
* หากไม่ตรงให้ตอบ `409 Conflict`
* ห้าม silently overwrite

### การแก้ due date

ต้องเก็บ:

* originalDueDate
* dueDate ใหม่
* ผู้แก้
* เหตุผลใน AuditLog

---

## 7. Audit Log

เพิ่ม `AuditAction` อย่างน้อย:

* `ROUTINE_TASK_CREATE`
* `ROUTINE_TASK_UPDATE`
* `ROUTINE_TASK_DEACTIVATE`
* `ROUTINE_OCCURRENCE_START`
* `ROUTINE_OCCURRENCE_COMPLETE`
* `ROUTINE_OCCURRENCE_SKIP`
* `ROUTINE_OCCURRENCE_CANCEL`
* `ROUTINE_OCCURRENCE_REOPEN`
* `ROUTINE_OCCURRENCE_REASSIGN`
* `ROUTINE_OCCURRENCE_DUE_DATE_CHANGE`

รายละเอียด audit ควรมีเฉพาะข้อมูลที่จำเป็นและ parse ได้ เช่น JSON:

* taskId
* occurrenceId
* oldStatus
* newStatus
* oldDueDate
* newDueDate
* reason
* affectedEmployeeIds

ห้ามเก็บ secret หรือข้อมูล authentication

---

## 8. API

สร้าง route ตาม convention ปัจจุบันของ repository

อย่างน้อย:

```text
GET  /api/routines/summary
GET  /api/routines/occurrences
GET  /api/routines/occurrences/[id]
PATCH /api/routines/occurrences/[id]/status

GET  /api/routines/tasks
POST /api/routines/tasks
GET  /api/routines/tasks/[id]
PATCH /api/routines/tasks/[id]
```

ถ้าจำเป็นสามารถแยก admin commands เช่น:

```text
PATCH /api/routines/occurrences/[id]/due-date
PATCH /api/routines/occurrences/[id]/assignees
POST  /api/routines/occurrences/[id]/reopen
```

ข้อกำหนด API:

* validation ด้วย Zod
* consistent error responses
* pagination สำหรับ list
* filter อย่างน้อย:

  * status
  * unit
  * category
  * assignee
  * due date range
  * search
* sort งานใกล้ครบกำหนดก่อน
* User ถูกบังคับ filter เป็น employee ของตนเองใน server
* ห้ามรับ employeeId จาก client แล้วเชื่อว่าเป็นเจ้าของงาน

เพิ่ม route constants ใน SSOT routes

---

## 9. Feature Flag และ Navigation

เพิ่ม feature flag:

```dotenv
NEXT_PUBLIC_FEATURE_ROUTINE=false
```

แก้ feature SSOT ตาม pattern เดิม

เพิ่ม dashboard tab:

```text
routine
```

เพิ่มเมนูในกลุ่ม “แอปพลิเคชัน”:

```text
NHF Routine
บันทึกและติดตามงานประจำขององค์กร
```

เพิ่ม:

* menu item
* page label
* page title
* menu theme
* dynamic section import
* dashboard content routing
* tests ของ menu/feature flag

ห้ามเปิด feature เป็น production default

---

## 10. UI — MVP

สร้าง `RoutineSection` และ component ย่อยตามความเหมาะสม

หน้าแรกมี KPI:

* งานวันนี้
* ใกล้ครบกำหนดภายใน 7 วัน
* เกินกำหนด
* เสร็จเดือนนี้

Tabs:

* งานของฉัน
* งานทั้งหมด — Admin
* ตั้งค่างานประจำ — Admin

Occurrence list แสดงอย่างน้อย:

* หน่วยงาน
* หมวด
* รายการ
* ผู้รับผิดชอบ
* วันกำหนด
* เหลือเวลา/เกินกำหนด
* สถานะ
* action

User action:

* เริ่มงาน
* ปิดงาน
* ระบุ completion note
* ระบุเลขเอกสารอ้างอิง

Admin task form:

* หน่วยงาน
* หมวด
* ชื่องาน
* รายละเอียด
* ผู้รับผิดชอบหลายคน
* schedule type
* schedule config
* schedule text
* contract period
* extra details
* active state

UI ต้อง:

* รองรับ desktop และ mobile
* มี loading state
* empty state
* error state
* ไม่โหลดข้อมูลทั้งหมดโดยไม่มี pagination
* ไม่ duplicate business logic จาก server

---

## 11. Seed Data

เพิ่ม seed แบบ idempotent สำหรับ:

* RoutineUnit
* RoutineCategory

ยังไม่ต้อง import รายการจริงทั้งหมดจาก Excel ใน Phase นี้

สามารถเพิ่ม sample task เฉพาะ test fixture ได้ แต่ไม่ควรสร้าง production sample task ใน seed โดยไม่มี requirement

---

## 12. Tests

เพิ่ม unit และ API tests อย่างน้อย:

### Schedule

* monthly day
* month end
* February
* leap year
* interval months
* yearly date
* one-time
* month offset
* previous weekday
* next weekday

### Generation

* generate ครั้งเดียว
* generate ซ้ำไม่ duplicate
* inactive task ไม่ generate
* manual task ไม่ generate
* snapshot assignee
* contract end date

### Authorization

* User เห็นเฉพาะงานตนเอง
* User เปิด occurrence ของคนอื่นไม่ได้
* User ปิดงานของคนอื่นไม่ได้
* Admin เห็นทั้งหมด
* inactive employee ถูกปฏิเสธ

### Commands

* valid status transition
* invalid status transition
* complete ซ้ำ
* stale version ได้ 409
* due-date update ต้องมีเหตุผล
* skip/cancel/reopen ต้องมีเหตุผล
* AuditLog ถูกสร้างใน transaction

### UI

* menu ถูกซ่อนเมื่อ feature ปิด
* menu แสดงเมื่อเปิด
* admin tab ไม่แสดงแก่ User
* loading/error/empty state

---

## 13. Definition of Done

Phase 1 ถือว่าเสร็จเมื่อ:

1. Migration ถูกต้องและ deploy ได้
2. Prisma schema มี indexes/constraints ที่จำเป็น
3. Admin สร้าง recurring task ได้
4. occurrence ถูกสร้างโดยไม่ duplicate
5. User เห็นเฉพาะงานของตนเอง
6. User เริ่มและปิดงานได้
7. Admin จัดการ task และ occurrence ได้ตาม scope
8. มี AuditLog
9. Feature flag ทำงาน
10. lint ผ่าน
11. typecheck ผ่าน
12. tests ที่เกี่ยวข้องผ่าน
13. ไม่มีภาษาไทยเพี้ยน
14. ไม่มีการ implement notification หรือ Excel import เกิน Phase

---

## 14. รายงานผลหลัง Implement

เมื่อทำเสร็จ ให้หยุดและรายงาน:

1. สรุป architecture ที่เพิ่ม
2. รายชื่อไฟล์ที่แก้
3. รายชื่อ migration
4. API ที่เพิ่ม
5. test ที่เพิ่ม
6. คำสั่ง validation ที่รันและผลลัพธ์
7. assumptions
8. known limitations
9. จุดที่ควรให้ reviewer ตรวจเป็นพิเศษ
10. สิ่งที่ยังไม่ได้ทำและถูกเลื่อนไป Phase 2

**ห้ามเริ่ม Phase 2 จนกว่าจะได้รับคำสั่งใหม่**

---

# Prompt: Phase 2 — Reliable Reminder and Notification System

คุณกำลังทำงานใน repository `nhf_employee`

Phase 1 ของโมดูล **NHF Routine** ถูก implement แล้ว

ก่อนแก้ไข:

1. ตรวจ code และ migration ของ Phase 1 จริง
2. ตรวจว่า architecture ปัจจุบันตรงกับ requirement หรือมีการเปลี่ยนแปลง
3. ห้ามสมมติชื่อ model, service หรือ route จากเอกสารนี้ หาก code จริงใช้ชื่ออื่น
4. ให้ต่อยอด code ปัจจุบันโดยไม่ rewrite ส่วนที่ทำงานถูกต้อง

เป้าหมาย Phase 2:

> ระบบสร้าง occurrence ตามเวลา → ตรวจ reminder rule → enqueue notification แบบ idempotent → ส่ง in-app notification อย่างน่าเชื่อถือ → ไม่ส่งแจ้งเตือนเก่าหลังงานเสร็จหรือเลื่อนกำหนด

## กฎสำคัญ

* ใช้ Notification และ NotificationOutbox เดิมของ repository
* ห้ามเพิ่ม Redis, BullMQ, RabbitMQ หรือ queue ใหม่
* ห้ามสร้าง notification worker แยกซ้ำกับระบบเดิม
* ใช้ transactional outbox pattern ปัจจุบัน
* ห้าม implement Excel importer
* ห้าม implement LINE ส่วนบุคคล
* ห้ามเริ่ม Phase 3
* รักษา UTF-8 และภาษาไทย
* ตรวจ docs เมื่อไม่แน่ใจ
* รัน lint, typecheck และ tests แต่ไม่ต้องรัน dev server/build โดยไม่มีเหตุผล

---

## 1. ตรวจระบบ Notification เดิม

ตรวจอย่างน้อย:

* `Notification`
* `NotificationType`
* `NotificationOutbox`
* `NotificationOutboxType`
* outbox processor
* cron authentication
* retry/backoff
* stale processing recovery
* claim logic
* `eventKey`
* `dedupeKey`
* in-app notification creation
* notification action URL
* existing tests

ให้ reuse pattern เดิมและเพิ่ม Routine แบบไม่ทำให้ Ticket, Leave หรือ Stock regression

---

## 2. ReminderRule

เพิ่ม model สำหรับ reminder rule ของ RoutineTask

ข้อมูลขั้นต่ำ:

* id
* taskId
* daysBefore
* sendHour
* channel
* recipientScope
* isActive
* createdAt
* updatedAt

Channel สำหรับ Phase นี้:

* `IN_APP`

สามารถเตรียม enum `LINE_DIGEST` ได้ แต่ห้ามส่งจริงใน Phase นี้ เว้นแต่ codebase ต้องการ enum ล่วงหน้าและไม่เพิ่ม complexity

Recipient scope:

* `ASSIGNEES`
* `ADMINS`
* `ASSIGNEES_AND_ADMINS`

Unique constraint ป้องกัน rule ซ้ำ เช่น:

* taskId
* daysBefore
* channel
* recipientScope

Validation:

* `daysBefore >= 0`
* กำหนด upper bound ที่สมเหตุสมผล เช่นไม่เกิน 365
* `sendHour` อยู่ระหว่าง 0–23
* อย่างน้อยหนึ่ง rule ต่อ taskเป็น optional ไม่ใช่บังคับ

---

## 3. Reminder Versioning

เพิ่ม `reminderVersion` ใน RoutineOccurrence หาก Phase 1 ยังไม่มี

เมื่อเกิดเหตุการณ์ต่อไปนี้ต้อง increment:

* due date เปลี่ยน
* assignee เปลี่ยน
* task reminder rules เปลี่ยน
* occurrence reopen แล้วต้องเตือนใหม่
* schedule regeneration ที่เปลี่ยนกำหนด

Outbox notification ต้องเก็บ version ใน payload และ eventKey

ตัวอย่าง event key:

```text
routine:{occurrenceId}:rule:{ruleId}:version:{reminderVersion}
```

In-app dedupe key:

```text
routine:{occurrenceId}:rule:{ruleId}:user:{userId}:version:{reminderVersion}
```

---

## 4. Routine Scheduler

สร้าง cron endpoint:

```text
POST /api/cron/routine-scheduler
Header: x-routine-secret
```

Environment:

```dotenv
ROUTINE_SCHEDULER_CRON_SECRET=...
```

ให้ใช้ authentication pattern เดียวกับ cron อื่นใน repository

Scheduler ทำงาน:

1. generate occurrences ตาม generation horizon
2. ค้นหา reminder rules ที่ถึงเวลาส่ง
3. enqueue NotificationOutbox
4. ไม่ส่ง external side effect โดยตรง
5. ทำงานซ้ำได้โดยไม่สร้าง outbox ซ้ำ

กำหนด timezone:

```text
Asia/Bangkok
```

Scheduler สามารถถูกเรียกทุกชั่วโมง แต่ต้อง enqueue เฉพาะ reminder ที่:

* local date ตรงกับ `dueDate - daysBefore`
* local hour ถึงหรือเกิน `sendHour`
* ยังไม่มี eventKey นี้
* occurrence ยัง actionable
* task และ reminder rule ยัง active
* ผู้รับผิดชอบยัง valid

Occurrence actionable:

* `TODO`
* `IN_PROGRESS`

ไม่ actionable:

* `COMPLETED`
* `SKIPPED`
* `CANCELLED`

---

## 5. Outbox Type และ Payload

เพิ่ม NotificationOutbox type สำหรับ Routine ตาม naming convention ของ repository

ตัวอย่าง:

* `ROUTINE_REMINDER_IN_APP`

Payload ต้อง validate ก่อน dispatch และมีอย่างน้อย:

* occurrenceId
* taskId
* ruleId
* reminderVersion
* dueDate
* expectedStatus
* createdAt

อย่าเชื่อ title, assignee หรือ action URL จาก payload โดยตรงหากอ่านข้อมูล current state จาก database ได้

Payload ควรเก็บ identity และ expected version มากกว่าสำเนาข้อมูลจำนวนมาก

---

## 6. Dispatch-time Revalidation

ก่อนสร้าง in-app notification ต้องอ่าน current state จาก database ใหม่

ถ้าเงื่อนไขใดไม่ตรง ให้ mark outbox เป็น `SUPERSEDED`:

* occurrence ไม่มีแล้ว
* task inactive
* occurrence terminal
* reminder rule inactive
* reminder version ไม่ตรง
* due date ไม่ตรงกับที่ enqueue
* reminder ไม่ควรถูกส่งตามวันปัจจุบัน
* ไม่มี active assignee
* assignee ไม่มี User ที่ active

ห้ามส่ง reminder จากข้อมูล stale ใน payload

---

## 7. Recipient Resolution

Routine assignee ผูกกับ Employee แต่ Notification ผูกกับ User

ต้อง resolve:

```text
RoutineOccurrenceAssignee
→ Employee
→ User
```

ส่งเฉพาะ User ที่:

* `User.isActive = true`
* `User.deletedAt = null`
* Employee active
* Employee ไม่ถูก soft delete

ถ้า Employee ไม่มี User:

* ไม่ให้ worker fail ทั้ง batch
* skip ผู้รับรายนั้น
* บันทึก diagnostic ที่เหมาะสม
* หากไม่มีผู้รับเลย สามารถ mark `SUPERSEDED` หรือผลลัพธ์ที่สอดคล้องกับ outbox architecture เดิม
* ไม่ควร retry ตลอดไปในกรณีไม่มี User อย่างถาวร

Recipient scope `ADMINS` ให้ reuse admin recipient resolver เดิม หากมี

---

## 8. In-App Notification

เพิ่ม NotificationType สำหรับ Routine

ตัวอย่าง:

* `ROUTINE_REMINDER`
* `ROUTINE_OVERDUE`

ใน Phase นี้อย่างน้อยต้องมี reminder ก่อนถึงกำหนด

ข้อความตัวอย่าง:

```text
งานใกล้ถึงกำหนด

“ต่ออายุ Domain name” จะครบกำหนดวันที่ 21 กรกฎาคม 2569
เหลือเวลา 7 วัน
```

Action URL เปิด Routine occurrence ที่เกี่ยวข้องผ่าน dashboard tab

ห้ามใส่ข้อมูล sensitive เกินจำเป็นใน notification

---

## 9. Overdue Behaviour

ไม่ต้องสร้าง persisted overdue status

เลือกหนึ่งแนวทางที่เรียบง่ายและอธิบายไว้:

### ทางเลือกแนะนำ

ใช้ reminder rule `daysBefore = 0` สำหรับวันครบกำหนด และสร้าง overdue summary ใน UI จาก query

ยังไม่ต้องส่ง overdue reminder ทุกวัน เพราะจะสร้าง notification noise

หากต้องการ overdue reminder ให้รองรับเพียงครั้งเดียว เช่นวันถัดจาก due date และทำเป็น explicit rule ไม่ใช่ loop ส่งทุกวัน

---

## 10. Admin UI

เพิ่มการตั้ง reminder rules ใน RoutineTask form

อย่างน้อย:

* เพิ่ม rule
* ลบ rule
* days before
* send hour
* recipient scope
* active state

มี presets:

* งานรายเดือน: 3 วัน และ 1 วัน
* งานรายปี: 14, 7 และ 1 วัน
* งานต่อสัญญา: 30, 7 และ 1 วัน

Preset เป็น UI helper เท่านั้น ห้ามบังคับ business rule

---

## 11. Scheduler Observability

Cron response ควรแสดง counters ที่ไม่เปิดเผยข้อมูล sensitive:

* occurrencesCreated
* remindersConsidered
* outboxEnqueued
* duplicatesSkipped
* inactiveSkipped
* noRecipientSkipped
* errors

ห้าม return task title, employee email หรือ payload เต็มใน production response

Error logging ต้องมี context ที่พอ debug ได้ แต่ไม่ log secret

---

## 12. Tests

### Scheduler

* สร้าง occurrence ตาม horizon
* cron เรียกซ้ำไม่ duplicate
* eventKey ป้องกัน outbox ซ้ำ
* timezone Asia/Bangkok
* sendHour
* daysBefore
* inactive rule
* inactive task
* terminal occurrence
* no recipient
* multiple assignees

### Reminder invalidation

* complete ก่อน dispatch → superseded
* skip ก่อน dispatch → superseded
* cancel ก่อน dispatch → superseded
* due date เปลี่ยน → old reminder superseded
* assignee เปลี่ยน → old version superseded
* reminder rule เปลี่ยน → old version superseded
* reopen → version ใหม่สามารถแจ้งเตือนได้

### Outbox

* payload validation
* retry เมื่อเกิด transient failure
* permanent invalid state ไม่ retry ตลอดไป
* existing Ticket/Leave/Stock outbox tests ยังผ่าน
* unknown type handling ไม่ regression

### Authorization

* cron secret ไม่มี → 503 ตาม pattern เดิม
* secret ผิด → 403
* secret ถูก → ทำงาน

---

## 13. Definition of Done

Phase 2 เสร็จเมื่อ:

1. Admin ตั้ง reminder rules ได้
2. scheduler สร้าง occurrence ได้ตามเวลา
3. scheduler enqueue outbox แบบ idempotent
4. existing outbox worker dispatch Routine ได้
5. User ได้รับ in-app notification
6. stale notification ถูก supersede
7. ไม่มี notification หลังงาน completed
8. ไม่มี duplicate เมื่อ cron ถูกเรียกซ้ำ
9. retry/backoff เดิมยังทำงาน
10. existing notification modules ไม่ regression
11. lint ผ่าน
12. typecheck ผ่าน
13. tests ผ่าน
14. ไม่มี Excel importer หรือ LINE digest เกิน Phase

---

## 14. รายงานผล

เมื่อเสร็จ ให้หยุดและรายงาน:

1. schema/migration ที่เพิ่ม
2. scheduler flow
3. outbox type และ payload
4. dedupe strategy
5. stale notification protection
6. recipient resolution
7. test ที่เพิ่ม
8. validation commands และผล
9. known limitations
10. สิ่งที่เลื่อนไป Phase 3

**ห้ามเริ่ม Phase 3 จนกว่าจะได้รับคำสั่งใหม่**

---

# Prompt: Phase 3 — Excel Migration and Data Reconciliation

คุณกำลังทำงานใน repository `nhf_employee`

Phase 1 และ Phase 2 ของโมดูล **NHF Routine** ถูก implement แล้ว

Phase นี้ต้องนำข้อมูลจากไฟล์:

`NHF Routine list_cost_update270625.xls`

เข้าสู่ระบบอย่างปลอดภัย

เป้าหมาย:

> อ่านไฟล์จริง → normalize ข้อมูล → แสดง preview และปัญหา → ให้ Admin ตรวจ mapping → apply แบบ idempotent → ไม่สร้างงานผิดหรือ overdue จำนวนมากโดยไม่ตั้งใจ

## กฎสำคัญ

1. อ่าน workbook จริง ห้ามอาศัยชื่อคอลัมน์จากสมมติฐาน
2. ตรวจทุก sheet, merged cells, blank cells และรูปแบบวันที่จริง
3. ห้าม fuzzy match ชื่อพนักงานแล้ว apply อัตโนมัติ
4. ห้าม auto-activate ข้อมูลเก่าทุกแถว
5. ห้ามตีความ schedule ภาษาไทยที่คลุมเครือด้วยการเดา
6. เก็บข้อความต้นฉบับไว้เสมอ
7. importer ต้อง idempotent
8. รองรับ dry-run/preview ก่อน apply
9. ห้ามเพิ่ม notification feature ใหม่ใน Phase นี้
10. ห้ามเริ่ม Phase 4
11. รักษา UTF-8 และภาษาไทย
12. รัน lint, typecheck และ tests ที่เกี่ยวข้อง

---

## 1. Workbook Inspection

ตรวจ workbook จริงและจัดทำ internal mapping ของ:

* sheet names
* header rows
* merged regions
* category rows
* owner columns
* task title
* due/schedule text
* contract text
* detail/remark columns
* blank rows
* repeated headers
* Buddhist year dates
* formula cells
* numeric date serials
* string dates

ต้องไม่เปลี่ยน workbook ต้นฉบับ

---

## 2. Import Architecture

สร้าง one-time migration pipeline แยกเป็น:

```text
Extract
→ Normalize
→ Validate
→ Preview
→ Resolve
→ Apply
```

ไม่ควรสร้าง generic user-facing Excel importer ที่รับไฟล์อะไรก็ได้

สร้าง normalized manifest type เช่น:

```ts
type RoutineImportRow = {
  sourceSheet: string;
  sourceRow: number;
  unitCode: string;
  unitName: string;
  categoryName: string;
  title: string;
  ownerNames: string[];
  scheduleText: string | null;
  contractText: string | null;
  extraDetails: string | null;
  normalizedSchedule: NormalizedSchedule | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  requiresReview: boolean;
  reviewReasons: string[];
  proposedActivation: "ACTIVE" | "INACTIVE" | "HISTORY_ONLY";
};
```

---

## 3. Source Identity และ Idempotency

ใช้ source identity อย่างน้อย:

* source file name
* source sheet
* source row

RoutineTask มี source fields อยู่แล้ว หรือเพิ่มหาก Phase 1 ยังไม่มี

ต้องป้องกัน:

* apply ซ้ำแล้วสร้าง task ซ้ำ
* row เดิมถูก insert หลายครั้ง
* import run ล้มครึ่งทางแล้ว rerun ไม่ปลอดภัย

สามารถใช้ unique constraint หรือ import ledger ตาม architecture ที่เหมาะสม

ถ้า source row ถูกแก้ใน manifest:

* ต้องตรวจ conflict
* ห้าม overwrite task ที่ผู้ใช้แก้เองโดยเงียบ
* รายงานว่า source diverged

---

## 4. Employee Mapping

ชื่อใน Excel อาจเป็น:

* ชื่อเล่น
* ชื่อสั้น
* หลายคนในช่องเดียว
* merged cell
* blank เพราะสืบทอดจากแถวก่อน
* สะกดต่างจาก Employee master

สร้าง explicit mapping file หรือ mapping UI/data structure เช่น:

```ts
const OWNER_MAPPING = {
  "ณภัทร": 12,
  "ยิ่งยศ": 18,
};
```

ข้อกำหนด:

* map ด้วย Employee ID
* ตรวจ Employee มีอยู่จริง
* ตรวจสถานะ
* unresolved owner ทำให้ row `requiresReview`
* ห้าม apply active task หากไม่มีผู้รับผิดชอบ
* ห้ามใช้ fuzzy matching เพื่อ apply
* สามารถเสนอ candidate ใน preview ได้ แต่ Admin ต้องเลือกชัดเจน

---

## 5. Schedule Normalization

รองรับเฉพาะ pattern ที่มั่นใจ

ตัวอย่างที่ normalize ได้:

* วันที่ 10 ของเดือน
* วันที่ 15 ของเดือนถัดไป
* สิ้นเดือน
* ทุก 3 เดือน
* ทุก 6 เดือน
* ภายในวันที่ 31 มีนาคมของทุกปี
* วันที่แน่นอน
* ช่วงสัญญาที่ parse ได้ชัดเจน

ตัวอย่างที่ต้อง `requiresReview`:

* วันที่ 16 หรือ 23
* เมื่อได้รับเอกสารครบ
* ตามความเหมาะสม
* โดยประมาณ
* ก่อนวันประชุม
* ข้อความขัดแย้งกัน
* วันที่ไม่ครบ
* งานที่ขึ้นกับ event แต่ Phase 1 ยังไม่รองรับ

กรณีไม่แน่ใจ:

* `normalizedSchedule = null`
* proposed schedule type = `MANUAL`
* เก็บ `scheduleText`
* เพิ่ม review reason
* ห้ามเดา

---

## 6. Buddhist Era Conversion

วันที่ในไฟล์อาจเป็น พ.ศ.

กฎ:

* แปลง พ.ศ. เป็น ค.ศ. อย่าง explicit
* ห้ามลบ 543 โดยไม่ตรวจ format
* ตรวจกรณี workbook มี ค.ศ. ปน พ.ศ.
* เก็บฐานข้อมูลเป็น date
* แสดงผล UI ด้วย Thai locale ตาม pattern ระบบ
* test boundary เช่น:

  * 2568 → 2025
  * 2569 → 2026
  * leap year หลัง conversion

---

## 7. Historical and Expired Data

ณ เวลาที่ import ข้อมูลบางรายการอาจ:

* หมดสัญญาแล้ว
* เป็นรายการจากหลายปีก่อน
* ไม่มีผู้รับผิดชอบปัจจุบัน
* มี schedule ที่ไม่ใช้แล้ว
* เป็น history มากกว่า active routine

กำหนด policy:

### ACTIVE

ใช้เฉพาะ row ที่:

* schedule ชัดเจน
* owner resolve แล้ว
* ยังมีผลทางธุรกิจ
* contract ไม่หมด
* Admin ยืนยัน

### INACTIVE

สร้าง RoutineTask แต่:

* `isActive = false`
* ไม่ generate occurrence
* ใช้เป็นข้อมูลอ้างอิง

### HISTORY_ONLY

ไม่สร้าง recurring task active

สามารถเก็บใน import report หรือสร้าง inactive task ตามการตัดสินใจที่อธิบายชัดเจน

ห้ามทำให้ระบบสร้าง overdue จำนวนมากจากข้อมูลเก่าโดยอัตโนมัติ

---

## 8. Preview Report

ก่อน apply ต้องมี report อย่างน้อย:

* total rows
* valid rows
* requires review
* unresolved owners
* ambiguous schedules
* expired contracts
* missing category
* missing unit
* duplicate source rows
* rows proposed active
* rows proposed inactive
* rows history only

แต่ละ row แสดง:

* source sheet/row
* title
* owner names
* mapped employees
* original schedule text
* normalized schedule
* contract dates
* proposed activation
* review reasons

Preview ต้องสร้างได้โดยไม่เขียนฐานข้อมูล

---

## 9. Apply

Apply ต้อง:

* รับเฉพาะ manifest ที่ผ่าน validation
* ใช้ transaction เป็น batch ที่สมเหตุสมผล
* idempotent
* create/reuse RoutineUnit
* create/reuse RoutineCategory
* create RoutineTask
* create assignees
* create reminder presets เฉพาะหาก policy กำหนดชัดเจน
* generate occurrence เฉพาะ active task
* ไม่ generate ย้อนหลัง
* เขียน AuditLog หรือ ImportLog
* สรุป inserted/skipped/conflict/failed

ถ้าพบ row conflict:

* ห้าม overwrite
* mark conflict
* continue หรือ rollback ตาม batch strategy ที่ออกแบบ
* รายงานชัดเจน

---

## 10. Execution Interface

เลือกแนวทางที่เหมาะกับ codebase:

### ทางเลือกแนะนำ

สร้าง script:

```text
scripts/routine-import.ts
```

คำสั่ง:

```text
--preview
--apply
--manifest=<path>
```

Default ต้องเป็น preview/dry-run

`--apply` ต้อง explicit

ห้ามให้การเรียก script โดยไม่มี flag เขียนข้อมูล

ถ้าทำ Admin UI จะเพิ่ม scope มากเกินไป ให้ใช้ script + generated report ใน Phase นี้

---

## 11. Tests

เพิ่ม tests อย่างน้อย:

### Workbook parsing

* merged owner cells
* blank owner inheritance
* multiple owners
* repeated headers
* blank rows
* date serial
* date string
* Thai text encoding

### Normalization

* monthly date
* next-month date
* month end
* interval month
* yearly date
* one-time
* ambiguous schedule
* manual schedule
* Buddhist year
* mixed calendar years

### Mapping

* exact owner mapping
* unresolved owner
* inactive employee
* duplicate owner
* multiple assignees

### Apply

* preview ไม่เขียน DB
* apply idempotent
* rerun ไม่ duplicate
* conflict ไม่ overwrite
* inactive task ไม่ generate
* active task generate เฉพาะ future/current
* old row ไม่สร้าง overdue flood
* partial failure report ถูกต้อง

---

## 12. Definition of Done

Phase 3 เสร็จเมื่อ:

1. workbook ถูก parse จากข้อมูลจริง
2. มี normalized manifest
3. มี preview report
4. unresolved row ถูกแยกชัดเจน
5. ไม่มี fuzzy auto-apply
6. พ.ศ. แปลงถูกต้อง
7. import idempotent
8. apply ซ้ำไม่ duplicate
9. old data ไม่สร้าง overdue flood
10. active task ถูกสร้างเฉพาะ row ที่ผ่าน review
11. lint ผ่าน
12. typecheck ผ่าน
13. tests ผ่าน
14. ไม่มี notification feature ใหม่เกิน scope

---

## 13. รายงานผล

เมื่อเสร็จ ให้หยุดและรายงาน:

1. workbook structure ที่พบจริง
2. จำนวน row ต่อ sheet
3. mapping ที่ resolve ได้
4. unresolved owners
5. ambiguous schedules
6. expired/historical rows
7. preview totals
8. apply totals หากได้ apply
9. files/scripts ที่เพิ่ม
10. commands ที่ใช้
11. tests และผลลัพธ์
12. known limitations
13. รายการที่ Admin ต้องตัดสินใจก่อน activate

**ห้ามเริ่ม Phase 4 จนกว่าจะได้รับคำสั่งใหม่**

---

# Prompt: Phase 4 — Operational Hardening and Production Readiness

คุณกำลังทำงานใน repository `nhf_employee`

โมดูล **NHF Routine** ผ่าน Phase 1–3 แล้ว

Phase นี้เป็นการ harden สำหรับการใช้งานจริงระดับ Production-Ready MVP โดยไม่ขยายเป็น enterprise workflow platform

เป้าหมาย:

> ทำให้ระบบ Routine ตรวจสอบง่าย ดูแลได้ แจ้งเตือนได้เหมาะสม รองรับวันหยุด และไม่เกิด silent failure ในการปฏิบัติงานจริง

## กฎสำคัญ

* ตรวจ implementation จริงของ Phase 1–3 ก่อน
* แก้เฉพาะจุดที่มีหลักฐานว่าจำเป็น
* ห้าม rewrite architecture โดยไม่มีเหตุผล
* ห้ามเพิ่ม generic workflow engine
* ห้ามเพิ่ม microservice
* ห้ามเพิ่ม Redis/message broker
* รักษา UTF-8 และภาษาไทย
* ใช้ official docs/Context7 เมื่อไม่แน่ใจ
* รัน lint, typecheck, tests
* ไม่ต้องรัน dev server/build โดยไม่มีเหตุผล

---

## 1. Holiday Calendar

เพิ่มการรองรับวันหยุดองค์กร/วันหยุดราชการ

Model ขั้นต่ำ:

* id
* date unique
* name
* isActive
* createdAt
* updatedAt

Business-day calculation:

1. ตรวจเสาร์–อาทิตย์
2. ตรวจ holiday table
3. เลื่อนตาม:

   * `PREVIOUS_BUSINESS_DAY`
   * `NEXT_BUSINESS_DAY`
4. ป้องกัน loop ผิดพลาด
5. รองรับวันหยุดต่อเนื่องหลายวัน
6. ใช้ timezone Asia/Bangkok

Admin UI:

* ดูวันหยุด
* เพิ่ม
* แก้ชื่อ
* ปิดใช้งาน
* ลบตาม policy ที่ปลอดภัย

เมื่อ holiday เปลี่ยน:

* ตรวจ occurrence ในอนาคตที่ยังไม่ terminal
* recalculation ต้อง explicit
* ห้าม silently เปลี่ยน due date ของงานที่ใกล้ครบกำหนดโดยไม่มี audit
* ถ้าปรับ due date ให้ increment reminderVersion
* invalidate reminder เก่า
* เขียน AuditLog

---

## 2. Admin Operational Dashboard

เพิ่ม dashboard สำหรับ Admin:

* งานไม่มีผู้รับผิดชอบ active
* ผู้รับผิดชอบไม่มี User account
* งานเลยกำหนด
* task ไม่มี reminder rule
* contract ใกล้หมดอายุ
* scheduler ไม่เคยทำงานหรือหยุดทำงาน
* outbox Routine ที่ FAILED
* outbox Routine ที่ DEAD
* import row ที่ยัง unresolved

ต้องแยก:

* warning
* action required
* informational

ห้ามโหลด query ขนาดใหญ่โดยไม่มี pagination/index

---

## 3. Scheduler Health

เพิ่ม observability ที่เหมาะสม:

* last successful run
* last failed run
* last run duration
* occurrences created
* reminders enqueued
* errors
* scheduler version

เลือก implementation ที่เรียบง่าย เช่น health table หรือ system job state

ต้องตรวจ silent failure:

* cron ไม่ถูกเรียก
* secret ผิด
* DB failure
* scheduler ค้าง
* outbox backlog
* dead-letter increase

ห้ามเปิดข้อมูล internal ต่อ User ทั่วไป

---

## 4. LINE Digest

เพิ่ม LINE digest แบบ optional สำหรับ Routine

ไม่ส่ง LINE ส่วนบุคคล

ส่งไปยัง configured group/user ID สำหรับทีมที่เกี่ยวข้อง

Environment ตัวอย่าง:

```dotenv
LINE_ROUTINE_CHANNEL_ACCESS_TOKEN=
LINE_ROUTINE_TARGET_ID=
ROUTINE_LINE_DIGEST_ENABLED=false
```

หรือ reuse LINE service architecture เดิม หากมี channel ที่เหมาะสม

Digest ควรส่ง:

* วันละครั้ง
* สรุปงานวันนี้
* งานใกล้ครบกำหนด
* งานเลยกำหนด
* จำนวนงานไม่มีผู้รับผิดชอบ

ไม่ควรส่ง task ทุกชิ้นเป็นข้อความแยกจนเกิด spam

ต้องมี:

* feature/config flag
* dedupe ต่อวัน
* retry ผ่าน outbox
* payload validation
* current-state revalidation
* graceful skip เมื่อ config ไม่ครบ

ห้ามทำให้ in-app notification fail เพราะ LINE config ไม่มี

---

## 5. Export

เพิ่ม export Excel สำหรับ Admin

อย่างน้อย:

### Occurrence report

* unit
* category
* task
* assignees
* due date
* status
* startedAt
* completedAt
* completedBy
* referenceNo
* completionNote

### Routine task master

* schedule
* schedule text
* contract
* reminder rules
* active state
* source sheet/row

ข้อกำหนด:

* ใช้ Excel library เดิมของ repository
* stream หรือจำกัด dataset อย่างเหมาะสม
* ป้องกัน formula injection
* ชื่อไฟล์ภาษาไทย/อังกฤษที่ปลอดภัย
* authorization Admin
* AuditLog `DATA_EXPORT` หรือ action เฉพาะที่เหมาะสม

---

## 6. Retention and Cleanup

กำหนด policy ชัดเจน:

* occurrence history ต้องไม่ถูกลบโดยอัตโนมัติใน MVP
* notifications ใช้ retention policy เดิม
* import reports เก็บเท่าที่จำเป็น
* scheduler run logs มี cleanup
* audit logs ใช้ policy ระบบเดิม

ห้ามสร้าง cleanup ที่ลบ business history สำคัญ

---

## 7. Data Integrity Audit Script

สร้าง script ตรวจความสอดคล้อง เช่น:

```text
scripts/routine-audit.ts
```

ตรวจอย่างน้อย:

* active task ไม่มี assignee
* occurrence ไม่มี assignee snapshot
* duplicate logical period
* terminal status แต่ไม่มี timestamp
* completed status ไม่มี completedBy
* non-completed มี completedAt
* dueDate ผิดจาก scheduleVersion โดยไม่มี override
* reminderVersion ผิดปกติ
* pending reminder ของ terminal occurrence
* occurrence ของ inactive task ในอนาคต
* assignee employee ไม่มีอยู่
* source identity ซ้ำ

รองรับ:

```text
--strict
```

Default เป็น report-only ห้ามแก้ DB

ถ้ามี repair mode ต้องแยกชัดเจนและไม่เปิดเป็น default

---

## 8. Performance Review

ตรวจ query/index จริงจาก code

เพิ่ม index เฉพาะที่มี query รองรับ เช่น:

* occurrence status + dueDate
* occurrence assignee + status + dueDate
* task active + unit/category
* reminder rule active
* outbox type + status + nextAttemptAt
* holiday date

ห้ามเพิ่ม index จำนวนมากโดยไม่มี query justification

ตรวจ:

* N+1 query
* large include
* unbounded list
* dashboard count query
* export memory
* cron batch size
* outbox batch behaviour

---

## 9. Security Review

ตรวจอย่างน้อย:

* IDOR ใน occurrence detail
* User filter bypass
* Admin command authorization
* cron secret comparison
* sensitive logging
* Zod validation
* mass assignment
* arbitrary status transition
* stale version overwrite
* export authorization
* formula injection
* notification URL
* unsafe JSON parsing
* inactive/soft-deleted employee
* audit integrity

แก้เฉพาะ finding ที่พิสูจน์จาก code ได้

---

## 10. UX Hardening

เพิ่มหรือปรับ:

* clear status labels
* overdue emphasis
* due-date explanation
* confirmation สำหรับ cancel/skip/reopen
* reason required
* disabled state ระหว่าง mutation
* duplicate-submit prevention
* optimistic update เฉพาะจุดที่ปลอดภัย
* accessible dialog/labels
* mobile table/card fallback
* error messages ภาษาไทยที่เข้าใจได้
* empty state พร้อม action ที่เหมาะสม
* warning เมื่อ task ไม่มี assignee/reminder

ห้าม redesign ระบบทั้งหมด

---

## 11. Documentation

อัปเดต README หรือ module documentation:

* ภาพรวม NHF Routine
* schedule types
* status flow
* permissions
* scheduler setup
* cron command
* required environment variables
* notification behaviour
* holiday policy
* import command
* audit command
* export
* deployment checklist
* rollback considerations
* known limitations

ระบุชัดเจนว่า:

* timezone คือ Asia/Bangkok
* business-day policy ใช้ holiday table
* User ไม่มีบัญชีจะไม่ได้รับ in-app notification
* LINE digest เป็น optional
* Routine history ไม่ถูกลบอัตโนมัติ

---

## 12. Tests

เพิ่มหรือปรับ tests:

### Holiday

* weekend
* holiday
* consecutive holidays
* previous business day
* next business day
* year boundary

### Scheduler health

* successful run
* failed run
* stale scheduler warning
* counters
* authorization

### LINE digest

* disabled
* missing config
* dedupe per date
* retry
* payload validation
* stale state
* no actionable tasks

### Export

* admin only
* expected columns
* Thai text
* formula injection
* large dataset boundary

### Audit script

* each integrity issue
* clean database
* strict exit code
* report-only does not mutate

### Regression

* Routine flow Phase 1
* notification flow Phase 2
* import flow Phase 3
* Ticket/Leave/Stock notification
* dashboard navigation
* feature flag

---

## 13. Production Checklist

จัดทำ checklist หลัง implement:

* migration backup
* `prisma migrate deploy`
* environment variables
* scheduler cron configured
* outbox cron configured
* feature flag
* LINE digest disabled/enabled
* holiday seed
* routine audit
* smoke test
* rollback plan
* monitoring
* backup coverage

---

## 14. Definition of Done

Phase 4 เสร็จเมื่อ:

1. holiday calendar ทำงาน
2. business-day policy ถูกต้อง
3. admin เห็น operational warnings
4. scheduler health ตรวจสอบได้
5. LINE digest optional และไม่กระทบ in-app
6. export ใช้งานได้
7. audit script ตรวจ integrity ได้
8. performance/index ผ่าน review
9. security findings สำคัญถูกแก้
10. documentation ครบ
11. lint ผ่าน
12. typecheck ผ่าน
13. tests ผ่าน
14. ไม่มี silent failure สำคัญที่ทราบแล้วแต่ไม่รายงาน

---

## 15. รายงานผล Final

เมื่อทำเสร็จ ให้รายงาน:

1. ภาพรวม module architecture สุดท้าย
2. schema และ migrations ทั้งหมด
3. cron และ notification flows
4. import result
5. holiday behaviour
6. LINE digest behaviour
7. operational dashboard
8. audit script
9. performance improvements
10. security hardening
11. tests และผลลัพธ์
12. deployment steps
13. rollback plan
14. known limitations
15. technical debt ที่ยังเหลือ

ห้าม claim ว่า production-ready หาก validation หรือ test สำคัญยังไม่ผ่าน ให้รายงานข้อจำกัดตามจริง
