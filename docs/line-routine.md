# NHFapp Unified LINE / LIFF Production Runbook

เอกสารนี้เป็น runbook ฉบับสุดท้ายสำหรับ Phase 5B — Production Acceptance / Launch Readiness Gate ของ Unified NHFapp LIFF ใช้สำหรับเตรียม ตรวจรับ และเปิดใช้งานใน production เท่านั้น

หลักการสำคัญ:

- application deployment กับ Rich Menu activation เป็นคนละ launch control
- Rich Menu ใหม่ต้องเป็นขั้นตอนสุดท้าย หลังตรวจระบบบน smartphone ครบแล้ว
- `npm run line:richmenu:provision -- --apply` และ `npm run line:richmenu:set-default -- --apply` เป็นคำสั่งที่เปลี่ยน production state ผู้ปฏิบัติงานที่ได้รับอนุญาตเป็นผู้รันเองเท่านั้น
- เอกสาร acceptance ที่ใช้บันทึกผลจริงอยู่ที่ [LIFF Production Acceptance](./liff-production-acceptance.md)

## 1. Architecture

```text
NHF Official Account
        │
        ├── Messaging API Channel
        │       ├── Routine LINE push
        │       ├── existing Stock/Leave notification delivery
        │       └── Unified Rich Menu
        │
        └── LINE Login Channel
                └── LIFF App

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
Stock | Leave | Routine
```

### บทบาทของแต่ละส่วน

| ส่วน | บทบาทใน production |
| --- | --- |
| NHF Official Account | OA ที่ผู้ใช้เพิ่มเป็นเพื่อน และเป็นเจ้าของ channel access token สำหรับส่งข้อความของ NHFapp |
| LINE Login Channel | ตรวจสอบ LIFF identity และใช้สร้าง LIFF application; `LINE_LOGIN_CHANNEL_ID` ต้องเป็น channel เดียวกับ LIFF app |
| Messaging API Channel | ส่ง Rich Menu และข้อความแจ้งเตือนตาม notification architecture เดิม |
| LIFF | จุดเข้าใช้งานจาก LINE และส่ง ID token ระยะสั้นให้ server ตรวจสอบ identity |
| `LiffBootstrap` | เรียก `liff.init`, ตรวจ LINE login, สร้าง/กู้ NHFapp session และนำผู้ใช้ไป account-link เมื่อยังไม่ link |
| NHFapp HttpOnly LIFF session | cookie `nhf_liff_session` ที่ server เซ็นและตรวจอายุ ใช้ยืนยัน workforce session ของ NHFapp |
| account linking | ผูก LINE user ID กับ NHFapp user ที่ login ไว้; conflict ต้อง fail และห้ามเขียนทับ link เดิม |
| feature flags | ควบคุม Leave และ Routine จาก `NEXT_PUBLIC_*`; ค่าถูกฝังตอน build |
| Routine scheduler | สร้าง occurrence และ enqueue reminder work ลง notification outbox; ไม่ได้ส่งข้อความเอง |
| Notification outbox | claim/process งานค้างและส่ง in-app, email และ LINE ตาม event ที่มีอยู่ |

ID token เป็น identity assertion ที่อายุสั้น ใช้ตรวจสอบกับ LINE แล้วไม่ใช่ NHF session ระยะยาว ห้ามบันทึก ID token, cookie หรือ Authorization header ลง log

### Live LIFF modules

