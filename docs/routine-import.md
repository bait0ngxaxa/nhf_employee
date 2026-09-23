# NHF Routine Import — RETIRED

H2A แบ่งการยุติ Routine Import ออกเป็นสองขั้นเพื่อให้เข้ากับลำดับ deploy ที่
รัน Prisma migration ก่อนแทนที่ Next.js process เดิม

สถานะปัจจุบัน: **H2A — CLOSED**; **H2B / Phase 13A.2 — CLOSED**
H2A.1 ถูก deploy ขึ้น production แล้ว และ process รุ่นก่อนหน้าถูกแทนที่ทั้งหมด
แอปที่ deploy อยู่ไม่อ่านหรือเขียน Routine Import และไม่ใช้ provenance ของ
`RoutineTask` อีกต่อไป จึงทำ H2A.2 หลังขั้น deploy แอปได้อย่างปลอดภัย

## H2A.1 — runtime retirement (เสร็จแล้ว)

Routine Excel/file import ถูกยุติถาวรใน product runtime: release นี้ไม่มี Import
routes, UI, application services, authorization capability หรือ audit producers
ผู้ใช้สร้างและดูแลงานผ่าน Routine task UI/API ตามปกติ ซึ่งยังรองรับ schedule,
assignee, occurrence และ reminder

Migration `20260923100000_retire_routine_import` ลบ persisted Import grants
และคงตาราง Import กับ provenance columns ชั่วคราวเพื่อรองรับ process รุ่นเก่า
ระหว่างลำดับ deploy ที่รัน migration ก่อนแทนที่แอป

## H2A.2 — physical persistence contraction (เสร็จแล้ว)

Migration `20260923110000_contract_routine_import_persistence` ลบ
`routine_import_rows`, `routine_import_ledger`, `routine_import_batches`
ตามลำดับ foreign key และลบ `routine_tasks.sourceFileName`, `sourceSheet`,
`sourceRow` ออกจากฐานข้อมูล Prisma schema ไม่มี Import models, enums,
relations หรือ provenance fields อีกแล้ว งาน Routine ปกติ รวมถึง assignee,
occurrence และ reminder ยังคงอยู่

**Rollback floor:** ก่อน H2A.2 ฐานข้อมูลยังรองรับ process ก่อน H2A เพราะมี
ตาราง Import และ provenance columns หลัง H2A.2 ฐานข้อมูลไม่รองรับ binary ที่
select/write `RoutineTask.sourceFileName`, `sourceSheet`, `sourceRow` หรือเข้าถึง
ตาราง Routine Import อีกต่อไป รุ่นเก่าสุดที่ rollback ได้คือ
`099dc0ade8b114c40096cebe0e63c92b1ffc00e9` หรือ release ใหม่กว่าที่
เข้ากันได้กับ H2A.1 ห้ามใช้ `b5ddee4` หรือ binary ก่อน H2A.1 เป็น rollback target
ลำดับ deploy ปัจจุบันปลอดภัยเพราะ H2A.1 ที่ deploy แล้วไม่ใช้โครงสร้างที่ลบ

ณ จุดตัด H2A.2 ยังไม่ได้เปลี่ยน `RoutineReminderRecipientScope` หรือ backfill
ค่า `ADMINS` และ `ASSIGNEES_AND_ADMINS`; H2B ปิดงาน recipient contraction
แยกต่างหากแล้วด้วย migration
`20260923120000_contract_routine_reminder_recipient_scope`. ตอนนี้ MySQL, Prisma
และ application ใช้ `ASSIGNEES`, `ALL_READERS` และ
`ASSIGNEES_AND_ALL_READERS` เท่านั้น และไม่มี
`recipient-scope-compatibility.ts` แล้ว ก่อน deploy migration ใน production
ต้องตรวจว่า canonical collisions เป็นศูนย์ตาม runbook ใน
[notification capability recipient migration](./architecture/notification-capability-recipient-migration.md).

## Audit history

`ROUTINE_IMPORT_UPLOAD`, `ROUTINE_IMPORT_ROW_UPDATE`, `ROUTINE_IMPORT_APPLY` และ
`ROUTINE_IMPORT_CANCEL` ยังคงอ่านและแสดงได้สำหรับ AuditLog เก่า ไม่มีการ rewrite
ประวัติ และ current application release ไม่มี producer สำหรับ action เหล่านี้
