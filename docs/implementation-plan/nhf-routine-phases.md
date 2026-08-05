# NHF Routine — Reminder-Based Routine List

เอกสารนี้เป็น implementation guide ของ NHF Routine บน branch `featureroutine` หลัง refactor ให้เป็นรายการกำหนดการและการแจ้งเตือน ไม่ใช่ระบบ Task/Workflow

## ขอบเขตของงานนี้

ผู้ใช้บันทึกรายการ Routine, ผู้รับผิดชอบ, schedule, วันกำหนด และกฎแจ้งเตือน ระบบสร้าง occurrence ตามรอบและคำนวณสถานะจากวันปัจจุบัน ผู้ใช้ทั่วไปอ่านรายการได้อย่างเดียว

Admin แก้ occurrence ได้เฉพาะวันกำหนดและผู้รับผิดชอบ ส่วนการแก้ schedule, contract date, reminder และ active state ทำที่ RoutineTask settings

Phase 4 และความสามารถ operational hardening อื่น ๆ ยังไม่เริ่มในงานนี้

## Domain model

### RoutineTask

เป็นแม่แบบ/รายการหลักที่เก็บหน่วยงาน, หมวด, ชื่อรายการ, รายละเอียด, ผู้รับผิดชอบ, schedule, วันสัญญา, reminder rules และ `isActive`

### RoutineOccurrence

เป็น snapshot ของรอบวันที่คำนวณจาก RoutineTask ประกอบด้วย:

- `id`, `taskId`, `periodKey`
- `dueDate`, `originalDueDate`, `isDueDateOverridden`
- `scheduleVersion`, `reminderVersion`
- `createdAt`, `updatedAt`
- relation ไปยัง `task` และ snapshot `assignees`

ไม่มี workflow lifecycle หรือ completion history ใน occurrence

### Timing status

สถานะสำหรับ response/UI เป็น derived value จาก calendar date ใน timezone `Asia/Bangkok` เท่านั้น:

| สถานะ | เงื่อนไข | label |
| --- | --- | --- |
| `OVERDUE` | ก่อนวันนี้ | เกินกำหนด |
| `DUE_TODAY` | วันนี้ | ถึงกำหนดวันนี้ |
| `DUE_SOON` | พรุ่งนี้ถึงอีก 7 วัน | ใกล้ถึงกำหนด |
| `UPCOMING` | เกิน 7 วัน | ยังไม่ถึงกำหนด |

Server serialize `timingStatus`, `daysUntilDue` และ `isOverdue` จาก pure function เดียวกัน Client ไม่คำนวณซ้ำ

## Generation

การสร้าง occurrence ใช้ unique key `[taskId, periodKey]` และ snapshot assignees ตอนสร้าง

เมื่อ task version เปลี่ยน ระบบ refresh occurrence ที่ยัง valid ทุกอันใน reconciliation window แต่สร้าง occurrence ใหม่เฉพาะ generation window:

- ถ้า occurrence ยังไม่ถูก override วันกำหนด จะปรับตาม schedule ใหม่
- ถ้า Admin override วันกำหนดแล้ว จะรักษา `dueDate` override และปรับ `originalDueDate` ตาม schedule ใหม่
- วันที่ที่มีผลต่อ reminder เปลี่ยนจะเพิ่ม `reminderVersion`
- Import ใช้ `excludePastDue: true` เพื่อไม่สร้าง occurrence ย้อนหลัง

## Authorization และ API

User ทั่วไปเห็นเฉพาะ occurrence ที่ snapshot assignee ของตนเอง ส่วน Admin เห็นรายการทั้งหมดได้

API ที่คงไว้:

- `GET /api/routines/summary`
- `GET /api/routines/occurrences`
- `GET /api/routines/occurrences/[id]`
- `PATCH /api/routines/occurrences/[id]/due-date`
- `PATCH /api/routines/occurrences/[id]/assignees`
- RoutineTask CRUD และ Routine Import API เดิมที่ใช้โดยหน้า Admin

Occurrence list รับ `timingStatus` และสร้าง Prisma date range ที่ server: overdue, วันนี้, 7 วัน และหลังจากนั้น ไม่โหลดข้อมูลทั้งหมดมา filter ใน memory

การแก้วันกำหนดรับ `{ dueDate, note? }` โดยไม่บังคับเหตุผลขั้นต่ำ เก็บ old/new/original date, actor และ note ใน audit log และเพิ่ม reminder version

