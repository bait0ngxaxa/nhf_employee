# ดัชนีเอกสาร

## เริ่มต้น

- [README โครงการ](../README.md): ภาพรวมโมดูล เทคโนโลยี และการพัฒนาในเครื่อง
- [Product](../PRODUCT.md), [Context](../CONTEXT.md), [Design](../DESIGN.md) และ [AGENTS.md](../AGENTS.md)

## เอกสารปัจจุบันตามหน้าที่

- [Production Deployment & LIFF Runbook](./operations/production-deployment.md): **แหล่งอ้างอิงหลักเพียงฉบับเดียวสำหรับ deploy production, LINE/LIFF rollout, scheduler/outbox, Rich Menu, rollback และ monitoring**
- [Production Acceptance](./operations/production-acceptance.md): ผลตรวจ production ปัจจุบันและข้อกำหนดให้ตรวจใหม่ทุก release
- [Storage and Attachments](./operations/storage-and-attachments.md): persistent `.uploads/`, backup/restore, Leave และ IT private files
- [Cloudflare Tunnel](./operations/cloudflare-tunnel.md): network path ที่รองรับผ่าน Nginx
- [Routine reminder verification](./operations/verification/routine-reminder.md): ขั้นตอนทดสอบเฉพาะ reminder
- [Notification architecture](./integrations/notifications.md): channel matrix, outbox และการเชื่อมต่อ LINE/Email
- [Leave notification specification](./features/leave-notifications.md): กฎ workflow การแจ้งเตือนการลา

**นโยบาย source of truth:** New production commands and operational deployment procedures must be added to `docs/operations/production-deployment.md`. Feature/integration documents should link to the canonical runbook instead of creating another deployment procedure. เอกสาร storage และ Cloudflare อธิบายรายละเอียดเฉพาะทางโดยมี runbook หลักกำหนดลำดับ release

## สถาปัตยกรรม ประวัติ และข้อมูลอ้างอิง

- [Architecture](./architecture/): contracts, migration records, phase closure และ security regression evidence; บันทึก phase เป็นหลักฐานตามเวลาที่เขียน **ไม่ใช่ production runbook หรือผลตรวจรับ production ปัจจุบัน**
- [Current authorization state](./architecture/authorization-current-state.md), [module boundaries](./architecture/module-boundaries.md) และ [dependency rules](./architecture/dependency-rules.md)
- [ADRs](./adr/): เหตุผลและการตัดสินใจด้านสถาปัตยกรรม
- [Implementation plans](./implementation-plan/): แผนและลำดับงานย้อนหลัง
- [Agent/domain notes](./agents/): บริบทสำหรับงานพัฒนา
- [Reference files](./reference/): input artifacts รวม [Routine spreadsheet](./reference/NHF%20Routine%20list_cost_update270625.xls)
- [Archive](./archive/): [Routine import ที่ยุติแล้ว](./archive/routine-import-retired.md) และ [Cloudflare Zero Trust ที่ superseded](./archive/cloudflare-zero-trust-superseded.md)

หากบันทึกสถาปัตยกรรมระบุว่าหลักฐาน production ยังไม่มี ให้ตีความตามวันที่ของบันทึกนั้น ผลยืนยัน production ปัจจุบันอยู่ที่ [Production Acceptance](./operations/production-acceptance.md) เท่านั้น
