# Production Deployment & LIFF Runbook

**สถานะ: CURRENT / CANONICAL** — เอกสารหลักเพียงฉบับเดียวสำหรับการ deploy production และเปิดใช้ Unified LIFF/Rich Menu; [ผลตรวจรับ production ปัจจุบัน](./production-acceptance.md) บันทึกแยกตาม release

เอกสารนี้ใช้สำหรับเตรียม ตรวจรับ deploy และเปิดใช้งาน NHFapp ใน production รวมทั้ง LINE/LIFF

หลักการสำคัญ:

- application deployment กับ Rich Menu activation เป็นคนละ launch control
- Rich Menu ใหม่ต้องเป็นขั้นตอนสุดท้าย หลังตรวจระบบบน smartphone ครบแล้ว
- `npm run line:richmenu:provision -- --apply` และ `npm run line:richmenu:set-default -- --apply` เป็นคำสั่งที่เปลี่ยน production state ผู้ปฏิบัติงานที่ได้รับอนุญาตเป็นผู้รันเองเท่านั้น
- เอกสาร acceptance ที่ใช้บันทึกผลจริงอยู่ที่ [LIFF Production Acceptance](./production-acceptance.md)

## 1. Architecture

```text
LINE Provider
│
├── LINE Login Channel
│   └── LIFF App
│       └── NEXT_PUBLIC_LINE_LIFF_ID
│
└── NHFapp Messaging API Channel
    └── NHF Official Account
        └── LINE_APP_CHANNEL_ACCESS_TOKEN

Unified Rich Menu
        ↓
https://liff.line.me/<LIFF_ID>/...
        ↓
LIFF Endpoint URL: https://<production-domain>/liff
        ↓
LiffBootstrap
        ↓
LINE identity / account-link decision
        ↓
NHFapp HttpOnly LIFF session
        ↓
Shared LIFF Shell
        ↓
Stock | Leave | Routine | IT
```

Application identity flow:

```text
LIFF
    → LINE Login identity / ID token `sub`
    → LineAccountLink.lineUserId
    → NHFapp HttpOnly LIFF session
```

Personal targeted notification flow:

```text
Leave / Routine / Stock-result notification
    → application User
    → LineAccountLink.lineUserId
    → LINE_APP_CHANNEL_ACCESS_TOKEN
    → targeted LINE push
```

LINE user IDs are provider-scoped. The LINE Login Channel containing the LIFF
app and the NHFapp Messaging API Channel represented by
`LINE_APP_CHANNEL_ACCESS_TOKEN` **MUST belong to the same LINE Provider**.
This is a human LINE Developers Console requirement; the application does not
try to derive Provider identity from a token.

### บทบาทของแต่ละส่วน

| ส่วน | บทบาทใน production |
| --- | --- |
| LINE Provider | ต้องเป็นเจ้าของทั้ง LINE Login Channel ที่มี LIFF และ NHFapp Messaging API Channel ที่ใช้ `LINE_APP_CHANNEL_ACCESS_TOKEN` |
| NHF Official Account | OA ที่ผู้ใช้เพิ่มเป็นเพื่อน และ associated กับ NHFapp Messaging API Channel; Rich Menu และ personal Leave/Routine/Stock-result/IT Ticket/Email Request push ส่งผ่าน channel นี้ |
| LINE Login Channel | ตรวจสอบ LIFF identity และใช้สร้าง LIFF application; `LINE_LOGIN_CHANNEL_ID` ต้องเป็น channel เดียวกับ LIFF app และอยู่ใต้ Provider เดียวกับ NHFapp Messaging API Channel |
| NHFapp Messaging API Channel | ใช้ `LINE_APP_CHANNEL_ACCESS_TOKEN` สำหรับ Unified Rich Menu และ personal Leave/Routine/Stock-result/IT Ticket/Email Request push; IT ใช้ผู้รับตาม capability ที่ตั้งค่าไว้ |
| Existing Stock Messaging integration | ใช้ `LINE_STOCK_CHANNEL_ACCESS_TOKEN` สำหรับ Stock request และ low-stock LINE broadcast ตาม integration เดิม |
| Existing IT compatibility transport | `LINE_IT_CHANNEL_ACCESS_TOKEN` remains a low-level compatibility setting; current Email Request and IT Ticket LINE use NHFapp personal delivery |
| LIFF | จุดเข้าใช้งานจาก LINE และส่ง ID token ระยะสั้นให้ server ตรวจสอบ identity |
| `LiffBootstrap` | เรียก `liff.init`, ตรวจ LINE login, สร้าง/กู้ NHFapp session และนำผู้ใช้ไป account-link เมื่อยังไม่ link |
| NHFapp HttpOnly LIFF session | cookie `nhf_liff_session` ที่ server เซ็นและตรวจอายุ ใช้ยืนยัน workforce session ของ NHFapp |
| account linking | ผูก LINE user ID กับ NHFapp user ที่ login ไว้; conflict ต้อง fail และห้ามเขียนทับ link เดิม |
| feature flags | ควบคุม Leave และ Routine จาก `NEXT_PUBLIC_*`; ค่าถูกฝังตอน build |
| Routine scheduler | สร้าง occurrence และ enqueue reminder work ลง notification outbox; ไม่ได้ส่งข้อความเอง |
| Notification outbox | claim/process งานค้างและ dispatch event ตาม channel ที่กำหนด: Routine in-app/email/LINE, Stock personal LINE + legacy LINE, IT Ticket Inbox/Email/personal LINE, Email Request parent fan-out ไป Inbox และ per-recipient Email/personal LINE ตาม configured capability, และ Leave in-app/email/personal LINE |

ID token เป็น identity assertion ที่อายุสั้น ใช้ตรวจสอบกับ LINE แล้วไม่ใช่ NHF session ระยะยาว ห้ามบันทึก ID token, cookie หรือ Authorization header ลง log

### Live LIFF modules

| Module | Route | พฤติกรรม production |
| --- | --- | --- |
| Home | `/liff` | แสดง workforce identity และสถานะ Stock, Leave, Routine, IT ตาม capability projection |
| Stock | `/liff/stock` | catalog, search/filter, variants, cart, availability reconciliation, submit request, My Requests, detail, cancellation และ processor flow ตามสิทธิ์ |
| Leave | `/liff/leave` | quota, create, validation, attachment, history, detail, cancellation, not-taken และ approver flow ตาม flag/สิทธิ์ |
| Routine | `/liff/routine` | summary, timing filters, pagination, detail, own-task create/edit/delete, occurrence reads, version conflict และ reminder deep link ตาม flag/สิทธิ์ |
| IT requester | `/liff/it`, `/liff/it/[ticketId]` | แจ้งปัญหา สร้าง/ติดตาม Ticket และสนทนาใน Ticket ตาม requester capability; ไม่มี operator navigation |

ทุก route ใช้ shared shell และ bootstrap/session boundary เดียวกัน:

```text
/liff
/liff/stock
/liff/leave
/liff/routine
```

## 2. Production environment variables

ใช้ `.env.example` เป็นรายการตั้งต้น ห้ามคัดลอกค่า secret ตัวอย่างไป production และห้ามใส่ค่า secret ใน `NEXT_PUBLIC_*`

### 2.1 Unified LIFF และ application baseline

