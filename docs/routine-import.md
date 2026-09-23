# NHF Routine Import — RETIRED

H2A แบ่งการยุติ Routine Import ออกเป็นสองขั้นเพื่อให้เข้ากับลำดับ deploy ที่
รัน Prisma migration ก่อนแทนที่ Next.js process เดิม

สถานะ rollout: H2A.1 พร้อม deploy และจะปิดได้หลังยืนยันการ deploy และการ
retire process รุ่นก่อนหน้า; H2A.2 และ H2B ยังรอดำเนินการ

## H2A.1 — runtime retirement (ขั้นปัจจุบัน)

Routine Excel/file import ถูกยุติถาวรใน product runtime: release นี้ไม่มี Import
routes, UI, application services, authorization capability หรือ audit producers
ผู้ใช้สร้างและดูแลงานผ่าน Routine task UI/API ตามปกติ ซึ่งยังรองรับ schedule,
assignee, occurrence และ reminder

เพื่อให้ process รุ่นก่อนหน้ายังอ่านและเขียนฐานข้อมูลได้ระหว่าง deploy, H2A.1
ยังคง Prisma compatibility models, enums, relations และ `RoutineTask` provenance
fields ที่ตรงกับ physical tables/columns เดิมไว้ โค้ด application ปัจจุบันไม่มี
consumer สำหรับข้อมูลเหล่านี้; ไม่ใช่การคง Import feature ไว้ชั่วคราวเพื่อใช้งาน
ต่อ migration `20260923100000_retire_routine_import` ลบเฉพาะ persisted grants ของ
`routine.import.manage` และไม่เปลี่ยน Routine schema

## H2A.2 — physical persistence contraction (รอดำเนินการ)

หลัง H2A.1 deploy แล้วและยืนยันว่า process รุ่นก่อนหน้าทั้งหมดหยุดทำงาน จึงเพิ่ม
forward migration แยกเพื่อ drop `routine_import_rows`, `routine_import_ledger`,
`routine_import_batches` และ `routine_tasks.sourceFileName`, `sourceSheet`,
`sourceRow` ตาม dependency-safe order จากนั้นลบ compatibility models/fields/enums
ออกจาก Prisma schema การเปลี่ยนแปลงนี้จะไม่ลบ RoutineTask, occurrence, reminder
rule, assignee หรือข้อมูลธุรกิจอื่น

H2A.2 ไม่เปลี่ยน `RoutineReminderRecipientScope`; การ backfill และ contraction ของ
recipient enum เป็นงาน H2B แยกต่างหาก

## Audit history

`ROUTINE_IMPORT_UPLOAD`, `ROUTINE_IMPORT_ROW_UPDATE`, `ROUTINE_IMPORT_APPLY` และ
`ROUTINE_IMPORT_CANCEL` ยังคงอ่านและแสดงได้สำหรับ AuditLog เก่า ไม่มีการ rewrite
ประวัติ และ current application release ไม่มี producer สำหรับ action เหล่านี้
