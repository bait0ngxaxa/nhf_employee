# NHF Routine Import — RETIRED

สถานะปัจจุบัน: Routine Excel/file import ถูกยุติถาวรใน H2A ตามการตัดสินใจ
ด้านผลิตภัณฑ์ ไม่มีหน้า import, API, staging workflow หรือ capability สำหรับ
การนำเข้าอีกต่อไป

ผู้ใช้สร้างและดูแลงานผ่าน Routine task UI/API ตามปกติ ซึ่งยังรองรับการตั้ง
schedule, assignee, occurrence และ reminder เอกสารนี้เก็บไว้เพื่อระบุสถานะของ
workflow เดิมให้ชัดเจน และไม่ใช่คู่มือการใช้งานปัจจุบัน

Audit action `ROUTINE_IMPORT_*` ยังคงอ่านและแสดงได้สำหรับประวัติที่บันทึกไว้
ก่อน H2A โดยไม่มี producer ใหม่และไม่มีการ rewrite audit history
