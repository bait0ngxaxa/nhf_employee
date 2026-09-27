# สเปกการแจ้งเตือนการลา

เอกสารนี้สรุปขอบเขตการส่งอีเมลและ in-app notification สำหรับเหตุการณ์แจ้งเตือนการลาทุก flow ที่ตกลงไว้ก่อน implement รวมถึง personal LINE delivery ที่เพิ่มแบบ additive ในภายหลัง รายละเอียด channel matrix ฉบับรวมอยู่ที่ [Notification Channel Architecture](./notification-channels.md)

## หลักการ

- ใช้คำว่า "คำขอลา" ในข้อความใหม่ทั้งหมด หลีกเลี่ยง "ใบลา"
- เหตุการณ์ที่มีอีเมลต้อง enqueue ผ่าน `notification_outbox` แล้วให้ processor ส่งอีเมลและสร้าง in-app notification ให้ผู้รับหลัก
- confirmation ในระบบที่ส่งกลับถึงผู้กระทำเองให้สร้างใน transaction ของ action นั้นได้ทันที
- การส่งคำขอลาใหม่ไม่ต้องสร้าง self notification ให้พนักงาน
- In-app notification ต้องเป็นข้อความสรุป ไม่ใส่เหตุผลการลา เหตุผลฉุกเฉิน เหตุผลพิเศษ หรือเหตุผลไม่อนุมัติแบบเต็ม
- HR/admin ไม่ได้รับ notification อัตโนมัติใน scope นี้ ใช้รายงานและ dashboard ตามเดิม
- การเปลี่ยนผู้อนุมัติใช้ cancel-before-reassign: ห้ามแก้ `approverId` ของคำขอเดิมที่ยัง `PENDING`; พนักงานต้องยกเลิกแล้วส่งคำขอใหม่
- request creation กับ manager reassignment serialize ด้วย `Employee` row lock เดียวกัน และคำขอใหม่ต้องอ่าน manager/User ล่าสุด
- worker กับ cancellation serialize ด้วย `LeaveRequest` row lock; การตรวจ `PENDING` และการสร้าง `LEAVE_REQUESTED` in-app ต้อง atomic ใน transaction เดียวกัน
- transactional authorization ต้อง fail closed โดยตรวจ User และ Employee ใน Prisma transaction client จริง ห้าม fallback เมื่อ delegate หรือ row lock ไม่พร้อม

## Event Matrix

| เหตุการณ์ | ผู้กระทำ | ผู้รับหลัก | ช่องทางผู้รับหลัก | NHFapp LINE | Self confirmation | ปลายทาง |
| --- | --- | --- | --- | --- | --- | --- |
| ส่งคำขอลาใหม่ | พนักงาน | ผู้อนุมัติ | Email + in-app | ผู้อนุมัติที่ active และมี link (`LEAVE_ACTION_LINE`, `action=approve`) | ไม่มี | `managerApproval` |
| อนุมัติคำขอลา | ผู้อนุมัติ | พนักงาน | Email + in-app | พนักงานที่ active และมี link (`LEAVE_RESULT_LINE`) | ไม่มี | `leaveHistory` |
| ไม่อนุมัติคำขอลา | ผู้อนุมัติ | พนักงาน | Email + in-app | พนักงานที่ active และมี link (`LEAVE_RESULT_LINE`) | ไม่มี | `leaveHistory` |
| ยกเลิกคำขอที่ยังรออนุมัติ | พนักงาน | ผู้อนุมัติ | Email + in-app | ผู้อนุมัติที่ active และมี link (`LEAVE_CANCELLED_LINE`, `action=review`) | In-app ถึงพนักงาน | ผู้อนุมัติไป `managerApproval`, พนักงานไป `leaveHistory` |
| แจ้งไม่ได้ใช้วันลา | พนักงาน | ผู้อนุมัติ | Email + in-app | ผู้อนุมัติที่ active และมี link (`LEAVE_NOT_TAKEN_REQUESTED_LINE`, `action=not-taken`) | In-app ถึงพนักงาน | ผู้อนุมัติไป `managerApproval`, พนักงานไป `leaveHistory` |
| ยืนยันไม่ได้ใช้วันลา | ผู้อนุมัติ | พนักงาน | Email + in-app | พนักงานที่ active และมี link (`LEAVE_NOT_TAKEN_CONFIRMED_LINE`) | ไม่มี | `leaveHistory` |
| ขอยกเลิกวันลาที่อนุมัติแล้ว | พนักงาน | ผู้อนุมัติ | Email + in-app | ผู้อนุมัติที่ active และมี link (`LEAVE_CANCELLATION_REQUESTED_LINE`, `action=review`) | In-app ถึงพนักงาน | ผู้อนุมัติไป `managerApproval`, พนักงานไป `leaveHistory` |
| ยืนยันยกเลิกวันลาที่อนุมัติแล้ว | ผู้อนุมัติ | พนักงาน | Email + in-app | พนักงานที่ active และมี link (`LEAVE_CANCELLED_AFTER_APPROVAL_LINE`) | ไม่มี | `leaveHistory` |

