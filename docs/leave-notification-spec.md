# สเปกการแจ้งเตือนการลา

เอกสารนี้สรุปขอบเขตการส่งอีเมลและ in-app notification สำหรับเหตุการณ์แจ้งเตือนการลาทุก flow ที่ตกลงไว้ก่อน implement

## หลักการ

- ใช้คำว่า "คำขอลา" ในข้อความใหม่ทั้งหมด หลีกเลี่ยง "ใบลา"
- เหตุการณ์ที่มีอีเมลต้อง enqueue ผ่าน `notification_outbox` แล้วให้ processor ส่งอีเมลและสร้าง in-app notification ให้ผู้รับหลัก
- confirmation ในระบบที่ส่งกลับถึงผู้กระทำเองให้สร้างใน transaction ของ action นั้นได้ทันที
- การส่งคำขอลาใหม่ไม่ต้องสร้าง self notification ให้พนักงาน
- In-app notification ต้องเป็นข้อความสรุป ไม่ใส่เหตุผลการลา เหตุผลฉุกเฉิน เหตุผลพิเศษ หรือเหตุผลไม่อนุมัติแบบเต็ม
- HR/admin ไม่ได้รับ notification อัตโนมัติใน scope นี้ ใช้รายงานและ dashboard ตามเดิม

## Event Matrix

| เหตุการณ์ | ผู้กระทำ | ผู้รับหลัก | ช่องทางผู้รับหลัก | Self confirmation | ปลายทาง |
| --- | --- | --- | --- | --- | --- |
| ส่งคำขอลาใหม่ | พนักงาน | ผู้อนุมัติ | Email + in-app | ไม่มี | `managerApproval` |
| อนุมัติคำขอลา | ผู้อนุมัติ | พนักงาน | Email + in-app | ไม่มี | `leaveHistory` |
| ไม่อนุมัติคำขอลา | ผู้อนุมัติ | พนักงาน | Email + in-app | ไม่มี | `leaveHistory` |
| ยกเลิกคำขอที่ยังรออนุมัติ | พนักงาน | ผู้อนุมัติ | Email + in-app | In-app ถึงพนักงาน | ผู้อนุมัติไป `managerApproval`, พนักงานไป `leaveHistory` |
| แจ้งไม่ได้ใช้วันลา | พนักงาน | ผู้อนุมัติ | Email + in-app | In-app ถึงพนักงาน | ผู้อนุมัติไป `managerApproval`, พนักงานไป `leaveHistory` |
| ยืนยันไม่ได้ใช้วันลา | ผู้อนุมัติ | พนักงาน | Email + in-app | ไม่มี | `leaveHistory` |

## Type Mapping

คง type เดิมที่มีอยู่แล้วเพื่อลด migration ย้อนหลัง:

- Outbox: `LEAVE_ACTION`, `LEAVE_RESULT`
- In-app: `LEAVE_REQUESTED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`

เพิ่ม type ใหม่เฉพาะ event ใหม่:

- Outbox: `LEAVE_CANCELLED`, `LEAVE_NOT_TAKEN_REQUESTED`, `LEAVE_NOT_TAKEN_CONFIRMED`
- In-app: `LEAVE_CANCELLED`, `LEAVE_NOT_TAKEN_REQUESTED`, `LEAVE_NOT_TAKEN_CONFIRMED`

`SYSTEM_ALERT` ไม่ใช้กับ workflow การลา

## ผู้รับและ Snapshot

ผู้อนุมัติที่ตั้งค่าแล้วต้องมีทั้งความสัมพันธ์ผู้อนุมัติในข้อมูลพนักงานและบัญชีผู้ใช้ที่ active เพื่อรับ in-app และดำเนินการอนุมัติได้

Outbox payload ต้องเก็บ snapshot ของผู้รับหลัก ณ ตอนเกิดเหตุการณ์ เช่น email, user id, employee id และชื่อที่ใช้แสดงผล เพื่อไม่ให้การเปลี่ยนผู้อนุมัติภายหลังทำให้ notification เก่าไปผิดคน

ถ้าพนักงานมีอีเมลแต่ไม่มี user account สำหรับ in-app ให้ส่งอีเมลตามปกติและข้าม in-app โดยไม่ทำให้ outbox ล้ม เงื่อนไขนี้ไม่ควรเกิดกับผู้อนุมัติที่ตั้งค่าแล้ว

## Payload และ Formatting

