# จำกัดอายุเก็บรักษาบันทึกการใช้งานด้วย cleanup endpoint

ระบบจะเก็บบันทึกการใช้งานไว้สูงสุด 90 วันนับจากเวลาสร้างบันทึก และลบถาวรเฉพาะรายการที่ `createdAt < now - 90 วัน` เมื่อ external cron เรียก `POST /api/audit-logs/cleanup` พร้อม `x-cleanup-secret` ที่ตรวจด้วย `AUDIT_LOG_CLEANUP_SECRET` เราเลือกใช้ protected endpoint ตามรูปแบบ cleanup ที่มีอยู่แล้วแทน in-app scheduler เพื่อไม่เพิ่ม scheduler dependency ในแอปและให้ deployment เป็นผู้กำหนดรอบการรัน

งาน cleanup นี้ไม่บันทึกเหตุการณ์กลับเข้า `audit_logs` ในรอบแรก เพราะ requirement หลักคือจำกัดอายุข้อมูล ไม่ใช่สร้าง chain-of-custody ของการลบ และการบันทึกลงตารางเดียวกันจะทำให้ต้องเพิ่ม action ใหม่พร้อมคำถามซ้ำว่าการลบ audit log ต้อง audit ด้วย audit log หรือไม่ ผลลัพธ์ของ endpoint จึงควรตอบ `success`, `deletedCount`, และ `cutoff` เพื่อให้ cron หรือ infra log ภายนอกเก็บหลักฐานการรันได้