| Variable | ใช้ทำอะไร | เจ้าของ/แหล่งค่าเชิงปฏิบัติการ |
| --- | --- | --- |
| `NEXT_PUBLIC_LINE_LIFF_ID` | LIFF ID ที่ client ใช้ `liff.init` และใช้สร้าง Rich Menu URL | LINE Login Console; เป็น identifier ที่เปิดเผยได้และต้องตั้งก่อน build |
| `LINE_LOGIN_CHANNEL_ID` | channel ID ที่ server ส่งให้ LINE ID-token verification ตรวจ `aud` | LINE Login Channel ใน LINE Developers Console |
| `LINE_APP_CHANNEL_ACCESS_TOKEN` | token ของ NHFapp Messaging API Channel สำหรับ Unified Rich Menu, targeted Leave/Routine/Stock push, IT Ticket events ทั้งหกเหตุการณ์ที่อนุมัติ และ Email Request personal LINE สำหรับผู้มี `email.request.read / ALL`; ไม่ได้กำหนด Stock legacy channel | secret manager / NHFapp Messaging API Channel ของ NHF Official Account |
| `LINE_APP_CHANNEL_SECRET` | channel secret ของ NHFapp Messaging API Channel | LINE Developers Console; เก็บใน secret manager |
| `LINE_LIFF_SESSION_SECRET` | secret สำหรับเซ็น NHFapp HttpOnly LIFF session | secret manager; production ต้องยาวอย่างน้อย 32 ตัวอักษรและต้องสุ่ม |
| `LINE_LIFF_SESSION_TTL_SECONDS` | อายุ LIFF session | deployment configuration; integer `1` ถึง `86400` |
| `NEXT_PUBLIC_FEATURE_LEAVE` | เปิด/ปิด Leave | release configuration ก่อน build; `true` เพื่อเปิด |
| `NEXT_PUBLIC_FEATURE_ROUTINE` | เปิด/ปิด Routine | release configuration ก่อน build; `true` เพื่อเปิด |
| `DATABASE_URL` | MySQL/Prisma สำหรับ user, link, Stock, Leave, Routine และ outbox | database secret/configuration |
| `AUTH_ACCESS_TOKEN_SECRET` | secret ของ normal NHFapp authentication/dashboard | secret manager; ไม่ใช้ร่วมกับ LIFF session secret |
| `PUBLIC_APPROVE_URL` | public HTTPS origin สำหรับ dashboard/approval และ notification links ที่ไม่ใช่ LIFF | deployment configuration; ห้ามเป็น localhost ใน production |

ตัวอย่างชื่อ variable เท่านั้น:

```env
NEXT_PUBLIC_LINE_LIFF_ID=
LINE_LOGIN_CHANNEL_ID=
LINE_APP_CHANNEL_ACCESS_TOKEN=
LINE_APP_CHANNEL_SECRET=
LINE_LIFF_SESSION_SECRET=
LINE_LIFF_SESSION_TTL_SECONDS=3600
NEXT_PUBLIC_FEATURE_LEAVE=false
NEXT_PUBLIC_FEATURE_ROUTINE=false
```

ห้ามเติมค่าจริงในเอกสารนี้ และห้ามส่ง token, secret, ID token หรือ cookie เข้า log

### 2.2 LIFF session และ feature semantics

- หากไม่ตั้ง `LINE_LIFF_SESSION_TTL_SECONDS` implementation ใช้ default `3600` วินาที (1 ชั่วโมง)
- ค่าที่ตั้งต้องเป็น integer มากกว่า `0` และไม่เกิน `86400` วินาที (24 ชั่วโมง)
- production ที่ตั้ง `LINE_LIFF_SESSION_SECRET` สั้นกว่า 32 ตัวอักษรจะไม่ผ่าน configuration validation
- session หมดอายุแล้ว read request กู้ session และ replay ได้หนึ่งครั้ง; mutation ไม่ replay อัตโนมัติ
- ใน production หากไม่ตั้ง Leave/Routine flag จะได้ disabled เพราะ fallback ไม่เปิด feature เมื่อ `NODE_ENV=production`
- `NEXT_PUBLIC_*` ถูกฝังใน client bundle ต้องตั้งก่อน `npm run build` และ rebuild เมื่อเปลี่ยนค่า

| Module | Source of truth | เมื่อปิด |
| --- | --- | --- |
| Stock | ไม่มี Stock feature flag ใน implementation ปัจจุบัน | ยัง available ตามสิทธิ์ปกติ |
| Leave | `NEXT_PUBLIC_FEATURE_LEAVE` | Home, direct route และ Leave API สอดคล้องกันว่า unavailable/ปฏิเสธ |
| Routine | `NEXT_PUBLIC_FEATURE_ROUTINE` | Home, direct route และ Routine API unavailable; scheduler ตอบ successful no-op |

### 2.3 Email, storage และ maintenance

| Variable/asset | ใช้เมื่อ |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Routine reminder/contract expiry, Leave notification email และ notification email เดิม; Routine/Leave email acceptance ต้องตั้งครบ |
| `.uploads/` | รูป Stock และ private leave attachments; ต้องอยู่บน persistent disk |
| `LEAVE_ATTACHMENT_CLEANUP_SECRET` | เปิด scheduled orphan cleanup ของ private leave attachments |
| `AUTH_CLEANUP_SECRET`, `AUDIT_LOG_CLEANUP_SECRET` | เปิด maintenance endpoint ของ auth/audit ตาม deployment policy |

รายละเอียด permission, backup, restore, reverse proxy และ cleanup ของ leave attachment อยู่ใน [Storage and attachment operations](./storage-and-attachments.md)

### Existing notification integrations

ห้ามนำ `LINE_APP_CHANNEL_ACCESS_TOKEN` ไปแทน token ของ integration เดิมโดยอัตโนมัติ แต่ละ channel เป็น configuration แยกกัน:

| Integration | Variables | Current responsibility |
| --- | --- | --- |
| Existing Stock Messaging integration | `LINE_STOCK_CHANNEL_ACCESS_TOKEN`, `LINE_STOCK_CHANNEL_SECRET` | Stock request LINE broadcast และ low-stock LINE broadcast |
| Existing IT compatibility/webhook | `LINE_IT_CHANNEL_ACCESS_TOKEN`, `LINE_IT_CHANNEL_SECRET` | Legacy low-level transport compatibility and inbound webhook signature verification; Email Request no longer uses team-user or broadcast delivery |
| Retained legacy outbound webhook compatibility | `LINE_WEBHOOK_URL` | optional external compatibility integration; แยกจาก inbound `/api/line/webhook`, ไม่ใช่ LIFF endpoint และไม่ใช่ `LINE_APP` token; live external usage ต้องยืนยันก่อนถอดออก |

Email Request and IT Ticket now use the Unified NHFapp Messaging API for personal
LINE. Legacy `LINE_IT_TEAM_USER_ID`/broadcast delivery is retired for Email Request;
the variable has no current runtime consumer. `LINE_IT_CHANNEL_SECRET` remains
used by the inbound `/api/line/webhook` signature check. The generic low-level
`LINE_IT_CHANNEL_ACCESS_TOKEN` sender exports remain compatibility code, with no
current Email Request producer.

