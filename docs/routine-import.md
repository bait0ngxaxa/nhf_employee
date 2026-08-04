# NHF Routine Import

การนำเข้าข้อมูล Routine ใช้หน้าเว็บสำหรับ Admin เป็นช่องทางเดียว:

`NHF Routine` → `นำเข้าจาก Excel`

ระบบอ่านเฉพาะชีต `มสช.` ชีตอื่นจะแสดงเป็นรายการที่ถูกละเว้นและไม่ถูกนำเข้า

## ลำดับการทำงาน

1. อัปโหลดไฟล์ `.xls` หรือ `.xlsx`
2. ระบบสร้าง staging preview และเก็บข้อมูลต้นฉบับของแต่ละแถว
3. Admin ตรวจชื่อรายการและเลือก Employee แบบตรงตัว พร้อมกำหนด `OWNER`/`CO_OWNER`
4. เลือกแถวที่ต้องการนำเข้า
5. ยืนยัน Apply เพื่อสร้าง RoutineTask ที่ active

ระบบไม่ใช้ fuzzy matching และไม่สร้าง RoutineTask หาก owner ยัง map ไม่ได้, Employee inactive/soft deleted, มี owner ซ้ำ หรือบทบาท owner ไม่ถูกต้อง

## เงื่อนไขที่ block

- ไม่มีชื่อรายการ
- ไม่มีหมวดหรือหน่วยงานที่ใช้ได้
- ไม่มีผู้รับผิดชอบหรือ map Employee ไม่ได้
- Employee inactive หรือ soft deleted
- ผู้รับผิดชอบซ้ำ หรือไม่มี/มี `OWNER` มากกว่าหนึ่งคน
- source identity ซ้ำหรือ source fingerprint conflict
- ข้อมูลที่ normalize แล้วไม่สามารถผ่าน validation ของ RoutineTask

## เงื่อนไขที่ไม่ block

สัญญาที่หมดอายุ, due date ที่ผ่านมาแล้ว, วันที่เก่า, schedule text เก่า, schedule ที่คลุมเครือหรือขึ้นกับ event และ holiday wording ไม่ทำให้แถวเป็น review blocker ระบบเก็บข้อความต้นฉบับไว้ และใช้ `MANUAL` เมื่อไม่สามารถตีความ schedule ได้อย่างปลอดภัย

วันที่จาก Excel ที่ parse ได้จะถูกเก็บตามจริง ไม่ถูกแทนด้วยวันที่ปัจจุบัน และไม่ทำให้ task inactive อัตโนมัติ Admin แก้ schedule, contract date, reminder และ active state ได้ภายหลังจากหน้า RoutineTask settings

## Occurrence และ idempotency

Apply เรียก generation ด้วย `{ excludePastDue: true }` ดังนั้นข้อมูลเก่าจะไม่สร้าง occurrence ย้อนหลัง ข้อมูลวันเดิมยังอยู่ใน RoutineTask และจะสร้างรอบใหม่เมื่อ Admin แก้ schedule หรือวันที่

source identity และ fingerprint ใน ledger ป้องกันการ Apply ซ้ำและตรวจ source conflict โดยไม่ overwrite RoutineTask เดิม

## Reminder defaults

Import ไม่บังคับให้ Admin ตั้ง reminder ทีละแถว และไม่สร้าง preset จากการเดา หากต้องการแจ้งเตือนให้ตั้ง rule ภายหลังใน RoutineTask settings

ไม่มี CLI import flow หรือ npm script แยกจาก UI