การเปลี่ยนผู้รับผิดชอบตรวจ Employee ที่ active, แทนที่ snapshot, เพิ่ม reminder version และเก็บ audit log

## Reminder

Scheduler พิจารณาเฉพาะ task active, rule active, channel ที่รองรับ, occurrence ที่ due date ยังไม่ผ่าน และ recipient ที่ resolve ได้ Payload มี occurrence/task/rule identity, reminder version, due date และ created time

ก่อน dispatch ระบบตรวจซ้ำว่า occurrence, task, rule, channel, due date, reminder version, วัน/เวลาตาม rule และ recipient ยัง valid การเปลี่ยนวันกำหนด, assignee, reminder rule หรือ active state ทำให้ reminder เก่าถูก supersede ได้

event key และ recipient dedupe key ยังคงอยู่ใน Notification Outbox architecture เดิม

## KPI และ UI

Dashboard แสดง KPI ที่ไม่ผูกกับ completion:

1. ถึงกำหนดวันนี้
2. ใกล้ถึงกำหนดภายใน 7 วัน (พรุ่งนี้ถึงอีก 7 วัน)
3. เกินกำหนด
4. กำหนดภายใน 30 วัน (วันนี้ถึงอีก 30 วัน)

Occurrence list เป็น read-only สำหรับ User และไม่มีปุ่ม lifecycle ใด ๆ Admin เห็น affordance เดียวคือ `แก้ไขรายการ` ซึ่งเปิดการแก้วันกำหนดและผู้รับผิดชอบ

## Import ผ่าน UI

Import อ่านเฉพาะชีต `มสช.` และใช้ staging batch เพื่อ preview, map owner และ apply แบบ idempotent

แถวที่ผ่าน owner mapping จะสร้าง active RoutineTask โดย default ไม่มีตัวเลือก active/inactive ใน primary flow `proposedActivation` ที่ยังอยู่ใน staging schema มีค่า `ACTIVE` เท่านั้นเพื่อรองรับ migration compatibility

เงื่อนไขที่ block ได้แก่ ชื่อรายการ/หมวด/หน่วยงาน/owner ที่ขาดหรือใช้ไม่ได้, owner map ไม่ได้, Employee inactive/soft deleted, owner ซ้ำหรือบทบาท owner ไม่ถูกต้อง, source conflict/identity ซ้ำ และข้อมูลที่สร้าง RoutineTask ไม่ได้

วันที่เก่า, contract หมดอายุ, due date ที่ผ่านแล้ว และ schedule ที่คลุมเครือหรือ event-driven ไม่ block ระบบเก็บ source text และ fallback เป็น `MANUAL` เมื่อจำเป็น ไม่เดาวันใหม่ ไม่เปลี่ยน contract date เป็นวันนี้ และไม่บังคับ task inactive

Apply ใช้ `excludePastDue: true` จึงเก็บข้อมูลย้อนหลังไว้ใน task แต่ไม่สร้าง occurrence ย้อนหลัง เมื่อ Admin แก้ schedule/date ภายหลัง generation จะสร้างรอบใหม่

UI เป็นช่องทางเดียวของ Admin ไม่มี CLI import script หรือ npm command สำรอง

## Migration strategy

Routine migrations ก่อนหน้านี้ถูก apply แล้ว จึงใช้ forward migration `20260804120000_simplify_routine_reminder_list` โดยไม่แก้ migration history เดิม

Migration:

- normalize historical lifecycle audit rows ให้ใช้ action ที่ยังรองรับ ก่อนลด enum
- drop workflow foreign keys, indexes และ columns จาก occurrence
- drop staging counters ที่ไม่ใช้แล้ว
- normalize activation rows เป็น `ACTIVE` แล้วลด enum ให้เหลือค่าเดียว

ตรวจ migration ด้วย `prisma migrate deploy` บน development database และตรวจ `prisma migrate status` ก่อนส่งมอบ ห้าม reset database ที่มีข้อมูลร่วมกับผู้อื่น

## Verification checklist

- lint strict
- typecheck
- timing status boundary และ Bangkok timezone
- query authorization/filter/response shape
- generation และ due-date override
- reminder scheduler, payload, dispatch revalidation และ dedupe
- Routine Import blocker/non-blocker, owner mapping, target sheet และ no past occurrence
- Notification outbox, Dashboard menu และ notification regression

ยังไม่ดำเนินการ Phase 4 จนกว่าจะได้รับคำสั่งใหม่