```text
EMAIL_REQUEST parent outbox
    → configured `email.request.read / ALL` audience
    → per-recipient EMAIL_REQUEST_EMAIL / EMAIL_REQUEST_LINE child rows
    → SMTP or sendAppLineNotification({ userId, ... }) independently
    → account email or LineAccountLink
    → canonical Email Request Dashboard route

IT_TICKET_IN_APP + IT_TICKET_EMAIL + eligible IT_TICKET_LINE
    → transactionally persisted with Ticket business fact
    → shared Inbox / SMTP / sendAppLineNotification({ userId, ... })
    → requester Dashboard / requester LIFF, or operator Dashboard Ticket
```

IT12 Ticket LINE covers all six approved events. Requester destinations continue
to use `/liff/it/<ticketId>` through the existing LIFF URL builder. Operator
destinations use the canonical `/dashboard/it/queue/<ticketId>` Dashboard Ticket
route already used by the operator queue UI. Operator LIFF is not introduced;
LIFF remains requester-only. Existing login and authenticated return behavior is
unchanged. Email and LINE include a short event message, Ticket number, and CTA;
they omit Ticket descriptions, comment bodies, attachment content/storage keys,
and authorization grant details. Ticket recipient and stale-event policies remain
unchanged.
Leave notification ใช้ **in-app และ email** ผ่าน Leave notification/outbox workflow เดิม และเพิ่ม targeted personal LINE ผ่าน NHFapp OA สำหรับ workflow events ตาม [Notification Channel Architecture](../integrations/notifications.md) โดยไม่เปลี่ยน recipient semantics หรือ authorization ของ Leave

`BOOTSTRAP_ADMIN_EMAILS` ใช้ตอน seed/bootstrap เท่านั้น ส่วน `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` ใช้เมื่อ deployment เลือก Docker Compose MySQL

`APP_BASE_URL` ในตัวอย่าง cron เป็น variable ของ external cron runner ไม่ใช่ variable ที่ application อ่านเพื่อสร้าง LIFF URL ให้ตั้งเป็น public HTTPS origin เดียวกับระบบ โดยไม่ใส่ secret

## 3. LINE Developers Console checklist

### Provider และ channel architecture

- [ ] LINE Login Channel ที่มี LIFF และ NHFapp Messaging API Channel ที่ใช้ `LINE_APP_CHANNEL_ACCESS_TOKEN` อยู่ใต้ **LINE Provider เดียวกัน** — หากต่าง Provider ให้ `NO-GO`
- [ ] บันทึก Provider display name/identifier (ถ้า console แสดง), `LINE_LOGIN_CHANNEL_ID` และ NHFapp Messaging API Channel ID เป็น safe evidence เท่านั้น
- [ ] LIFF application อยู่บน LINE Login Channel เดียวกับ `LINE_LOGIN_CHANNEL_ID`
- [ ] NHFapp Messaging API Channel เป็น channel ของ OA ที่ผู้ใช้จะเพิ่มเป็นเพื่อนและเป็น OA ที่ส่ง Unified Rich Menu/personal Leave-Routine-Stock-result push
- [ ] ห้ามพยายาม derive หรือยืนยัน Provider identity จาก channel access token ใน application/operator script; ตรวจใน LINE Developers Console โดย human operator

### LINE Login / LIFF application

- [ ] Production Channel ID ตรงกับ `LINE_LOGIN_CHANNEL_ID`
- [ ] มี LIFF application production และ LIFF ID ตรงกับ `NEXT_PUBLIC_LINE_LIFF_ID`
- [ ] ตั้ง scope `openid` เพราะ code ใช้ `liff.getIDToken()` และ server ตรวจ ID token
- [ ] ไม่เพิ่ม `profile`/`email` scope ที่ code ไม่ได้ใช้โดยไม่มีการอนุมัติเปลี่ยน integration
- [ ] LIFF Endpoint URL เป็น base application endpoint แบบ HTTPS:

  ```text
  https://<production-domain>/liff
  ```

- [ ] production domain, HTTPS certificate และ reverse proxy ใช้งานได้
- [ ] LIFF app เปิดให้กลุ่มผู้ใช้ที่ตั้งใจให้ใช้งานได้
- [ ] staging/production ใช้ LIFF ID, endpoint และ token คนละชุดอย่างชัดเจน

LIFF Endpoint URL คือ `/liff` ไม่ใช่ module route ส่วน Rich Menu action ใช้ URL ที่ผ่าน builder เดิม:

```text
https://liff.line.me/<LIFF_ID>/stock
https://liff.line.me/<LIFF_ID>/leave
https://liff.line.me/<LIFF_ID>/routine
```

## 4. Messaging API และ Official Account checklist

- [ ] `LINE_APP_CHANNEL_ACCESS_TOKEN` เป็น token ของ NHFapp Messaging API Channel ที่ผูกกับ NHF Official Account ถูกตัว
- [ ] `LINE_APP_CHANNEL_SECRET` เป็น channel secret ของ NHFapp Messaging API Channel เดียวกัน
- [ ] token มีสิทธิ์สำหรับ Unified Rich Menu และ personal Leave/Routine/Stock-result/IT requester Ticket push
- [ ] OA ตรงกับ token คือ OA ที่ test identities เพิ่มเป็นเพื่อน
- [ ] ยืนยันด้วย human console check ว่า LINE Login Channel และ NHFapp Messaging API Channel อยู่ใต้ LINE Provider เดียวกัน
- [ ] ไม่มี token/channel secret ใน `NEXT_PUBLIC_*`, source control, shell transcript, application log หรือ monitoring payload
- [ ] หลัง scheduler/outbox พร้อม ทดสอบ Routine LINE push ด้วย linked test user และตรวจ deep link

### Existing notification integrations checklist

- [ ] หาก Stock LINE notifications ยังเปิดใช้ ให้ตรวจ `LINE_STOCK_CHANNEL_ACCESS_TOKEN`/`LINE_STOCK_CHANNEL_SECRET` และทดสอบ Stock request/low-stock broadcast แยกจาก `LINE_APP`
- [ ] สำหรับ Email Request / IT Ticket personal LINE ให้ตรวจ `LINE_APP_CHANNEL_ACCESS_TOKEN`, configured capability recipients และ `LineAccountLink`; `LINE_IT_TEAM_USER_ID`/broadcast ไม่ใช่ current delivery path
- [ ] Leave acceptance ตรวจ **in-app, email และ personal LINE** ตาม workflow ปัจจุบัน; ยืนยันว่า unlinked user ยังไม่กระทบช่องทางเดิม และ LIFF action ให้ server ตรวจ authorization อีกครั้ง
- [ ] หากใช้ `/api/line/webhook` ให้ตั้ง secrets ของ webhook integration ตาม code ปัจจุบัน (`LINE_IT_CHANNEL_SECRET`/`LINE_STOCK_CHANNEL_SECRET`)

## 5. Unified Rich Menu source of truth

ใช้ source เดียวเท่านั้น:

```text
assets/line/nhf-rich-menu.png
lib/line/rich-menu.ts
scripts/line-rich-menu.ts
```

สำหรับ production Unified LIFF ให้ใช้ package commands ใน section นี้เท่านั้น ไม่ใช้ helper/เอกสาร Rich Menu แบบ Routine-only ที่เป็น historical artifact

เมนู Unified มี layout คงที่:

```text
Stock | Leave | Routine | IT
```