## Type Mapping

คง type เดิมที่มีอยู่แล้วเพื่อลด migration ย้อนหลัง:

- Outbox: `LEAVE_ACTION`, `LEAVE_RESULT`
- In-app: `LEAVE_REQUESTED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`

เพิ่ม type ใหม่เฉพาะ event ใหม่:

- Outbox: `LEAVE_CANCELLED`, `LEAVE_NOT_TAKEN_REQUESTED`, `LEAVE_NOT_TAKEN_CONFIRMED`
- Outbox: `LEAVE_CANCELLATION_REQUESTED`, `LEAVE_CANCELLED_AFTER_APPROVAL`
- In-app: `LEAVE_CANCELLED`, `LEAVE_NOT_TAKEN_REQUESTED`, `LEAVE_NOT_TAKEN_CONFIRMED`, `LEAVE_CANCELLATION_REQUESTED`, `LEAVE_CANCELLED_AFTER_APPROVAL`

`SYSTEM_ALERT` ไม่ใช้กับ workflow การลา

## ผู้รับและ Snapshot

ผู้อนุมัติที่ตั้งค่าแล้วต้องเป็น Employee `ACTIVE` และไม่ถูก soft-delete มี User ที่ active และไม่ถูก soft-delete และมีอีเมลที่ผ่าน validation และไม่ลงท้ายด้วย `@temp.local` เพื่อรับ in-app และดำเนินการอนุมัติได้

Outbox payload ต้องเก็บ snapshot ของผู้รับหลัก ณ ตอนเกิดเหตุการณ์ เช่น email, user id, employee id และชื่อที่ใช้แสดงผล เพื่อไม่ให้การเปลี่ยนผู้อนุมัติภายหลังทำให้ notification เก่าไปผิดคน

ถ้าพนักงานมีอีเมลแต่ไม่มี user account สำหรับ in-app ให้ส่งอีเมลตามปกติและข้าม in-app โดยไม่ทำให้ outbox ล้ม เงื่อนไขนี้ไม่ควรเกิดกับผู้อนุมัติที่ตั้งค่าแล้ว

การสร้าง `LEAVE_REQUESTED` in-app ของ worker ต้องอยู่ใน transaction เดียวกับการ lock และตรวจว่าคำขอยังเป็น `PENDING` เพื่อไม่ให้เกิด unread notification หลัง cancellation commit

การยืนยัน not-taken ต้องตรวจว่า caller เป็น original approver จาก `approverId` ก่อนเปิดเผยว่า original approver ยัง eligible หรือจำเป็นต้อง recovery หากไม่ใช่ original approver ให้ตอบ `403`; กรณีเป็น original approver แต่พ้นสภาพให้เข้าสู่ recovery flow

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
- พนักงานขอยกเลิกวันลาที่อนุมัติแล้ว: mark `LEAVE_APPROVED` ของพนักงานและ `LEAVE_REQUESTED` ของผู้อนุมัติเป็นอ่านแล้ว แล้วสร้าง `LEAVE_CANCELLATION_REQUESTED`
- ผู้อนุมัติยืนยันยกเลิก: mark `LEAVE_CANCELLATION_REQUESTED` ของผู้อนุมัติเป็นอ่านแล้ว แล้วสร้าง `LEAVE_CANCELLED_AFTER_APPROVAL` ถึงพนักงาน