| Module | Route | พฤติกรรม production |
| --- | --- | --- |
| Home | `/liff` | แสดง workforce identity และสถานะ Stock, Leave, Routine |
| Stock | `/liff/stock` | catalog, search/filter, variants, cart, availability reconciliation, submit request, My Requests, detail, cancellation และ processor flow ตามสิทธิ์ |
| Leave | `/liff/leave` | quota, create, validation, attachment, history, detail, cancellation, not-taken และ approver flow ตาม flag/สิทธิ์ |
| Routine | `/liff/routine` | summary, timing filters, pagination, detail, own-task create/edit/delete, occurrence reads, version conflict และ reminder deep link ตาม flag/สิทธิ์ |

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
| `LINE_APP_CHANNEL_ACCESS_TOKEN` | token ของ Messaging API channel สำหรับ Rich Menu และ NHFapp LINE push | secret manager / Messaging API channel ของ NHF Official Account |
| `LINE_APP_CHANNEL_SECRET` | channel secret ของ Messaging API channel | LINE Developers Console; เก็บใน secret manager |
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
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Routine reminder/contract expiry และ notification email เดิม; Routine email acceptance ต้องตั้งครบ |
| `.uploads/` | รูป Stock และ private leave attachments; ต้องอยู่บน persistent disk |
| `LEAVE_ATTACHMENT_CLEANUP_SECRET` | เปิด scheduled orphan cleanup ของ private leave attachments |
| `AUTH_CLEANUP_SECRET`, `AUDIT_LOG_CLEANUP_SECRET` | เปิด maintenance endpoint ของ auth/audit ตาม deployment policy |

รายละเอียด permission, backup, restore, reverse proxy และ cleanup ของ leave attachment อยู่ใน [Leave attachment deployment runbook](./leave-attachments-deployment.md)

Integration LINE เดิมนอก Unified LIFF ใช้ตัวแปรต่อไปนี้เมื่อ workflow เหล่านั้นยังเปิดจริง:

```text
LINE_IT_CHANNEL_ACCESS_TOKEN
LINE_IT_CHANNEL_SECRET
LINE_STOCK_CHANNEL_ACCESS_TOKEN
LINE_STOCK_CHANNEL_SECRET
LINE_IT_TEAM_USER_ID
LINE_WEBHOOK_URL
```

ตัวแปรกลุ่มนี้ไม่ใช่ตัวแทนของ `LINE_APP_CHANNEL_ACCESS_TOKEN` และห้ามนำ token คนละ OA มาใช้แทนกัน `LINE_WEBHOOK_URL` เป็น integration เสริมของ Email Request ไม่ใช่ LIFF endpoint

`BOOTSTRAP_ADMIN_EMAILS` ใช้ตอน seed/bootstrap เท่านั้น ส่วน `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` ใช้เมื่อ deployment เลือก Docker Compose MySQL

`APP_BASE_URL` ในตัวอย่าง cron เป็น variable ของ external cron runner ไม่ใช่ variable ที่ application อ่านเพื่อสร้าง LIFF URL ให้ตั้งเป็น public HTTPS origin เดียวกับระบบ โดยไม่ใส่ secret

## 3. LINE Developers Console checklist

### Provider และ channel architecture

- [ ] Messaging API Channel ของ NHF Official Account และ LINE Login Channel อยู่ใต้ Provider/account architecture ที่องค์กรตั้งใจใช้
- [ ] LIFF application อยู่บน LINE Login Channel เดียวกับ `LINE_LOGIN_CHANNEL_ID`
- [ ] Messaging API channel เป็นของ OA ที่ผู้ใช้จะเพิ่มเป็นเพื่อนและเป็น OA ที่ส่ง NHFapp notification

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

- [ ] `LINE_APP_CHANNEL_ACCESS_TOKEN` เป็น token ของ Messaging API Channel ที่ผูกกับ NHF Official Account ถูกตัว
- [ ] `LINE_APP_CHANNEL_SECRET` เป็น channel secret ของ channel เดียวกัน
- [ ] token มีสิทธิ์สำหรับ Rich Menu operations และ push message ที่ระบบใช้อยู่
- [ ] OA ตรงกับ token คือ OA ที่ test identities เพิ่มเป็นเพื่อน
- [ ] ไม่มี token/channel secret ใน `NEXT_PUBLIC_*`, source control, shell transcript, application log หรือ monitoring payload
- [ ] หลัง scheduler/outbox พร้อม ทดสอบ Routine LINE push ด้วย linked test user และตรวจ deep link
- [ ] ตรวจ existing Stock/Leave/other LINE notification events ตาม outbox architecture เดิม ไม่เพิ่ม channel ใหม่
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
Stock | Leave | Routine
```

ต้องคง validation: PNG/JPEG ที่อ่านได้, asset ปัจจุบันเป็น PNG, `2500×843` pixels, ไม่เกิน `1,000,000` bytes, tappable areas อยู่ใน bounds และทุก action เป็น `https://liff.line.me/<LIFF_ID>/...`

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