แบ่งเป็นสี่พื้นที่แนวนอนเท่ากัน ขนาดละ `625×843` pixels ที่ x=`0`, `625`, `1250`, `1875`; พื้นที่ IT เปิด requester root `/liff/it` ผ่าน LIFF URL มาตรฐาน. ต้องคง validation: PNG/JPEG ที่อ่านได้, asset ปัจจุบันเป็น PNG, `2500×843` pixels, ไม่เกิน `1,000,000` bytes, tappable areas อยู่ใน bounds และไม่ทับกัน และทุก action เป็น `https://liff.line.me/<LIFF_ID>/...`

### คำสั่ง

```bash
npm run line:richmenu:status
npm run line:richmenu:provision
npm run line:richmenu:provision -- --apply
```

| คำสั่ง | ความหมาย |
| --- | --- |
| `status` | อ่าน configuration และ current Messaging API default เมื่อ token พร้อม; ไม่เปลี่ยน LINE state |
| `provision` | validate config, URL, feature state และ asset แบบ dry-run; ไม่เรียก LINE mutation API |
| `provision -- --apply` | validate → create → upload → set default → GET verify; เปลี่ยน production state |

`provision` อาจล้มด้วย missing local configuration ได้โดยไม่ใช่ product failure ต้องรันใน environment ที่ตั้งใจใช้งานและแก้ config ให้ครบ

### Rollback helper

คำสั่ง set default ใช้ target ที่ operator ระบุ และ dry-run เป็นค่าเริ่มต้น:

```bash
npm run line:richmenu:set-default -- --rich-menu-id=<previous-richMenuId>
npm run line:richmenu:set-default -- --rich-menu-id=<previous-richMenuId> --apply
```

รับประกันว่า validate รูปแบบ `richmenu-...`, พิมพ์ target ก่อน operation, ไม่มี `--apply` ไม่เรียก API, มี `--apply` POST แล้ว GET verify, ไม่ลบเมนูใด ๆ และไม่พิมพ์ channel access token ใน provider error

ก่อนเปิดเมนูใหม่ต้องบันทึก previous default ID, new ID, timestamp, operator และ deployment SHA ถ้า status เป็น `not-set`, `managed-elsewhere` หรือ `unavailable` ห้ามเดา rollback ID ให้ resolve กับ LINE/OA owner ก่อน

ห้ามลบเมนูเดิมจนพ้น acceptance/monitoring window

## 6. Database และ deployment readiness

Phase 5B มี forward-only migration สำหรับเพิ่ม enum ของ personal LINE child outbox
(`20260902090000_add_app_line_notification_outbox_types`) โดยไม่เพิ่ม column หรือแก้ข้อมูลเดิม

Production database rule:

```bash
npx prisma migrate deploy
```

ต้อง backup database ตาม deployment policy ก่อน migration ห้ามใช้ `prisma migrate dev`, `prisma db push` หรือ destructive manual SQL เป็นขั้นตอนปกติของ production rollback

Application rollback หลัง forward migration ต้องใช้ application version ที่รองรับ schema ปัจจุบัน หากมี attachment schema อยู่ ให้เก็บ schema และไฟล์ไว้ แล้ว deploy forward fix ที่ทดสอบแล้วแทนการ drop/ย้อน migration แบบฉุกละหุก

## 7. Routine scheduler และ notification outbox

### 7.1 Routine scheduler

Entry point:

```text
POST /api/cron/routine-scheduler
Header: x-routine-secret: <ROUTINE_SCHEDULER_SECRET>
Secret source: ROUTINE_SCHEDULER_CRON_SECRET
```

Contract ที่ operator ต้องตรวจ:

| เงื่อนไข | ผลที่คาดหวัง |
| --- | --- |
| secret ไม่ได้ตั้ง | HTTP `503` |
| header ไม่ตรง | HTTP `403` |
| Routine feature disabled | HTTP สำเร็จ, `success: true`, `featureEnabled: false`, counters เป็นศูนย์ และไม่สร้าง occurrence/reminder |
| secret ถูกต้อง + Routine enabled | scheduler executes; ถ้าไม่มี error จะ `success: true` |
| execution มี item error | HTTP `500`, `success: false` และมี counters เพื่อสืบสวน |

fields ที่ต้องอ่านจาก response/log:

```text
occurrencesCreated
remindersConsidered
outboxEnqueued
duplicatesSkipped
inactiveSkipped
noRecipientSkipped
errors
contractRemindersConsidered
contractOutboxEnqueued
contractDuplicatesSkipped
contractNoRecipientSkipped
```

`contract*` เป็น current contract-reminder counters ที่ต้องเก็บใน acceptance evidence เมื่อ response มีค่าเหล่านี้

Scheduler ทำหน้าที่สร้าง occurrence และ enqueue parent reminder work เท่านั้น ไม่ได้ส่ง email/LINE เอง

### 7.2 Notification outbox

Entry point:

```text
POST /api/cron/notification-outbox
Header: x-outbox-secret: <NOTIFICATION_OUTBOX_SECRET>
Secret source: NOTIFICATION_OUTBOX_CRON_SECRET
```

Contract:

| เงื่อนไข | ผลที่คาดหวัง |
| --- | --- |
| secret ไม่ได้ตั้ง | HTTP `503` |
| header ไม่ตรง | HTTP `403` |
| header ถูกต้อง | เรียก `processOutbox()` และคืน `success`, `processed`, `failed` |

ปัจจุบัน processor claim ได้สูงสุด 10 รายการต่อ invocation, retry สูงสุด 3 attempts และรายการที่ไม่สำเร็จตาม policy จะเข้าสถานะ `DEAD`

Flow ที่ต้องเข้าใจตรงกัน:

```text
Routine scheduler
    → สร้าง occurrence
    → enqueue parent reminder work

Notification outbox
    → claim parent work
    → สร้าง in-app notification
    → enqueue/process email child event เมื่อมี email ที่ถูกต้อง
    → enqueue/process LINE child event เมื่อมี LineAccountLink
```

ทั้งสอง job ต้องมี owner/configuration แยกกัน แม้จะเรียกใน schedule เดียวกันได้

### 7.3 Cron ownership และความถี่

- application ไม่มี in-process cron; external scheduler เป็น owner ของ HTTP invocation
- production ต้องมี owner เดียวต่อ job อย่าตั้ง scheduler หลายตัวให้เรียก endpoint เดียวกันโดยไม่ตั้งใจ
- repository ไม่ hardcode ความถี่ของ external scheduler; operator ต้องตัดสินใจและบันทึกความถี่จริงใน evidence
- deployment documentation เดิมยกตัวอย่างเรียก scheduler และ outbox ทุก 1 นาที ซึ่งเป็น operational choice ไม่ใช่ contract ที่ application บังคับ
- Nginx reference config มี `proxy_read_timeout 60s`; ตั้ง client/job timeout ให้น้อยกว่านี้ตาม workload และตรวจไม่ให้ timeout ทำให้ invocation ซ้ำโดยไม่จำเป็น
- monitor HTTP status และ response body ของทั้งสอง endpoint แยกกัน

ตัวอย่าง smoke command ใช้ shell variable ของ cron runner และไม่พิมพ์ค่า secret:

```bash
curl --fail --silent --show-error --max-time 50 --request POST \
  --header "x-routine-secret: ${ROUTINE_SCHEDULER_CRON_SECRET}" \
  https://<production-domain>/api/cron/routine-scheduler

curl --fail --silent --show-error --max-time 50 --request POST \
  --header "x-outbox-secret: ${NOTIFICATION_OUTBOX_CRON_SECRET}" \
  https://<production-domain>/api/cron/notification-outbox
```

