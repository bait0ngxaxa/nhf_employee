# Notification Channel Architecture

เอกสารนี้เป็น source of truth เชิงปฏิบัติการสำหรับช่องทางแจ้งเตือนของ NHF Employee
ครอบคลุม Leave, Routine และ Stock ในช่วงที่ระบบกำลังเพิ่ม NHFapp LINE OA แบบค่อยเป็นค่อยไป

หลักการที่ต้องคงไว้:

- Email notifications remain supported.
- In-app notifications remain supported.
- Stock legacy LINE remains supported during the migration period.

## Architecture

ทุก business event ยังคงสร้าง notification semantics เดิมของโมดูล แล้วส่งงานผ่าน
transactional outbox ตาม channel ที่เกี่ยวข้อง:

```text
Business event
    ├── existing parent outbox → In-app / Email
    ├── personal LINE child outbox
    │       ↓
    │   sendAppLineNotification({ userId, message, retryKey })
    │       ↓
    │   active User/Employee + LineAccountLink.lineUserId
    │       ↓
    │   sendLineAppMessage()
    │       ↓
    │   LINE_APP_CHANNEL_ACCESS_TOKEN
    │       ↓
    │   NHFapp LINE OA → LIFF deep link
    └── Stock operational outbox → legacy Stock LINE broadcast (unchanged)
```

Feature service เป็นเจ้าของ event semantics, recipient intent, message data และ destination
ส่วน shared LINE delivery layer เป็นเจ้าของการ resolve recipient, การเรียก Messaging API
และการส่ง retry key เท่านั้น ไม่มี feature module ใดอ่าน channel access token โดยตรง

## LINE identity, LIFF และ Messaging API

1. ผู้ใช้เปิด NHFapp LIFF และผ่าน LINE Login ใน LIFF app
2. Server ตรวจสอบ LINE identity assertion แล้วสร้าง/กู้ NHFapp LIFF session
3. ขั้นตอน account linking ผูก application `User` กับ LINE identity ใน `LineAccountLink`
   โดยเก็บ `lineUserId` และไม่เขียนทับ link ที่ขัดแย้ง
4. เมื่อเกิด personal notification server ใช้ application `userId` เป็น input ให้ shared
   delivery layer; layer นี้อ่าน `LineAccountLink.lineUserId` แล้วเรียก `sendLineAppMessage()`
5. `sendLineAppMessage()` ใช้ `LINE_APP_CHANNEL_ACCESS_TOKEN` ของ NHFapp Messaging API
   Channel เพื่อ push ไปยัง NHFapp LINE OA
6. URL ใน Flex message เป็น navigation ไปยัง LIFF เท่านั้น การยืนยันตัวตนและ
   authorization ของ request/task/occurrence ยังทำที่ server-side LIFF API เสมอ

LINE Login Channel ที่มี LIFF และ NHFapp Messaging API Channel ต้องอยู่ใต้ LINE Provider
เดียวกัน เพราะ LINE user ID เป็น provider-scoped

## Notification channel matrix

| เหตุการณ์ | In-app | Email | NHFapp LINE (personal) | Legacy Stock LINE |
| --- | --- | --- | --- | --- |
| Leave request / action required | มี parent เดิม | มี parent เดิม | approver ที่ active และมี link | ไม่ใช้ |
| Leave approval / rejection result | มี parent เดิม | มี parent เดิม | employee/request owner | ไม่ใช้ |
| Leave cancelled while pending | มี parent เดิม | มี parent เดิม | approver ตาม flow เดิม | ไม่ใช้ |
| Leave cancellation requested | มี parent เดิม | มี parent เดิม | approver ตาม flow เดิม | ไม่ใช้ |
| Leave cancelled after approval | มี parent เดิม | มี parent เดิม | employee ตาม flow เดิม | ไม่ใช้ |
| Leave not-taken requested | มี parent เดิม | มี parent เดิม | approver ตาม flow เดิม | ไม่ใช้ |
| Leave not-taken confirmed | มี parent เดิม | มี parent เดิม | employee ตาม flow เดิม | ไม่ใช้ |
| Routine reminder | มี | มี | recipient ตาม scope ที่ active และมี link; assignee ใช้ Routine LIFF, admin คง dashboard URL เดิม | ไม่ใช้ |
| Routine contract expiry | มี | มี | assignee ที่ active และมี link; คง destination semantics เดิม | ไม่ใช้ |
| Stock request result: issued / admin cancellation | มีเดิม | มีเดิม | requester ที่ active และมี link → Stock LIFF | ไม่ใช้ |
| Stock request self-cancellation | มีเดิม | ไม่เพิ่ม/ไม่เปลี่ยน behavior เดิม | requester ที่ active และมี link → Stock LIFF | ไม่ใช้ |
| Stock new request for operations | มีเดิม | ตาม behavior เดิมของระบบ | ยังไม่ใช้ | ใช้ `LINE_STOCK_CHANNEL_ACCESS_TOKEN` |
| Low-stock alert | มีเดิม | ตาม behavior เดิมของระบบ | ยังไม่ใช้ | ใช้ `LINE_STOCK_CHANNEL_ACCESS_TOKEN` |

