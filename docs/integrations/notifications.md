# Notification Channel Architecture

เอกสารนี้เป็น source of truth เชิงปฏิบัติการสำหรับช่องทางแจ้งเตือนของ NHF Employee
ครอบคลุม Leave, Routine, Stock และ IT Ticket ในช่วงที่ระบบกำลังเพิ่ม NHFapp LINE OA แบบค่อยเป็นค่อยไป

หลักการที่ต้องคงไว้:

- Email notifications remain supported.
- In-app notifications remain supported.
- Stock legacy LINE remains supported during the migration period.

Routine, Stock, and Email Request recipient selection now uses configured
capabilities after Phase 13A/13A.1; see the
[recipient migration record](../architecture/notification-capability-recipient-migration.md)
for the current mappings and rollout boundary.

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
    └── Stock operational outbox → legacy Stock LINE broadcast
            (LINE retry key only at the Outbox boundary; token/audience unchanged)
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
| Routine reminder | มี | มี | recipient ตาม scope ที่ active และมี link; assignee ใช้ Routine LIFF, `ALL_READERS` ใช้ Dashboard URL | ไม่ใช้ |
| Routine contract expiry | มี | มี | assignee ที่ active และมี link; คง destination semantics เดิม | ไม่ใช้ |
| Stock request result: issued / admin cancellation | มีเดิม | มีเดิม | requester ที่ active และมี link → Stock LIFF | ไม่ใช้ |
| Stock request self-cancellation | มีเดิม | ไม่เพิ่ม/ไม่เปลี่ยน behavior เดิม | requester ที่ active และมี link → Stock LIFF | ไม่ใช้ |
| Stock new request for operations | มีเดิม | ตาม behavior เดิมของระบบ | ยังไม่ใช้ | ใช้ `LINE_STOCK_CHANNEL_ACCESS_TOKEN` |
| Low-stock alert | มีเดิม | ตาม behavior เดิมของระบบ | ยังไม่ใช้ | ใช้ `LINE_STOCK_CHANNEL_ACCESS_TOKEN` |
| IT Ticket events | `IT_TICKET_IN_APP` | `IT_TICKET_EMAIL` | `IT_TICKET_LINE` ตาม IT12 matrix ด้านล่าง | ไม่ใช้สำหรับ Ticket |

คำว่า “มี parent เดิม” หมายถึงไม่เปลี่ยน notification record, dedupe, read/unread,
หรือ email workflow เดิมของ event นั้น LINE เป็น child delivery เพิ่มเติม

## IT Ticket channel completion — IT12

IT12 completes delivery for the six approved Ticket facts. Recipient rules,
authorization, Inbox semantics, Ticket timeline, Audit, requester LIFF, and
workflow behavior remain owned by IT and unchanged. The same validated
semantic payload and source/applicability policy serve Inbox, Email, and LINE.

### IT Ticket event matrix

| IT event | Audience | Inbox | Email | NHFapp personal LINE |
| --- | --- | --- | --- | --- |
| `CREATED` | Configured operator queue | Yes | Yes | Yes |
| `ASSIGNED` | Newly assigned eligible operator | Yes | Yes | Yes |
| `OPERATOR_COMMENTED` | Requester | Yes | Yes | Yes |
| `REQUESTER_COMMENTED` | Current assignee, or configured operator queue while unassigned | Yes | Yes | Yes |
| `WAITING_REQUESTER` | Requester | Yes | Yes | Yes |
| `RESOLVED` | Requester | Yes | Yes | Yes |

No channel is added for category changes, ordinary `IN_PROGRESS`, unassignment,
attachments alone, reads, analytics, replayed/no-op commands, or failed commands.

### IT Ticket destinations

| Audience | Inbox | Email | Personal LINE |
| --- | --- | --- | --- |
| Requester | Dashboard Ticket `/dashboard/it/<ticketId>` | Dashboard Ticket `/dashboard/it/<ticketId>` | Requester LIFF `/liff/it/<ticketId>` |
| Operator queue or assignee | Canonical operator Dashboard Ticket `/dashboard/it/queue/<ticketId>` | Same operator Dashboard Ticket | Same operator Dashboard Ticket |

Operator LIFF is **not** introduced. LIFF remains requester-only; operator
actions remain behind Dashboard authorization. The canonical route values come
from the application route SSOT, and public absolute URLs use the configured
public-origin helper. Existing login and return behavior is unchanged. The
proxy preserves the Ticket destination while refreshing an expired session;
when a user has no valid access or refresh session, it sends them to `/login`
without a `returnTo` value, so a fresh login may return to the Dashboard home
instead of the linked Ticket. IT12 does not change that authentication flow.

`IT_TICKET_IN_APP`, `IT_TICKET_EMAIL`, and eligible `IT_TICKET_LINE` intents are
persisted in the Ticket business transaction. Their deterministic event keys
share the source fact, Ticket, and recipient, with distinct `:in-app`, `:email`,
and `:line` suffixes. Replays reuse the same identities and do not duplicate
intents. The shared processor owns retry/backoff/dead-letter/supersede lifecycle;
IT owns event meaning, recipient resolution, applicability, content, and
destination.