ใช้ placeholder/secret manager เท่านั้น ห้ามใส่ค่า secret จริงใน shell history และห้ามใช้ `set -x` รอบคำสั่งที่มี secret-bearing header

### 7.4 Reminder acceptance

ใช้ dedicated test task/occurrence และ test identity ที่ตกลงกับ operator:

```text
occurrence generated
→ reminder considered
→ parent outbox event created
→ notification outbox runs
→ in-app notification visible
→ email delivery เมื่อ SMTP/recipient พร้อม
→ Routine targeted LINE push delivery เมื่อ LINE account linked และ OA เป็นเพื่อน
→ LIFF deep link เปิด task/occurrence ที่ถูกต้อง
```

ผู้รับที่ไม่มี `LineAccountLink` ต้องยังได้ช่องทางที่เปิดใช้งานอยู่โดยไม่สร้าง Routine LINE child event ให้ผู้รับคนนั้น
Leave notification acceptance ให้ตรวจ **in-app, email และ personal LINE** ตาม [Notification Channel Architecture](../integrations/notifications.md) โดยยืนยันว่า unlinked user ยังได้ช่องทางเดิม และ LINE action link เปิด LIFF ที่ให้ server ตรวจ authorization อีกครั้ง

## 8. Leave attachment production readiness

ทำตาม [Storage and attachment operations](./storage-and-attachments.md) และยืนยันอย่างน้อย:

- `.uploads/private/leave` เป็น persistent storage และ process user อ่าน/เขียนได้
- ไม่ expose directory นี้ด้วย Nginx static `alias` หรือ public URL
- database table `leave_attachments` กับ private files ถูก backup/restore เป็น snapshot ที่สอดคล้องกัน
- reverse proxy มี body limit อย่างน้อย 25 MB (`client_max_body_size 25m`) และ timeout ที่เหมาะสม
- upload รองรับ JPG, PNG, WEBP และจัดเก็บผลลัพธ์เป็น WebP
- จำกัดสูงสุด 3 ไฟล์, ไฟล์ละไม่เกิน 8 MB, รวมไม่เกิน 20 MB และ request boundary 25 MB
- ผู้ใช้ทดสอบเลือกภาพจาก smartphone แล้ว upload/retrieve ได้จริง
- ไฟล์ใหญ่เกิน, aggregate ใหญ่เกิน และภาพไม่ถูกต้องถูก reject อย่างปลอดภัย
- owner/approver ที่มีสิทธิ์เปิดได้ ส่วน employee อื่นและผู้ไม่มีสิทธิ์ถูกปฏิเสธโดยไม่เห็น storage path

## 9. ลำดับการ deploy production และ LIFF gate ที่ต้องผ่าน

ทำตามลำดับนี้ทุก release; [production acceptance](./production-acceptance.md) ของ release ก่อนหน้าใช้แทนการตรวจครั้งนี้ไม่ได้ หยุดเมื่อ gate ใดไม่ผ่าน และห้าม activate Rich Menu ใหม่ก่อน LIFF gate และ acceptance ผ่าน

1. Freeze release commit SHA และตรวจว่า source/artifact ตรงกับ revision ที่ review แล้ว
2. ตรวจ production configuration, LINE Provider, LINE Login channel, LIFF ID, NHFapp Messaging API Channel, secrets, SMTP, feature flags และ `NEXT_PUBLIC_*` ก่อน build; ห้าม log หรือ commit ค่า secret
3. Backup MySQL และ persistent `.uploads/` จากช่วงเวลาที่สอดคล้องกัน รวม Leave และ IT private attachments; ตรวจสิทธิ์ของ non-root process ตาม [storage operations](./storage-and-attachments.md)
4. รัน `npm ci` และ `npx prisma generate`
5. รัน repository verification: `npm run architecture:check`, `npm run lint:strict`, `npm run typecheck` และ `npm run test -- path/to/relevant-release.test.ts`; พิจารณา `npm run test` เฉพาะ release ที่เสี่ยงกระทบหลายส่วน
6. รัน `npm run build` ด้วย configuration ที่สอดคล้องกับ production หลังตั้ง `NEXT_PUBLIC_*`
7. รัน `npx prisma migrate deploy` หลัง backup เท่านั้น; migration production เดินหน้า ห้ามใช้ `prisma migrate dev` หรือ `prisma db push` เป็นขั้นตอน deploy ปกติ
8. Deploy artifact/source ที่ตรงกับ release SHA แล้ว start/restart Next.js ผ่าน supervisor แบบ process เดียว โดย bind `127.0.0.1:3000` และใช้ persistent storage
9. ตรวจ origin health เช่น `curl --fail http://127.0.0.1:3000/` และ public HTTPS health ผ่าน Cloudflare Tunnel → Nginx → Next.js; ตรวจ Nginx ด้วย `sudo nginx -t` เมื่อตั้งค่าหรือเปลี่ยน reverse proxy
10. **Mandatory LIFF post-deploy gate:** เปิด `/liff` ใน LINE in-app browser บน Android และ iPhone ตรวจ LIFF ID กับ production LINE Login channel และยืนยัน LINE Login Channel กับ NHFapp Messaging API Channel อยู่ใต้ Provider เดียวกัน
11. ทดสอบ LINE identity ที่ยังไม่ link เข้าสู่ account-link flow; linked user กลับมาแล้ว restore LIFF workforce session ได้; session หมดอายุแล้ว recovery ได้โดยไม่ replay mutation อัตโนมัติ
12. ทดสอบ Stock, Leave, Routine ที่เปิดใช้ และ IT requester flow รวม attachment, cross-module navigation, direct deep links และ server-side authorization เมื่อเปิด deep link โดยตรง
13. ตรวจ external owner ของ Routine scheduler และ notification outbox อย่างละหนึ่งราย ตรวจ invocation, outbox processing และ Email/LINE delivery ที่เปิดใช้ตาม contract ในหัวข้อ 7
14. รัน `npm run line:richmenu:status` แบบ read-only และ `npm run line:richmenu:provision` แบบ dry-run; ตรวจ URL, รูป และสี่พื้นที่ของเมนู โดยยังไม่ใช้ `--apply`
15. บันทึกผล release นี้ใน [production acceptance](./production-acceptance.md) ให้ครบ รวม device, storage, rollback readiness และ launch monitoring; human operator ตัดสิน GO/NO-GO
16. หลัง GO เท่านั้น บันทึก previous default Rich Menu ID, target/new ID ที่คาดหมาย, operator, เวลา และ SHA; จากนั้นผู้ปฏิบัติงานที่ได้รับอนุญาตรัน `npm run line:richmenu:provision -- --apply` เป็น final launch control
17. ตรวจ default menu ใหม่ด้วย `npm run line:richmenu:status`, เปิด chat ใหม่บน smartphone และติดตาม application, LIFF, scheduler, outbox, delivery และ attachments ระหว่าง post-launch monitoring

การ deploy application และ Rich Menu activation เป็นคนละ control. ถ้า status ไม่สามารถระบุ previous default menu/rollback target ได้ ให้หยุดก่อน `--apply`. Rollback application ต้องใช้ artifact ที่เข้ากันได้กับ forward-only schema; การคืน default Rich Menu ใช้ขั้นตอนในหัวข้อ 10

## 10. Rich Menu rollback

### 10.1 Evidence ที่ต้อง capture ก่อน launch