ถ้าหา notification เดิมไม่เจอ ไม่ถือเป็น error ของ action ธุรกิจ

## Delivery Failure

ถ้า email service ส่งไม่สำเร็จและคืนค่า `false` ให้ handler ของ leave notification throw error เพื่อให้ processor mark outbox เป็น `FAILED` และ retry ตามระบบเดิม

ถ้า in-app notification ถูกสร้างสำเร็จแล้วแต่ email ล้มเหลว รอบ retry ถัดไปต้องไม่สร้าง in-app ซ้ำด้วย dedupe/no-op duplicate

การส่งอีเมลยังเป็น at-least-once: `Message-ID` ของ `LEAVE_ACTION` ผูกกับ `leaveId + approverUserId` เพื่อช่วยกันการส่งซ้ำของ identity เดิม แต่ไม่รับประกัน exactly-once จาก provider ภายนอก

Personal LINE ใช้ child outbox แยกจาก parent Email/In-app โดย resolve ผู้รับจาก `User` และ `LineAccountLink.lineUserId` แล้วส่งผ่าน NHFapp `LINE_APP_CHANNEL_ACCESS_TOKEN` เท่านั้น หากผู้ใช้ไม่ link หรือไม่ active จะ supersede LINE delivery โดยไม่ทำให้ Email หรือ In-app ล้มเหลว ส่วน LINE provider failure จะ retry ตาม outbox policy ของ child row

Actionable Leave LINE (`LEAVE_ACTION_LINE`, `LEAVE_CANCELLATION_REQUESTED_LINE` และ `LEAVE_NOT_TAKEN_REQUESTED_LINE`) ต้อง lock และ revalidate current workflow state, effective approver และ recipient ก่อนเรียก provider หาก action ถูกดำเนินการหรือผู้อนุมัติเปลี่ยนไปแล้ว child จะเป็น `SUPERSEDED` โดยไม่ส่งข้อความ stale ส่วน result/informational LINE จะยังส่งตาม event snapshot เพื่อไม่ suppress ผลลัพธ์ที่เกิดขึ้นแล้ว

`LEAVE_ACTION_LINE` ใช้ `deliveryIdentity` เดียวกับ Leave action producer เป็นส่วนหนึ่งของ event key ร่วมกับ `leaveId` และ channel ดังนั้น retry ของ action generation เดิมใช้ key เดิม ขณะที่ assignment generation ใหม่ แม้กลับมาที่ผู้อนุมัติคนเดิม ต้องมี delivery identity ใหม่เพื่อให้ outbox dedupe ไม่กลืน notification ที่ถูกต้อง

Leave action generation เป็น state ที่ persist อยู่ใน `LeaveRequest.approvalActionVersion`
ไม่ใช่ retry count หรือ version ของ notification row คำขอใหม่กำหนดค่าเริ่มต้นเป็น `1`
และ producer สร้าง `deliveryIdentity` จาก `leaveId`, `approverUserId` และ version ที่อ่านได้
จากแถว Leave เดียวกัน เมื่อ effective approver เปลี่ยน การเขียน approver state และการเพิ่ม
version ต้องอยู่ใน transaction ที่ lock แถว Leave เดียวกัน หากเปลี่ยนจาก A ไป B แล้วกลับมา A
จะได้ A(v1), B(v2), A(v3) ทำให้ A รอบที่สองไม่ชนกับ delivery ของ A รอบแรก
ฟิลด์นี้ใช้กับ approval-action delivery identity เท่านั้น ไม่เปลี่ยน `LEAVE_ACTION` email
`Message-ID` เดิมหรือการ dedupe ของ in-app notification

Payload หรือ child outbox แบบ legacy ที่ใช้ identity `leaveId:approverUserId` จะรองรับได้
เฉพาะ initial generation ที่ authoritative state ยืนยันว่าเป็น version `1`, คำขอยัง `PENDING`
และไม่มี exception approver; legacy row ที่พิสูจน์ความเป็น action ปัจจุบันไม่ได้จะถูก
`SUPERSEDED` โดยไม่ลบ row ที่ค้างอยู่ การตรวจปัจจุบันจะใช้ effective approver เดียวกับ
authorization โดยให้ exception approver มี precedence เหนือ original approver

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