Phase 5B แนะนำเฉพาะ operational/documentation/test changes และ **ไม่มี database migration ใหม่**

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
→ LINE push delivery เมื่อ LINE account linked และ OA เป็นเพื่อน
→ LIFF deep link เปิด task/occurrence ที่ถูกต้อง
```

ผู้รับที่ไม่มี `LineAccountLink` ต้องยังได้ช่องทางที่เปิดใช้งานอยู่โดยไม่สร้าง LINE child event ให้ผู้รับคนนั้น

## 8. Leave attachment production readiness

ทำตาม [Leave attachment deployment runbook](./leave-attachments-deployment.md) และยืนยันอย่างน้อย:

- `.uploads/private/leave` เป็น persistent storage และ process user อ่าน/เขียนได้
- ไม่ expose directory นี้ด้วย Nginx static `alias` หรือ public URL
- database table `leave_attachments` กับ private files ถูก backup/restore เป็น snapshot ที่สอดคล้องกัน
- reverse proxy มี body limit อย่างน้อย 25 MB (`client_max_body_size 25m`) และ timeout ที่เหมาะสม
- upload รองรับ JPG, PNG, WEBP และจัดเก็บผลลัพธ์เป็น WebP
- จำกัดสูงสุด 3 ไฟล์, ไฟล์ละไม่เกิน 8 MB, รวมไม่เกิน 20 MB และ request boundary 25 MB
- ผู้ใช้ทดสอบเลือกภาพจาก smartphone แล้ว upload/retrieve ได้จริง
- ไฟล์ใหญ่เกิน, aggregate ใหญ่เกิน และภาพไม่ถูกต้องถูก reject อย่างปลอดภัย
- owner/approver ที่มีสิทธิ์เปิดได้ ส่วน employee อื่นและผู้ไม่มีสิทธิ์ถูกปฏิเสธโดยไม่เห็น storage path

## 9. Exact production deployment order

ทำตามลำดับนี้ และอย่า activate Rich Menu ก่อนข้อ manual acceptance สำเร็จ:

1. Freeze production commit ที่ตั้งใจ deploy และหยุดการเปลี่ยนแปลงที่ไม่เกี่ยวข้อง
2. บันทึก deployment commit SHA
3. ตรวจ working tree/artifact ว่าเป็น release ที่ review แล้ว
4. ตรวจ secret manager และ configure production environment โดยตั้ง `NEXT_PUBLIC_*` ก่อน build
5. เตรียม persistent `.uploads/private/leave` และตรวจ permission/non-root process
6. Backup database และ private attachment storage ตาม policy
7. ติดตั้ง dependencies ด้วย `npm ci` และ generate Prisma client ด้วย `npx prisma generate`
8. รัน `npm run check`
9. รัน `npm run build` ด้วย non-secret/local configuration ที่สอดคล้องกับ production; หาก build local ใช้ production-only credential ไม่ได้ ให้ gate ไว้เป็น pre-deploy operator check
10. Apply migrations ด้วย `npx prisma migrate deploy` หลัง backup; Phase 5B ไม่มี migration ใหม่
11. Deploy artifact/source ที่ตรงกับ commit SHA
12. Start/restart Next.js ผ่าน supervisor ด้วย working directory, environment และ persistent storage ที่ถูกต้อง
13. ตรวจ process/service health จาก origin เช่น `curl --fail http://127.0.0.1:3000/`
14. ตรวจ public HTTPS และเปิด `/liff` โดยตรงก่อน Rich Menu
15. ตรวจ `npm run line:richmenu:status` แบบ read-only ใน production operator environment
16. ตรวจ `npm run line:richmenu:provision` แบบ dry-run และตรวจ URL/image/three areas
17. Configure external owner ของ Routine scheduler และ Notification outbox แยกกัน
18. ตรวจ scheduler/outbox smoke ตาม contract และตรวจ HTTP monitoring
19. ทดสอบ unlinked LINE account และ account-link flow
20. ทดสอบ returning linked-user flow และ session recovery
21. ทดสอบ Stock end-to-end
22. ทดสอบ Leave end-to-end รวม smartphone attachment
23. ทดสอบ Routine end-to-end รวม stale-version และ reminder/outbox/deep link
24. ทดสอบ cross-module navigation, feature flags และ deep links บน Android + iPhone ใน LINE in-app LIFF
25. บันทึกผลใน [acceptance matrix](./liff-production-acceptance.md); ทุก critical row ต้อง `PASS` และไม่มี stop condition
26. เรียก `npm run line:richmenu:provision` ซ้ำหลัง smartphone acceptance เพื่อบันทึก dry-run สุดท้าย
27. เรียก `status` เพื่อบันทึก previous default `richMenuId` และตรวจว่า rollback target มีอยู่จริง
28. บันทึก previous/new ID ที่คาดหมาย, timestamp, operator และ SHA ก่อน mutation
29. รัน `npm run line:richmenu:provision -- --apply` เป็นขั้นตอนสุดท้ายเพื่อสร้าง/ตั้ง Unified Rich Menu ใหม่
30. ตรวจ `richMenuId` ใหม่ด้วย `npm run line:richmenu:status`, เปิด chat ใหม่บน smartphone และเริ่ม monitoring window
31. บันทึก final decision เป็น `GO` หรือ `NO-GO` โดย human operator