```text
previous default richMenuId
new richMenuId
launch timestamp
operator
deployment commit SHA
```

ถ้าเมนูเดิมถูกจัดการโดย OA Manager/อีก channel หรือไม่สามารถอ่าน ID ได้ ให้หยุด launch จน owner ของ LINE configuration ระบุ rollback target ที่ deterministic

### 10.2 ขั้นตอน rollback เมนู

```text
incident detected
    → stop further rollout / stop Rich Menu activation
    → restore previous default richMenuId
    → verify current default with status
    → open smartphone chat and verify old menu
    → disable Leave/Routine feature flag เมื่อเหมาะสม
    → investigate application and preserve evidence
```

คำสั่งที่ใช้:

```bash
npm run line:richmenu:set-default -- --rich-menu-id=<previous-richMenuId>
npm run line:richmenu:set-default -- --rich-menu-id=<previous-richMenuId> --apply
npm run line:richmenu:status
```

การ rollback เป็นการ set previous default เท่านั้น ไม่ลบเมนูเดิม/เมนูใหม่โดยอัตโนมัติ และไม่ลบ `LineAccountLink`, Stock, Leave, Routine หรือ notification data

### 10.3 Application rollback แยกจาก Rich Menu rollback

- Rich Menu rollback: เปลี่ยน default บน Messaging API กลับไปยัง known previous ID
- Feature containment: เมื่อมี flag และเหมาะสม ให้ตั้ง `NEXT_PUBLIC_FEATURE_LEAVE=false` หรือ `NEXT_PUBLIC_FEATURE_ROUTINE=false` แล้ว rebuild/redeploy ตาม policy เพราะ flag ถูกฝังตอน build
- Application rollback: deploy previous known-good application artifact/commit ตาม process ปกติ
- Database: อย่าย้อน migration ด้วยการ drop table หรือ manual destructive SQL เป็นค่าเริ่มต้น ให้ใช้ application rollback ที่ compatible กับ forward schema หรือ forward migration ที่ทดสอบแล้ว

สอง control นี้เป็นอิสระต่อกัน: สามารถ rollback menu โดยปล่อย application deployed เพื่อสืบสวนได้ และสามารถ deploy application/test ก่อนโดยยังไม่เปิด menu

## 11. Launch monitoring window

ใช้ logs/monitoring architecture เดิม ไม่ต้องเพิ่ม observability platform ใน Phase 5B ตรวจอย่างน้อย:

- application HTTP 4xx/5xx และ error rate ของ `/liff`/`/api/line/*`
- LIFF initialization/session establishment และ account-link errors
- Stock mutation failures, duplicate/ambiguous submissions และ authorization errors
- Leave mutation failures, quota/approval errors และ attachment upload/retrieve failures
- Routine mutation conflicts (`409`), read errors และ unauthorized deep links
- scheduler HTTP failures, `errors` counter และ unexpected zero/no-op behavior
- outbox HTTP failures, `failed` counter, `DEAD` rows และ pending/retry backlog เมื่อ observable
- LINE provider/delivery failures และ OA friend/block status ของ test identities
- SMTP connection/send failures และ email delivery failures

### Stop conditions

ให้หยุด rollout และพิจารณา Rich Menu rollback/feature containment ทันทีเมื่อพบ:

- LIFF login/session establishment ล้มเหลวอย่างสม่ำเสมอ
- account link ไปผูกกับ user ผิดคน หรือ link conflict เขียนทับข้อมูลเดิม
- มีการ bypass authorization boundary
- Stock/Leave/Routine mutation สร้างรายการซ้ำหรือข้อมูลเสียหาย
- scheduler สร้าง occurrence/reminder ผิด หรือ `errors` เพิ่มขึ้นต่อเนื่อง
- outbox backlog/retry/DEAD โตจนควบคุมไม่ได้
- Rich Menu ใหม่พาไป broken route หรือผิด environment
- critical mobile action ใช้งานไม่ได้บน LINE in-app LIFF

ข้อผิดพลาดด้าน security/data integrity ต้อง contain/rollback ทันที ส่วน cosmetic defect เล็กน้อยให้ประเมินผลกระทบก่อน ไม่จำเป็นต้อง rollback menu ทุกกรณี

## 12. Test identities และ evidence

ห้าม seed หรือสร้าง production test records อัตโนมัติใน Phase 5B ให้ operator เตรียม/แมป identity ที่อนุมัติแล้ว:

```text
Test Employee
Test Leave Approver
Test Stock Processor
Employee-linked ADMIN
Inactive Employee
Unlinked LINE User
```

บันทึกผล release นี้ใน [Production Acceptance](./production-acceptance.md) ซึ่งครอบคลุม identity/session, Stock, Leave, Routine, requester IT, deep links, device/browser, scheduler/outbox, attachment, monitoring และ rollback

## 13. Final decision

ห้ามสรุป `GO` จาก automated tests เพียงอย่างเดียว `GO` ต้องเกิดหลัง production configuration, LINE console verification, real smartphone acceptance และ rollback evidence ครบแล้วโดย human operator

ผู้ปฏิบัติงาน production ที่ได้รับอนุญาตเท่านั้นเป็นผู้ใช้คำสั่ง mutation ของ Rich Menu และบันทึกหลักฐานก่อน/หลัง activation

## 14. Repository commands และ references

```bash
npm run architecture:check
npm run lint:strict
npm run typecheck
npm run test -- path/to/relevant.test.ts
# ใช้เฉพาะเมื่อจำเป็นต้องยืนยัน full suite
npm run test
npm run build
npm run line:richmenu:status
npm run line:richmenu:provision
npm run line:richmenu:set-default -- --rich-menu-id=<id>
```

References ภายใน:

- [LIFF Production Acceptance](./production-acceptance.md)
- [Storage and attachment operations](./storage-and-attachments.md)
- [Routine reminder manual test](./verification/routine-reminder.md)

Official references เดิมที่ใช้ประกอบการตรวจ LINE configuration:

- [LINE Developers — Use rich menus](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/)
- [LINE Developers — Messaging API reference](https://developers.line.biz/en/reference/messaging-api/nojs/)
- [LINE Developers — LIFF API reference](https://developers.line.biz/en/reference/liff/)

## Platform, Nginx และ external maintenance

ลำดับที่ต้องทำจริงอยู่ในหัวข้อ 9; คำสั่งต่อไปนี้เป็นรายละเอียดของขั้นตอนนั้น โดยเฉพาะการติดตั้งครั้งแรก

### Production environment และ initial install

```bash
cp .env.example .env
```

ตั้งค่าอย่างน้อย:

- secret ทุกตัวเป็นค่าสุ่มที่ไม่ซ้ำกัน
- `PUBLIC_APPROVE_URL` เป็น public HTTPS origin จริง
- `DATABASE_URL` ให้ user/password/database ตรงกับค่า `MYSQL_*`
- SMTP, LINE และ feature flags ตาม integration ที่ต้องเปิด

ถ้าแอปรันบน host เดียวกับ Compose ให้ใช้:

```dotenv
DATABASE_URL="mysql://app_user:strong-password@127.0.0.1:3308/employee_nhf"
```

### MySQL service

```bash
docker compose config --quiet
docker compose up -d --wait
docker compose ps
```

Named volume `nhfemployee-data` เก็บข้อมูล MySQL แบบ persistent คำสั่ง `docker compose down` จะไม่ลบ volume แต่ **ห้าม** ใช้ `docker compose down --volumes` ใน production เว้นแต่ตั้งใจลบฐานข้อมูล

### Release verification commands

```bash
npm ci
npx prisma generate
npm run architecture:check
npm run lint:strict
npm run typecheck
npm run test -- path/to/relevant-release.test.ts
```

ให้ระบุ path ของ targeted tests ที่เกี่ยวข้องกับ release เสมอ อย่ารัน
`npm run test` แบบไม่ระบุ path ในรอบแก้ไขปกติ หากเป็น release ที่มีความเสี่ยงกว้าง
และจำเป็นต้องยืนยันทั้ง repository ให้รัน `npm run test` หลัง checks
ข้างต้นผ่านและ diff คงที่แล้ว

### Migration และ seed

สำรองฐานข้อมูลก่อน migration ทุกครั้ง แล้วรัน:

```bash
npx prisma migrate deploy
```

รัน seed เฉพาะการติดตั้งครั้งแรก หรือเมื่อต้องการ reconcile ข้อมูลตั้งต้น:

```bash
npm run db:seed
```

ห้ามใช้ `prisma migrate dev` หรือ `prisma db push` กับ production

### Build และ process supervisor

ตั้ง production environment ให้ครบก่อน build โดยเฉพาะ `NEXT_PUBLIC_*`:

```bash
npm run build
npm run start
```

`npm run start` ใช้ build จาก `.next/` และฟังพอร์ต `3000` ที่ `127.0.0.1` เท่านั้น ให้ใช้ process supervisor ของเครื่อง (เช่น systemd, Supervisor หรือ PM2 แบบ single process) เพื่อ:

- ตั้ง working directory เป็น project root
- โหลด `.env`/environment ของ production
- restart เมื่อ process ล้มเหลวหรือเครื่อง reboot
- รันด้วย non-root user ที่เขียน `.uploads/` ได้

หลังเริ่ม process ให้ตรวจจากเครื่อง origin:

```bash
curl --fail http://127.0.0.1:3000/
```


### Process topology และ rate-limit contract

Production topology ที่ repository รองรับในปัจจุบันคือ **หนึ่ง host และหนึ่ง
Next.js production process** ที่รัน `npm run start` หลัง Nginx upstream เดียว
เท่านั้น. systemd, Supervisor และ PM2 ใช้ได้ในโหมด single process; PM2 cluster,
การรัน Next.js หลาย process หลัง Nginx และการกระจายไปหลาย host ยังไม่ใช่ topology
ที่รองรับ. Node.js อาจทำได้ในทางเทคนิค แต่ห้ามเปิดใช้โดยถือว่า rate limit
ปลอดภัยแล้ว.

Auth และ mutation rate limit ใน `lib/auth/rate-limit.ts` และ
`lib/security/mutation-rate-limit.ts` เป็น state ใน process เท่านั้น. Counter
ไม่แชร์ข้าม process/host และหายเมื่อ process restart; นี่เป็น tradeoff ที่ยอมรับ
สำหรับ topology ปัจจุบันและเป็น burst/brute-force control ไม่ใช่บัญชีโควตาถาวร.
ก่อนเปิด cluster หรือ horizontal scale ต้องมี backend ที่แชร์และ consume แบบ
atomic พร้อม deployment, failure policy, cleanup, integration test และ runbook
ที่รองรับ รวมถึง shared/object storage สำหรับ `.uploads/`.

เส้นทาง client IP ที่รองรับคือ `Cloudflare → Nginx → Next.js`. Nginx ตรวจ
Cloudflare source ranges, ใช้ `real_ip_header CF-Connecting-IP` แล้วเขียนทับ
`CF-Connecting-IP` ที่ส่งให้แอปจากค่า `$remote_addr` ที่ canonical แล้ว. แอปจึง
ไม่ใช้ `X-Forwarded-For`, `X-Real-IP` หรือ forwarding header อื่นเป็น fallback.
ห้ามเปิด `127.0.0.1:3000` ออก Internet. หากใช้ Cloudflare Tunnel ให้ public
hostname route ผ่าน Nginx เพื่อเปิดใช้งาน **ทั้งแอปพลิเคชัน** โดย configuration
ของ Tunnel ไม่กำหนด `path` allowlist; การ route ผ่าน Nginx ต้องมี trusted
tunnel-to-Nginx client-IP contract ที่ operator ตรวจสอบเพิ่ม เพราะ config ใน
repository นี้ trust เฉพาะ Cloudflare source ranges และไม่ถือว่า local
`cloudflared` เป็น trusted proxy โดยอัตโนมัติ. การเปิด public ทุก path เป็นเพียง
network reachability; Auth, authorization, role, LIFF และ webhook signature
ยังต้องถูกบังคับโดยแอปพลิเคชัน.

ถ้าไม่มีหรือมีค่า client identity ที่ไม่ถูกต้อง request จะอยู่ใน shared
`unknown` bucket สำหรับ pre-auth controls. local development/test ใช้ bucket นี้
ได้ แต่ไม่ควรใช้เป็นหลักฐานว่า production ระบุ client IP ได้. การแก้ traffic ที่
ถูกจัดเป็น `unknown` ต้องแก้ reverse-proxy/origin configuration ไม่ใช่เพิ่ม
fallback ที่เชื่อ header จาก client.


### Nginx และ Cloudflare

ไฟล์ตัวอย่างอยู่ที่:

- `deployment/nginx/employee_nhf.cloudflare-origin.conf`
- `deployment/nginx/cloudflare-real-ip.conf`

ก่อนใช้ต้องแก้:

- `server_name` ให้เป็น hostname จริง
- path ของ Cloudflare Origin Certificate และ private key
- upstream ต้องคงที่ `127.0.0.1:3000` ตาม single-process production contract

ตัวอย่างติดตั้งบน Linux:

```bash
sudo cp deployment/nginx/cloudflare-real-ip.conf /etc/nginx/snippets/cloudflare-real-ip.conf
sudo cp deployment/nginx/employee_nhf.cloudflare-origin.conf /etc/nginx/sites-available/employee_nhf.conf
sudo ln -s /etc/nginx/sites-available/employee_nhf.conf /etc/nginx/sites-enabled/employee_nhf.conf
sudo nginx -t
sudo systemctl reload nginx
```

ขั้นตอน Cloudflare Tunnel แบบปัจจุบัน:

- [Cloudflare Tunnel Setup](./cloudflare-tunnel.md)
- [Cloudflare Zero Trust Setup — Superseded](../archive/cloudflare-zero-trust-superseded.md)

เอกสาร Zero Trust เป็นบันทึกแนวทางเดิมเท่านั้น ไม่ใช่ขั้นตอนที่ต้องทำในการ
deploy ปัจจุบัน ระบบใช้ public Cloudflare Tunnel และไม่ใช้ Cloudflare Access
หรือ Zero Trust authentication gate.

> รายการ Cloudflare IP ใน `cloudflare-real-ip.conf` ต้องตรวจเทียบกับรายการทางการเป็นระยะ และ origin firewall ควรอนุญาตเฉพาะ Cloudflare หรือ tunnel ที่ใช้งาน

ตัวอย่าง Nginx ต้องคง `client_max_body_size 25m;` สำหรับคำขอลาที่มีหลักฐาน และต้องไม่มี `location` ที่ expose
`.uploads/private` เป็น static file หรือ alias


## Scheduled Maintenance

แอปไม่มี in-process cron และไม่ควรพึ่ง request จากผู้ใช้เพื่อปลุก worker ใน production ให้ตั้ง external
scheduler เรียก endpoints ต่อไปนี้ด้วย `POST`

cron process ไม่ได้โหลด `.env` ของ Next.js อัตโนมัติ ต้องส่ง environment variables ให้ cron โดยตรง หรือสร้างไฟล์
เฉพาะสำหรับ cron ที่อ่านได้เฉพาะผู้ดูแลระบบ เช่น `/etc/employee_nhf/cron.env`:

```dotenv
APP_BASE_URL="https://approve.example.com"
ROUTINE_SCHEDULER_CRON_SECRET="replace-with-production-secret"
NOTIFICATION_OUTBOX_CRON_SECRET="replace-with-production-secret"
AUDIT_LOG_CLEANUP_SECRET="replace-with-production-secret"
AUTH_CLEANUP_SECRET="replace-with-production-secret"
LEAVE_ATTACHMENT_CLEANUP_SECRET="replace-with-production-secret"
```

ตั้ง permission เป็น `600` และใช้ secret คนละค่ากันทุกตัว `APP_BASE_URL` ต้องเป็น HTTPS origin เดียวกับ
`PUBLIC_APPROVE_URL` โดยไม่มี `/` ท้าย URL หาก scheduler platform รองรับ environment variables อยู่แล้ว ไม่ต้องสร้างไฟล์นี้

ตัวอย่าง crontab ด้านล่างใช้ `/bin/bash` และโหลดไฟล์ดังกล่าวก่อนเรียก endpoint:

```cron
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

### Routine scheduler — ตัวอย่างทุก 1 นาที

สร้าง occurrence ตาม schedule และ enqueue reminder เข้า notification outbox แต่ไม่ได้ส่ง notification เอง ต้องตั้ง
Notification outbox worker ด้านล่างด้วย สำหรับ production ต้องตั้ง `NEXT_PUBLIC_FEATURE_ROUTINE=true` ก่อน build มิฉะนั้น
endpoint จะตอบสำเร็จแบบ no-op โดยไม่สร้าง occurrence หรือ reminder:

```cron
* * * * * . /etc/employee_nhf/cron.env && curl --fail --silent --show-error --max-time 50 --request POST --header "x-routine-secret: $ROUTINE_SCHEDULER_CRON_SECRET" "$APP_BASE_URL/api/cron/routine-scheduler"
```

### Notification outbox — ตัวอย่างทุก 1 นาที

```cron
* * * * * . /etc/employee_nhf/cron.env && curl --fail --silent --show-error --request POST --header "x-outbox-secret: $NOTIFICATION_OUTBOX_CRON_SECRET" "$APP_BASE_URL/api/cron/notification-outbox"
```

Worker claim สูงสุด 10 รายการต่อ invocation และ process ตามลำดับเวลาสร้าง การเรียกทุก 1 นาทีช่วยระบาย backlog ต่อเนื่อง
Worker ส่งซ้ำสูงสุด 3 ครั้ง โดย backoff 1 และ 2 นาที รายการที่ล้มเหลวหลังครั้งที่ 3 เปลี่ยนเป็น `DEAD`

Routine scheduler กับ outbox worker เริ่มในนาทีเดียวกันได้ หาก worker ทำงานก่อน scheduler enqueue รายการใหม่ รายการนั้นจะถูก
process ในรอบถัดไป โดยอาจช้าสูงสุดประมาณ 1 นาที

### Audit log cleanup — วันละครั้ง

```cron
15 2 * * * . /etc/employee_nhf/cron.env && curl --fail --silent --show-error --request POST --header "x-cleanup-secret: $AUDIT_LOG_CLEANUP_SECRET" "$APP_BASE_URL/api/audit-logs/cleanup"
```

ระบบลบ audit log ที่เก่ากว่า 90 วัน

### Auth token cleanup — วันละครั้ง

```cron
30 2 * * * . /etc/employee_nhf/cron.env && curl --fail --silent --show-error --request POST --header "x-cleanup-secret: $AUTH_CLEANUP_SECRET" "$APP_BASE_URL/api/auth/cleanup"
```

ระบบลบ refresh token ที่หมดอายุหรือถูก revoke และเก่ากว่า retention window 7 วัน

### Leave attachment orphan cleanup — วันละครั้ง

ก่อนเปิด cron ให้รัน dry-run ด้วยตนเองหนึ่งครั้งและตรวจ counters ที่ตอบกลับ:

```bash
set -a
. /etc/employee_nhf/cron.env
set +a
curl --fail --silent --show-error --request POST --header "x-cleanup-secret: $LEAVE_ATTACHMENT_CLEANUP_SECRET" "$APP_BASE_URL/api/leave/attachments/cleanup?dryRun=true"
```

เมื่อผล dry-run ถูกต้องจึงเปิด cron ที่ลบจริง:

```cron
0 3 * * * . /etc/employee_nhf/cron.env && curl --fail --silent --show-error --request POST --header "x-cleanup-secret: $LEAVE_ATTACHMENT_CLEANUP_SECRET" "$APP_BASE_URL/api/leave/attachments/cleanup"
```

งานนี้ scan เฉพาะ private leave directory, เทียบ `storageKey` กับฐานข้อมูล และลบเฉพาะไฟล์ที่เก่ากว่า safety
window 24 ชั่วโมง จึงไม่ควรลบไฟล์ที่อยู่ระหว่าง request; endpoint ต้องมี header secret เสมอและไม่คืนชื่อไฟล์หรือ path

ทุก endpoint ตอบ `503` เมื่อไม่ได้ตั้ง secret และ `403` เมื่อ header secret ไม่ตรง Routine scheduler ตอบ `500` พร้อม
counters เมื่อบางรายการทำงานไม่สำเร็จ `curl --fail` จึงทำให้ cron run นั้นล้มและสามารถแจ้งเตือนผ่านระบบ monitoring ภายนอกได้


## Backup และ application rollback

- ก่อน deploy ให้สำรอง MySQL และ `.uploads/` พร้อมกันเพื่อให้ข้อมูลอ้างอิงไฟล์ตรงกัน
- สำรอง `.uploads/private/leave/` พร้อมตาราง `leave_attachments`; ขั้นตอน restore ให้ restore database และ directory จาก snapshot เวลาเดียวกัน แล้วตรวจจำนวน metadata/file ก่อนเปิด traffic
- rollback application ได้ด้วยการนำ source/build รุ่นก่อนกลับมารัน
- Prisma migrations ใน repository ออกแบบให้เดินหน้า การย้อน schema ต้องทำเป็น migration ใหม่และทดสอบกับสำเนาข้อมูลก่อน
- migration เพิ่ม `leave_attachments` เป็น additive และไม่ลบ `attachmentUrl`; หากต้อง rollback application หลัง migration ให้คงตาราง/ไฟล์ไว้ เพราะรุ่นเก่าจะไม่อ่านข้อมูลใหม่ แล้ว deploy forward migration ที่ผ่านการทดสอบแทนการลบตาราง
- การลบ Compose named volume เป็น destructive operation และไม่ใช่ขั้นตอน rollback

รายละเอียด permission, restore, cleanup และแผนจัดการ `attachmentUrl` อยู่ใน [Storage and attachment operations](./storage-and-attachments.md)