สร้าง schema/validator กลางสำหรับ leave notification payload ใต้ `lib/services/leave/` แล้วใช้ร่วมกันระหว่าง route, outbox processor, notification service และ email template

Payload ควรเก็บข้อมูลดิบที่ parse ได้ เช่น `startDate` และ `endDate` เป็น ISO string ส่วนข้อความไทยให้ format ตอน render ด้วย helper กลาง

ต้องมี helper กลางสำหรับ:

- ช่วงวันที่ลา
- label ของประเภทลา
- label ของช่วงเวลา: `เต็มวัน`, `ครึ่งวันเช้า`, `ครึ่งวันบ่าย`
- สรุปวันที่ + จำนวนวัน + ช่วงเวลา

คำขอลาใหม่ต้องแสดง flag สำคัญในข้อความถึงผู้อนุมัติ:

- ลาย้อนหลังกรณีฉุกเฉิน: แสดงในอีเมลพร้อมเหตุผลฉุกเฉิน และสรุปสั้นใน in-app
- คำขอลาเกินโควต้ากรณีพิเศษ: แสดงจำนวนวันที่เกินและเหตุผลพิเศษในอีเมล และสรุปสั้นใน in-app

## In-App Lifecycle

ทุก leave notification ต้องมี `referenceId = leaveId`

เพิ่มการกันซ้ำด้วย `dedupeKey` เฉพาะ leave notification โดย key ประกอบจาก `userId + type + referenceId` เพื่อไม่กระทบ notification ประเภทอื่นที่ต้องมีหลายรายการต่อ reference เดียว ถ้า processor พบ duplicate จาก unique constraint ให้ถือว่าส่วน in-app สำเร็จแบบ no-op

เมื่อเหตุการณ์ทำให้งานค้างของผู้อนุมัติสิ้นสุด ให้ mark notification เดิมเป็นอ่านแล้วแทนการลบ:

- อนุมัติหรือไม่อนุมัติคำขอลา: mark `LEAVE_REQUESTED` ของผู้อนุมัติเป็นอ่านแล้ว
- พนักงานยกเลิกคำขอ: mark `LEAVE_REQUESTED` ของผู้อนุมัติเป็นอ่านแล้ว แล้วสร้าง `LEAVE_CANCELLED`
- ผู้อนุมัติยืนยันไม่ได้ใช้วันลา: mark `LEAVE_NOT_TAKEN_REQUESTED` ของผู้อนุมัติเป็นอ่านแล้ว แล้วสร้าง `LEAVE_NOT_TAKEN_CONFIRMED` ถึงพนักงาน

ถ้าหา notification เดิมไม่เจอ ไม่ถือเป็น error ของ action ธุรกิจ

## Delivery Failure

ถ้า email service ส่งไม่สำเร็จและคืนค่า `false` ให้ handler ของ leave notification throw error เพื่อให้ processor mark outbox เป็น `FAILED` และ retry ตามระบบเดิม

ถ้า in-app notification ถูกสร้างสำเร็จแล้วแต่ email ล้มเหลว รอบ retry ถัดไปต้องไม่สร้าง in-app ซ้ำด้วย dedupe/no-op duplicate

## Email Template

คง template เดิมสำหรับคำขอใหม่และผลอนุมัติ/ไม่อนุมัติ แต่ปรับข้อความและข้อมูลประกอบให้ตรงกับ glossary

เพิ่ม template กลางสำหรับ event ใหม่ เช่น ยกเลิกคำขอ, แจ้งไม่ได้ใช้วันลา, และยืนยันไม่ได้ใช้วันลา โดยรับข้อมูลจาก payload schema กลาง

อีเมลถึงพนักงานควรแสดงชื่อผู้อนุมัติถ้ามีใน snapshot ถ้าไม่มีให้ใช้คำว่า "ผู้อนุมัติ" แบบ generic

## Test Scope

- Route tests สำหรับ enqueue outbox, self confirmation, mark read และ validation ผู้อนุมัติที่ตั้งค่าแล้ว
- Outbox processor tests สำหรับ dispatch event ใหม่, payload validation, dedupe/no-op duplicate และ mark `SENT`
- Email/template tests สำหรับ HTML escaping, flag ลาย้อนหลัง, flag เกินโควต้า และข้อความไทย
- UI notification mapping tests หรือ component tests สำหรับ icon/label ของ type ใหม่ถ้ามีโครงสร้าง test รองรับ

ไม่ต้องเพิ่ม E2E ในรอบแรก เพราะ behavior หลักอยู่ที่ server-side workflow และ processor