All three channels use the same source-fact and applicability checks. `ASSIGNED`
is suppressed when its assignment generation is no longer current. An assignee
comment is suppressed after reassignment; a queue comment is suppressed once
the Ticket is assigned. `WAITING_REQUESTER` is sent only for its current status
generation. Requester/operator eligibility and source-actor exclusion are also
rechecked at dispatch. `RESOLVED` remains an occurred business fact and is not
discarded solely because a later Ticket status changed.

Ticket Email resolves the current active account email from `User`; missing or
invalid email supersedes only that Email row. Ticket Email and LINE contain the
Ticket number, event wording, and destination only. They do not copy Ticket
descriptions, comment bodies, attachment content or storage keys, or grant data.
Requester LINE continues to use the canonical requester LIFF builder. Operator
LINE uses the canonical Dashboard Ticket route and the shared personal NHFapp
delivery path via `LineAccountLink`.

### Email Request channel completion

Email Request now resolves one audience from configured
`email.request.read / ALL` authority through
`findActiveUsersWithConfiguredCapabilityScope(...)`. The same configured
recipient set receives the existing Inbox entry and one Email and personal LINE
child intent per user. An ADMIN role, Department, hardcoded list,
`EMAIL_REQUEST_INAPP_RECIPIENT_EMAILS`, or `LINE_IT_TEAM_USER_ID` does not add
recipients.

The `EMAIL_REQUEST` parent validates its stored event and transactionally fans
out idempotent Inbox rows plus `EMAIL_REQUEST_EMAIL` and `EMAIL_REQUEST_LINE`
children. Each child has one recipient and an independent retry lifecycle.
Email goes to the recipient's current account `User.email`, never the requester's
`replyEmail`. Personal LINE resolves by application `userId` and
`LineAccountLink`; no requester acknowledgement is added. Child payloads contain
stable identifiers only.

The Email Request team-user/direct-push and broadcast fallback is retired from
current runtime delivery. `LINE_IT_TEAM_USER_ID` has no current consumer.
`LINE_IT_CHANNEL_SECRET` remains for the inbound webhook, while IT Ticket and
Email Request personal LINE use the NHFapp application channel.

SMTP and LINE delivery remain at-least-once. Deterministic SMTP `Message-ID` and
LINE retry keys aid correlation and bounded duplicate suppression; neither
guarantees permanent exactly-once delivery.

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

Leave approval assignment มี generation แบบ persisted ที่ `LeaveRequest.approvalActionVersion`
โดยคำขอใหม่เริ่มที่ `1` และ identity ที่ production producer สร้างมีรูปแบบ
`leaveId:approverUserId:generation:approvalActionVersion` เช่น
`leave-123:42:generation:3` ค่า version นี้เปลี่ยนเฉพาะเมื่อ effective approver
เปลี่ยนเป็น assignment ใหม่ และเปลี่ยนพร้อมกับการเขียน approver state ภายใต้
`LeaveRequest` row lock เดียวกัน การ retry หรือการเขียน assignment ซ้ำที่ยังมี effective
approver เดิมจึงไม่เพิ่ม version

กรณี `A → B → A` จะเป็น version `1 → 2 → 3` ทำให้ notification ของ A รอบแรกและรอบที่สอง
มี `deliveryIdentity`, `eventKey` และ LINE retry key คนละค่า แม้ recipient จะเป็น User เดิม
อีกครั้ง ส่วนการเปลี่ยนผู้อนุมัติของคำขอ `PENDING` ตาม policy เดิมยังใช้
cancel-before-reassign และคำขอใหม่จะเริ่ม generation ของตัวเอง

ระหว่าง migration จะไม่ลบ outbox ที่ค้างอยู่ payload เก่าที่ไม่มี generation identity จะยอมรับ
เป็น generation `1` เฉพาะเมื่อ Leave ปัจจุบันยัง `PENDING`, ไม่มี exception approver และ
recipient ตรงกับ effective approver ปัจจุบันเท่านั้น หาก state หรือ recipient ไม่ตรง
จะ mark เป็น `SUPERSEDED` เพื่อไม่ส่ง notification ที่คลุมเครือ

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
  `sendStockLineBroadcast()` และ `LINE_STOCK_CHANNEL_ACCESS_TOKEN` ตามเดิม; เฉพาะ
  Outbox dispatch จะส่ง retry key ที่ derive จาก `NotificationOutbox.id` เพื่อให้
  retry ของ row เดิมใช้ provider identity เดิม โดยไม่สร้าง eventKey contract ใหม่

ห้ามนำ `LINE_APP_CHANNEL_ACCESS_TOKEN` ไปแทน legacy Stock token ใน operational broadcast
และห้ามลบ `LINE_STOCK_CHANNEL_ACCESS_TOKEN` ใน phase นี้