Rich Menu activation คือ final launch switch เพราะทำให้ผู้ใช้เข้าถึงระบบที่ deploy แล้วโดยตรง ก่อนข้อ 28 ต้องยังไม่ตั้งเมนูใหม่เป็น default

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

กรอกผลละเอียดใน [LIFF Production Acceptance](./liff-production-acceptance.md) ซึ่งครอบคลุม identity/session, Stock, Leave, Routine, deep links, device/browser, scheduler/outbox, attachment, monitoring และ rollback

## 13. Final decision

ห้ามสรุป `GO` จาก automated tests เพียงอย่างเดียว `GO` ต้องเกิดหลัง production configuration, LINE console verification, real smartphone acceptance และ rollback evidence ครบแล้วโดย human operator

Implementation agent ของ Phase 5B ต้องไม่:

- รัน `npm run line:richmenu:provision -- --apply`
- เปลี่ยน default Rich Menu จริง
- เรียก production cron endpoints
- ส่ง real production LINE push/email
- แก้ LINE Developers Console, rotate credentials หรือ deploy production

## 14. Repository commands และ references

```bash
npm run check
npm run build
npm run line:richmenu:status
npm run line:richmenu:provision
npm run line:richmenu:set-default -- --rich-menu-id=<id>
```

References ภายใน:

- [LIFF Production Acceptance](./liff-production-acceptance.md)
- [Leave attachment deployment runbook](./leave-attachments-deployment.md)
- [Routine reminder manual test](./line-routine-reminder-manual-test.md)

Official references เดิมที่ใช้ประกอบการตรวจ LINE configuration:

- [LINE Developers — Use rich menus](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/)
- [LINE Developers — Messaging API reference](https://developers.line.biz/en/reference/messaging-api/nojs/)
- [LINE Developers — LIFF API reference](https://developers.line.biz/en/reference/liff/)
