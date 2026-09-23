# ดัชนีเอกสาร

งาน H2A re-audit เริ่มจาก `main` ณ source revision
`b5ddee48b42aa37f8fdb6d527e105a9ed94e2072` เป็น baseline เอกสาร phase และ
audit ยังคงเก็บหลักฐาน ณ เวลาที่ตรวจ ไม่ได้อ้างว่าทุกข้อสรุปในบันทึกเก่าเป็น
สถานะปัจจุบัน. การแก้ rollout-safety ของ H2A.1 re-baseline บน
`3de85126f59de55f1d995224afbe7bdb727ba193`.

## เริ่มอ่าน

- [README](../README.md): ติดตั้ง ตั้งค่า environment, deploy, scheduled maintenance,
  backup และ troubleshooting
- [Product](../PRODUCT.md): วัตถุประสงค์ ผู้ใช้ และความสามารถของระบบ
- [Context](../CONTEXT.md): คำศัพท์ธุรกิจและความหมายที่ใช้ร่วมกัน
- [Design](../DESIGN.md): แนวทางภาพลักษณ์และ UI
- [AGENTS.md](../AGENTS.md): ข้อกำหนดการทำงานและการตรวจสอบของ repository

## สถาปัตยกรรมและสถานะปัจจุบัน

- [Feature modules](../modules/README.md): ขอบเขตโมดูลที่มีอยู่ใน `modules/`
- [Module boundaries](./architecture/module-boundaries.md): public entries,
  ownership และเส้นแบ่งระหว่าง server กับ browser
- [Dependency rules](./architecture/dependency-rules.md): ทิศทาง dependency
  และการบังคับใช้
- [Modular monolith](./architecture/modular-monolith.md): โครงสร้างระบบและ
  แนวทางแบ่ง capability
- [Repository audit](./architecture/final-repository-audit.md): K0 discovery,
  K1 closure และ H0 audited-source record; อ่านสถานะตามหัวข้อ closure ล่าสุด
- [Current authorization state](./architecture/authorization-current-state.md):
  business authority, configured grants และ notification-recipient follow-up
- [Notification channels](./notification-channels.md): ความหมายของแต่ละช่องทาง
  และ event delivery
- [Notification recipient migration](./architecture/notification-capability-recipient-migration.md):
  Phase 13A/13A.1/13A.2 current state และ historical pre-cutover runbook

ปัจจุบัน `modules/` มี 10 ขอบเขต: Audit, Auth, Authorization, Department,
Employee, Leave, LINE/LIFF, Notification, Routine และ Stock. Phase K1 ปิด
ขอบเขต Stock LIFF/provider ที่เคยพบใน K0. การย้าย Email Request ไปยังขอบเขต
IT ยังคง deferred.

Authorization ใช้ Default Domain Policy ของแต่ละ capability ร่วมกับ Team,
TeamRole และ direct User grants ที่ตั้งค่าไว้; `ADMIN` ยังคงเป็นบทบาทของ
Auth/control plane และไม่สร้าง business authority โดยอัตโนมัติ. Phase
13A/13A.1/13A.2 ปรับ audience ของ notification ให้ใช้ configured capability
และปิด Routine recipient enum contraction. H2A — CLOSED: H2A.1 นำ Routine
Import runtime, API/UI/application services และ
`routine.import.manage` ออก; H2A.2 ลบตาราง Import, `RoutineTask` provenance
columns และ Prisma compatibility models, enums กับ relations แล้ว. Historical
`ROUTINE_IMPORT_*` AuditAction ยังคงไว้เพื่อ AuditLog เก่า. การสร้างและดูแลงานทำ
ผ่าน Routine task UI/API. H2B / Phase 13A.2: repository implementation
COMPLETE; production collision preflight PASSED; production deployment PASSED;
production transition CLOSED. Routine recipient persistence transition CLOSED.
MySQL, Prisma และ application ใช้ recipient scopes แบบ canonical เท่านั้น.

## Runbooks และ workflow specs

- [Cloudflare Tunnel setup](../CLOUDFLARE_TUNNEL_SETUP.md): public application
  deployment ปัจจุบัน
- [Cloudflare Zero Trust setup](../CLOUDFLARE_ZERO_TRUST_SETUP.md):
  แนวทางเดิมที่ superseded แล้ว ไม่ใช่ขั้นตอน deploy ปัจจุบัน
- [Unified LINE/LIFF runbook](./line-routine.md)
- [LIFF production acceptance](./liff-production-acceptance.md): acceptance
  matrix สำหรับผู้ปฏิบัติงาน
- [LINE Routine reminder manual test](./line-routine-reminder-manual-test.md)
- [Leave attachment deployment](./leave-attachments-deployment.md)
- [Routine Import — retired](./routine-import.md): ประกาศการยุติการนำเข้าไฟล์
- [Leave notification spec](./leave-notification-spec.md): ข้อกำหนด workflow
  การแจ้งเตือนการลาและลิงก์ไปยัง channel matrix ปัจจุบัน

การตรวจ production จริงที่ยังไม่มี operator confirmation เช่น Tunnel/Nginx,
scheduler, secrets, LINE/SMTP, storage และ acceptance บนอุปกรณ์ ต้องยืนยันโดย
ผู้ปฏิบัติงาน สถานะ H2B ด้านบนเป็น operator-confirmed; เอกสารใน repository
เพียงอย่างเดียวไม่ใช่หลักฐานแทน operator สำหรับรายการอื่น

## ADR และบันทึก migration

- [ADR 0001 — Leave exception flows](./adr/0001-leave-exception-flows.md)
- [ADR 0002 — Leave notification delivery](./adr/0002-leave-notification-delivery.md)
- [ADR 0003 — Audit log retention cleanup](./adr/0003-audit-log-retention-cleanup.md)
- [Architecture records](./architecture/): discovery, migration, closure,
  security, runtime และ regression evidence ตาม phase
- [Implementation plan](./implementation-plan/): แผนงาน Routine และการติดตาม
  phase ที่เกี่ยวข้อง

บันทึกที่ระบุ `Historical`, baseline, phase closure, `next phase` หรือ
`not started` เป็นหลักฐานตามช่วงเวลาของบันทึกนั้น ให้อ่านคู่กับเอกสาร current
state ที่ลิงก์ไว้และ source ปัจจุบันก่อนใช้ตัดสินสถานะงาน เอกสารที่เป็นแผนหรือ
acceptance ซึ่งยังเปิดอยู่คงสถานะเดิมจนกว่าจะมีหลักฐานการปิดงาน