คำว่า “มี parent เดิม” หมายถึงไม่เปลี่ยน notification record, dedupe, read/unread,
หรือ email workflow เดิมของ event นั้น LINE เป็น child delivery เพิ่มเติม

## Leave LINE flows

Leave ใช้ outbox type แยกจาก parent เพื่อให้ Email/In-app ไม่อยู่ใน retry boundary เดียวกับ
LINE:

| Outbox LINE event | ผู้รับ | LIFF action |
| --- | --- | --- |
| `LEAVE_ACTION_LINE` | current approver | `action=approve` |
| `LEAVE_RESULT_LINE` | employee/request owner | เปิดรายละเอียดคำขอ |
| `LEAVE_CANCELLED_LINE` | approver ตาม cancellation semantics | `action=review` |
| `LEAVE_CANCELLATION_REQUESTED_LINE` | current approver | `action=review` |
| `LEAVE_CANCELLED_AFTER_APPROVAL_LINE` | employee ตาม flow เดิม | เปิดรายละเอียดคำขอ |
| `LEAVE_NOT_TAKEN_REQUESTED_LINE` | current approver | `action=not-taken` |
| `LEAVE_NOT_TAKEN_CONFIRMED_LINE` | employee ตาม flow เดิม | เปิดรายละเอียดคำขอ |

ข้อความ Leave เป็น Flex message ที่มีประเภทการลา, ช่วงวันที่/ระยะเวลา, สถานะหรือผู้กระทำ
และ CTA ที่ชี้ไปยัง `/liff/leave` ผ่าน `buildLeaveLiffRequestUrl()` เสมอ

ก่อนส่ง actionable Leave LINE ทุกครั้ง ระบบ lock และตรวจซ้ำกับ workflow state ปัจจุบัน:

- `LEAVE_ACTION_LINE` ต้องยัง `PENDING`, approver ต้องเป็น current approver ที่ active และ
  `deliveryIdentity` ต้องตรงกับ action generation ที่ enqueue ไว้
- `LEAVE_CANCELLATION_REQUESTED_LINE` ต้องยังอยู่ระหว่างรอยืนยัน/พิจารณายกเลิก และผู้รับ
  ต้องเป็น effective approver ที่ active
- `LEAVE_NOT_TAKEN_REQUESTED_LINE` ต้องยังมี not-taken action ค้างอยู่ และผู้รับต้องเป็น
  effective approver ที่ active

ถ้า action ใดไม่ตรงกับ state, recipient หรือ delivery identity ปัจจุบัน child row จะถูก
mark เป็น `SUPERSEDED` และจะไม่เรียก LINE provider ส่วน result/informational LINE เช่น
`LEAVE_RESULT_LINE`, `LEAVE_CANCELLED_AFTER_APPROVAL_LINE` และ
`LEAVE_NOT_TAKEN_CONFIRMED_LINE` จะไม่ถูก suppress ด้วยกฎ pending-action นี้ เพราะเป็นผลลัพธ์
ของเหตุการณ์ที่เกิดขึ้นแล้ว

สำหรับ `LEAVE_ACTION_LINE` event key ใช้ `leaveId + deliveryIdentity + LINE channel`
โดย `deliveryIdentity` เป็น identity แบบ deterministic ของ Leave action producer ไม่ได้
สร้างจาก recipient เพียงอย่างเดียว จึงรองรับ assignment generation เดิมซ้ำผู้รับเดิมได้
โดยไม่ทำให้ retry ของ generation เดียวกันสร้าง child ซ้ำ

## Routine behavior

Routine ยังคงมี reminder version validation, schedule/due-time validation, recipient scope,
stale suppression และ `SUPERSEDED`/`DEFERRED` semantics เดิม การ refactor ใช้ shared
`sendAppLineNotification()` เป็น transport boundary เดียวกัน และสร้าง LINE retry key แบบ
deterministic จาก event key เดิมเพื่อให้การประมวลผลซ้ำส่ง provider key เดิม

## Stock coexistence

Stock แบ่งเป็นสองกลุ่ม:

- Personal request result เพิ่ม `STOCK_REQUEST_RESULT_LINE` สำหรับ requester และใช้
  `LINE_APP_CHANNEL_ACCESS_TOKEN` ผ่าน `LineAccountLink` และ Stock LIFF
- Operational/team events (`STOCK_REQUEST_LINE` และ `STOCK_LOW_LINE`) ยังใช้
  `sendStockLineBroadcast()` และ `LINE_STOCK_CHANNEL_ACCESS_TOKEN` ตามเดิม

ห้ามนำ `LINE_APP_CHANNEL_ACCESS_TOKEN` ไปแทน legacy Stock token ใน operational broadcast
และห้ามลบ `LINE_STOCK_CHANNEL_ACCESS_TOKEN` ใน phase นี้

## Failure, retry และ idempotency

- Outbox parent กับ personal LINE child เป็นคนละ row และประมวลผลแยกกัน ดังนั้น LINE failure
  จะไม่ทำให้ Email ถูกส่งซ้ำเพียงเพราะ LINE retry
- Child row ใช้ deterministic `eventKey` และ `createLineRetryKey(eventKey)`; unique
  `eventKey` ทำให้ enqueue ซ้ำจาก parent retry ไม่สร้าง child ซ้ำ
- `sendLineAppMessage()` ส่ง `X-Line-Retry-Key`; provider duplicate acknowledgement (`409`)
  ที่มี retry key ถือว่าสำเร็จตาม implementation ปัจจุบัน
- User/Employee ที่ inactive, deleted, ผูก link ไม่ได้ หรือไม่มี `LineAccountLink` เป็น
  business state ที่ valid: ไม่ throw จาก business action; ถ้ามี child row แล้วจะถูก
  `SUPERSEDED` เพื่อไม่ retry ถาวร (Routine อาจไม่สร้าง child ตั้งแต่ enqueue เมื่อยังไม่ link)
- ความล้มเหลวชั่วคราวของ LINE provider จะ throw จาก child processor เพื่อใช้ outbox retry
  เดิม สูงสุด 3 attempts ก่อน `DEAD`; Email และ In-app row ไม่ถูก duplicate จาก retry นี้
- Routine ยังคง stale validation และ `DEFERRED`/`SUPERSEDED` behavior เดิม

## Configuration and operations

Personal application LINE ใช้ค่าต่อไปนี้:

- `NEXT_PUBLIC_LINE_LIFF_ID`: LIFF ID สำหรับ deep link และ client bootstrap
- `LINE_LOGIN_CHANNEL_ID`: LINE Login channel ที่ใช้ตรวจ identity
- `LINE_APP_CHANNEL_ACCESS_TOKEN`: NHFapp Messaging API token สำหรับ personal push
- `LINE_APP_CHANNEL_SECRET`: channel secret ของ NHFapp Messaging API ตาม integration เดิม
- `LINE_LIFF_SESSION_SECRET`, `LINE_LIFF_SESSION_TTL_SECONDS`: LIFF session configuration

Legacy integrations ยังคงแยก configuration:

- `LINE_STOCK_CHANNEL_ACCESS_TOKEN`: Stock operational broadcast เดิม
- `LINE_STOCK_CHANNEL_SECRET`: Stock legacy webhook/integration เดิม
- `LINE_IT_CHANNEL_ACCESS_TOKEN` และค่าที่เกี่ยวข้อง: IT/email-request integration เดิม

Production ต้อง apply forward-only migration สำหรับ enum outbox ใหม่, ตั้งค่า NHFapp token/LIFF
ให้มาจาก Provider เดียวกัน, ให้ผู้ใช้เพิ่ม NHFapp OA และทำ account linking, แล้วตรวจ outbox
cron/worker และ provider logs ด้วยข้อมูลที่ไม่เปิดเผย token หรือ ID token

## Future retirement criteria for Stock legacy LINE

การ retire legacy Stock LINE ต้องเป็น phase แยกและทำได้เมื่อมีครบอย่างน้อย:

1. มี recipient policy ที่ได้รับการอนุมัติสำหรับ processor/admin และ low-stock operations
2. operational recipients ทุกกลุ่มมี account linking และ fallback ที่ยืนยันแล้ว
3. มี production acceptance, delivery metrics และ retry/dead-letter monitoring ต่อกลุ่ม
4. มีแผน cutover/rollback ที่ไม่ทำให้ operational alert หาย
5. ยืนยันแล้วว่าไม่ต้องใช้ `LINE_STOCK_CHANNEL_ACCESS_TOKEN` กับ integration อื่น

Phase นี้ intentionally ไม่ migrate operational broadcast และไม่ retire legacy token