## Failure, retry และ idempotency

- Outbox parent กับ personal LINE child เป็นคนละ row และประมวลผลแยกกัน ดังนั้น LINE failure
  จะไม่ทำให้ Email ถูกส่งซ้ำเพียงเพราะ LINE retry
- Child row ใช้ deterministic `eventKey` และ `createLineRetryKey(eventKey)`; unique
  `eventKey` ทำให้ enqueue ซ้ำจาก parent retry ไม่สร้าง child ซ้ำ
- `sendLineAppMessage()` ส่ง `X-Line-Retry-Key`; provider duplicate acknowledgement (`409`)
  ที่มี retry key ถือว่าสำเร็จตาม implementation ปัจจุบัน
- Email Request parent สร้าง per-recipient `EMAIL_REQUEST_EMAIL` และ
  `EMAIL_REQUEST_LINE` child rows แบบ idempotent; Email กับ LINE retry แยกกัน
  และ historical parent ที่ไม่มี request ID ใช้ parent outbox ID เป็น fallback identity
- Stock operational broadcast ใช้ `outbox:<type>:<id>` เป็น retry identity โดยตรง
  เพราะสอง historical event types นี้ไม่มี eventKey contract ที่เชื่อถือได้
- LINE retry key ของ Messaging API มี retention window 24 ชั่วโมงเท่านั้น การใช้ key
  เดิมหลัง window อาจถูก provider รับเป็นคำขอใหม่ จึงช่วยลด duplicate ในช่วง recovery
  แต่ไม่ใช่ deduplication ถาวร และไม่รับประกัน end-user delivery
- User/Employee ที่ inactive, deleted, ผูก link ไม่ได้ หรือไม่มี `LineAccountLink` เป็น
  business state ที่ valid: ไม่ throw จาก business action; ถ้ามี child row แล้วจะถูก
  `SUPERSEDED` เพื่อไม่ retry ถาวร (Routine อาจไม่สร้าง child ตั้งแต่ enqueue เมื่อยังไม่ link)
- ความล้มเหลวชั่วคราวของ LINE provider จะ throw จาก child processor เพื่อใช้ outbox retry
  เดิม สูงสุด 3 attempts ก่อน `DEAD`; Email และ In-app row ไม่ถูก duplicate จาก retry นี้
- Routine ยังคง stale validation และ `DEFERRED`/`SUPERSEDED` behavior เดิม
- SMTP ยังคง at-least-once: deterministic `Message-ID` เป็น correlation hint ไม่ใช่
  provider idempotency key; timeout หรือ connection failure หลัง server รับข้อความแล้ว
  ยังอาจทำให้ retry ส่งซ้ำได้

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
- `LINE_IT_CHANNEL_SECRET`: inbound `/api/line/webhook`; Email Request และ IT Ticket ใช้ NHFapp personal LINE
- `LINE_IT_CHANNEL_ACCESS_TOKEN`: retained low-level compatibility transport; ไม่มี current Email Request business producer

ลำดับ migration, LIFF configuration, account linking และ outbox production verification อยู่ใน [production runbook](../operations/production-deployment.md); ตรวจ provider logs โดยไม่เปิดเผย token หรือ ID token

## Future retirement criteria for Stock legacy LINE

การ retire legacy Stock LINE ต้องเป็น phase แยกและทำได้เมื่อมีครบอย่างน้อย:

1. มี recipient policy ที่ได้รับการอนุมัติสำหรับ processor/admin และ low-stock operations
2. operational recipients ทุกกลุ่มมี account linking และ fallback ที่ยืนยันแล้ว
3. มี production acceptance, delivery metrics และ retry/dead-letter monitoring ต่อกลุ่ม
4. มีแผน cutover/rollback ที่ไม่ทำให้ operational alert หาย
5. ยืนยันแล้วว่าไม่ต้องใช้ `LINE_STOCK_CHANNEL_ACCESS_TOKEN` กับ integration อื่น

Phase นี้ intentionally ไม่ migrate operational broadcast และไม่ retire legacy token

## Stock K1 implementation boundary

หลัง K1, Stock-specific subject/template และ Flex/message composition อยู่ใต้
`modules/stock/infrastructure/notifications/**` ส่วน `lib/email/**` และ
`lib/line/**` เหลือบทบาทเป็น generic transport/channel mechanics ตามเดิม

ความแตกต่างของ delivery context ต้องคงไว้เสมอ:

- `STOCK_REQUEST_RESULT_LINE` ใช้ LINE_APP และ `LineAccountLink` ผ่าน
  `sendAppLineNotification(...)`
- `STOCK_REQUEST_LINE` และ `STOCK_LOW_LINE` ใช้ operational Stock Messaging
  channel ผ่าน `LINE_STOCK_CHANNEL_ACCESS_TOKEN` และ
  `sendStockLineBroadcast(...)`
