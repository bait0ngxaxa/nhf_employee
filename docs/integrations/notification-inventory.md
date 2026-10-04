# Current notification inventory

Content audit of active producers and dispatchers (2026-10-04). This inventory
records existing channel coverage, including notifications outside template
folders. It does not introduce recipients, events or channels. Content conventions
are authoritative in [notifications.md](./notifications.md#notification-content-contract).

I = In-app, E = Email, L = personal NHFapp LINE, B = legacy Stock operational LINE.

| Domain / event | Existing audience | Channels | Canonical title / meaning | CTA and unchanged destination |
| --- | --- | --- | --- | --- |
| IT CREATED | eligible operator queue, excluding source actor | I/E/L | มี Ticket IT ใหม่ | เปิด Ticket; Dashboard queue detail |
| IT ASSIGNED | eligible current assignee, excluding source actor | I/E/L | คุณได้รับมอบหมาย Ticket IT | เปิด Ticket; Dashboard queue detail |
| IT OPERATOR_COMMENTED | current requester, excluding source actor | I/E/L | IT ตอบกลับ Ticket ของคุณ | เปิด Ticket; Dashboard requester detail, LINE requester LIFF |
| IT REQUESTER_COMMENTED | current assignee or unassigned queue, excluding source actor | I/E/L | ผู้ขอส่งข้อความใหม่ใน Ticket IT | เปิด Ticket; Dashboard queue detail |
| IT WAITING_REQUESTER | current requester, excluding source actor | I/E/L | Ticket IT รอข้อมูลเพิ่มเติมจากคุณ | เปิด Ticket; Dashboard requester detail, LINE requester LIFF |
| IT RESOLVED | current requester, excluding source actor | I/E/L | Ticket IT ได้รับการแก้ไขแล้ว | เปิด Ticket; Dashboard requester detail, LINE requester LIFF |
| Email Request created | configured active email.request.read / ALL | I/E/L | มีคำขออีเมลพนักงานใหม่; Inbox context describes the requested employee | ตรวจสอบคำขอ; Dashboard Email Request |
| Email Request access updated | same configured audience | I/E/L | มีการอัปเดตสิทธิ์พนักงานใหม่; reference only, no access dump | ตรวจสอบคำขอ; Dashboard Email Request |
| Leave action required | current approver | I/E/L | มีคำขอลาใหม่รออนุมัติ | ตรวจสอบคำขอ; Dashboard approval, LINE LIFF action=approve |
| Leave approved | employee/request owner | I/E/L | คำขอลาได้รับการอนุมัติ | เปิดรายละเอียด; Dashboard history, LINE LIFF request |
| Leave rejected | employee/request owner | I/E/L | คำขอลาไม่ได้รับการอนุมัติ | เปิดรายละเอียด; Dashboard history, LINE LIFF request |
| Leave pending cancelled | approver; separate owner acknowledgement | I/E/L to approver; I to owner | คำขอลาถูกยกเลิก | เปิดรายละเอียด; Dashboard approval/history by audience, LINE action=review |
| Leave cancellation requested after approval | current approver; separate owner acknowledgement | I/E/L to approver; I to owner | มีคำขอยกเลิกวันลารอยืนยัน; owner: ส่งคำขอยกเลิกวันลาแล้ว | ตรวจสอบคำขอ; Dashboard approval/history by audience, LINE action=review |
| Leave cancellation rejected | employee/request owner | I | คำขอยกเลิกวันลาไม่ได้รับการอนุมัติ; original approved leave remains effective | Dashboard history |
| Leave cancellation confirmed | employee/request owner | I/E/L | ยืนยันการยกเลิกวันลาแล้ว | เปิดรายละเอียด; Dashboard history, LINE LIFF request |
| Leave not-taken requested | current approver; separate owner acknowledgement | I/E/L to approver; I to owner | มีรายการแจ้งไม่ได้ใช้วันลารอยืนยัน; owner: แจ้งไม่ได้ใช้วันลาแล้ว | ตรวจสอบคำขอ; Dashboard approval/history by audience, LINE action=not-taken |
| Leave not-taken confirmed | employee/request owner | I/E/L | ยืนยันไม่ได้ใช้วันลาแล้ว | เปิดรายละเอียด; Dashboard history, LINE LIFF request |
| Routine reminder | existing validated assignee/scoped/linked recipients | I/E/L | งานใกล้ถึงกำหนด; timing detail distinguishes today/days remaining | เปิดดูงาน; existing Dashboard task/occurrence URL, personal LINE Routine LIFF |
| Routine contract expiry | existing active contract-reminder recipients | I/E/L | สัญญาใกล้สิ้นสุด | เปิดดูงาน; existing Dashboard task URL, personal LINE Routine LIFF |
| Stock new request | configured stock.request.process / ALL for Inbox; existing operational channel audience for broadcast | I/B | มีคำขอเบิกวัสดุใหม่ | ตรวจสอบคำขอ; Dashboard admin requests |
| Stock issued result | requester | I/E/L | คำขอเบิกวัสดุถูกจ่ายแล้ว | เปิดรายละเอียด; Dashboard my requests, personal LINE Stock LIFF |
| Stock cancellation result | requester | I/E/L | คำขอเบิกวัสดุถูกยกเลิก | เปิดรายละเอียด; Dashboard my requests, personal LINE Stock LIFF |
| Stock cancelled by requester | configured stock.request.process / ALL | I | ผู้ขอยกเลิกคำขอเบิกวัสดุ | Dashboard admin requests |
| Stock low stock | configured stock.inventory.manage / ALL for Inbox; existing operational channel audience for broadcast | I/B | วัสดุถึงจุดแจ้งเตือนสต็อกต่ำ | เปิดคลังวัสดุ; Dashboard inventory |
| Account password reset | existing validated recovery account | E | คำขอรีเซ็ตรหัสผ่าน | ตั้งรหัสผ่านใหม่; existing reset URL/token |

## Content and implementation references

For every Email row, subjects use `[NHFapp][Module] <event>` and sender identities
use the canonical module family. LINE previews use `<label>: <event>` with a short
reference where useful. Inbox bodies carry context instead of repeating titles.

| Family | Content / rendering owner | Producer and dispatcher | Relevant verification |
| --- | --- | --- | --- |
| IT Ticket | modules/it/domain/ticket-notification-content.ts; infrastructure/notifications/ticket-email.ts, email-template.ts, line-flex.ts | application/ticket-commands.ts, ticket-comment-commands.ts; infrastructure/notifications/outbox.ts; application/notifications/dispatch.ts | ticket-email.test.ts, line-flex.test.ts, email-dispatch.test.ts, line-dispatch.test.ts; ticket-notifications.integration.test.ts |
| Email Request | domain/email-request/notification-content.ts; infrastructure/notifications/email-request-email.ts, email-request-flex.ts | application/email-request/commands.ts, notifications.ts, dispatch.ts; infrastructure/persistence/email-request-repository.ts, email-request-access-repository.ts | notifications.test.ts, email-request-email.test.ts, email-request-line.test.ts, dispatch tests |
| Leave | domain/notification-content.ts, application/notifications/notifications.ts; infrastructure/notifications/email.ts, email-templates/**, line-flex.ts | approval/cancellation/not-taken application commands; action dispatch; infrastructure/notifications/line.ts | notifications.test.ts, email.test.ts, email-templates.test.ts, line-flex.test.ts, line.test.ts; cancellation/not-taken/API tests |
| Routine | application/notifications/*email.ts, *flex.ts | application/reminders.ts, contract-reminders.ts | notifications/email.test.ts, routine-reminder-flex.test.ts; reminders.test.ts, contract-reminders.test.ts |
| Stock | infrastructure/notifications/email.ts, email-template/stock-request-result.ts, line-messages/**, notifications.ts | application request/item mutations; infrastructure/notifications/outbox.ts and line-notifications.ts | notification-content.test.ts, email.test.ts, email-template-xss.test.ts, notifications.test.ts, stock-low-flex.test.ts, line-notifications.test.ts, mutations.test.ts; global processor tests |
| Account | lib/email/templates/password-reset.ts; lib/auth/ssot.ts | app/api/auth/forgot-password/route.ts | forgot-password-route.test.ts, email-templates-xss.test.ts; generic notification-presentation.test.ts |

Paths in each module row are relative to that module unless the row states a full
path. Shared presentation is `shared/notifications/presentation.ts`,
`lib/email/templates/notification.ts`, and `lib/line/notification-flex.ts`.

## Intentional differences

- Stock new requests and low-stock alerts have no Email or personal LINE producer;
  operational broadcasts keep their original audience/channel.
- Owner acknowledgements and cancellation rejection in Leave are Inbox-only.
- Email Request creation Inbox retains its existing employee context, while Email
  and LINE keep only a request reference; no additional PII is exported.
- Dashboard versus LIFF, approval action parameters, validated audiences, stale
  suppression, persisted identities and transport semantics are unchanged.
- Generic transport defaults/configuration and inactive compatibility exports are
  not business notification templates. No live Email/LINE provider or client-device
  rendering acceptance is implied by automated tests.
