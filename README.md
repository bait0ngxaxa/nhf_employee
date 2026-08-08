# Employee & IT Management System (NHF)

ระบบจัดการข้อมูลพนักงาน งานบริการด้านไอที การลา สต็อก และการแจ้งเตือน สำหรับมูลนิธิสาธารณสุขแห่งชาติ (National Health Foundation — NHF)

## ภาพรวมระบบ

- Employee Directory: จัดการข้อมูลพนักงาน แผนก ตำแหน่ง สถานะ และสายบังคับบัญชา
- IT Service Desk: รับแจ้งและติดตามปัญหาไอที พร้อมความคิดเห็นและการมอบหมายงาน
- Leave Management: ยื่น อนุมัติ ปฏิเสธ ยกเลิก และคืนโควตาวันลา
- Stock & Requisition: จัดการสินค้า ตัวเลือกสินค้า ยอดคงเหลือ และใบเบิก
- Notification: แจ้งเตือนในระบบ, Email และ LINE ผ่าน transactional outbox
- Security: JWT access token, refresh-token rotation, RBAC และ audit log

## Technology Stack

- Next.js 15 (App Router), React 19 และ TypeScript
- Tailwind CSS 4
- MySQL 8 และ Prisma ORM 6
- Nodemailer, LINE Messaging API และ Sharp
- Vitest, Testing Library และ ESLint

## ข้อกำหนดก่อนเริ่ม

- Node.js 20 LTS หรือใหม่กว่า
- npm (ใช้ lockfile ของโปรเจกต์ผ่าน `npm ci`)
- Docker Engine และ Docker Compose plugin สำหรับ MySQL
- OpenSSL หรือเครื่องมือสร้าง random secret ที่ปลอดภัย

> `docker-compose.yml` ของโปรเจกต์นี้รัน **MySQL เท่านั้น** ตัว Next.js รันบน host ด้วย Node.js และฟังที่พอร์ต `3000` ตามค่าเริ่มต้น

## Setup สำหรับเครื่องพัฒนา

### 1. ติดตั้ง dependencies

```bash
npm ci
```

### 2. สร้างไฟล์ environment

PowerShell:

```powershell
Copy-Item .env.example .env
```

Bash:

```bash
cp .env.example .env
```

แก้ค่ารหัสผ่านและ secret ใน `.env` ก่อนใช้งาน ห้ามนำ `.env` ขึ้น Git

### 3. เริ่ม MySQL

Compose map MySQL จาก container port `3306` มาที่ `127.0.0.1:3308`:

```bash
docker compose config --quiet
docker compose up -d --wait
docker compose ps
```

ดู log ฐานข้อมูล:

```bash
docker compose logs -f mysql
```

### 4. เตรียมฐานข้อมูล

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

Seed เป็นแบบ idempotent และสร้างแผนกพื้นฐานกับ employee สำหรับ bootstrap admin โดยใช้ email ตัวแรกใน `BOOTSTRAP_ADMIN_EMAILS` จากนั้นให้สมัครบัญชีด้วย email เดียวกัน

### 5. เริ่ม development server

```bash
npm run dev
```

เปิด `http://localhost:3000`

## Environment Configuration

ค่าทั้งหมดมีตัวอย่างอยู่ใน `.env.example`

### ค่าที่ต้องตั้งใน Production

| Variable | หน้าที่ |
| --- | --- |
| `DATABASE_URL` | MySQL connection URL ที่ Prisma ใช้ |
| `AUTH_ACCESS_TOKEN_SECRET` | secret สำหรับเซ็น access token ต้องเป็นค่าสุ่มยาวอย่างน้อย 32 ตัวอักษร |
| `AUTH_CLEANUP_SECRET` | secret ของ `POST /api/auth/cleanup` |
| `AUDIT_LOG_CLEANUP_SECRET` | secret ของ `POST /api/audit-logs/cleanup` |
| `LEAVE_ATTACHMENT_CLEANUP_SECRET` | secret ของ `POST /api/leave/attachments/cleanup` |
| `NOTIFICATION_OUTBOX_CRON_SECRET` | secret ของ `POST /api/cron/notification-outbox` |
| `ROUTINE_SCHEDULER_CRON_SECRET` | secret ของ `POST /api/cron/routine-scheduler` |
| `PUBLIC_APPROVE_URL` | origin แบบ HTTPS ของระบบ เช่น `https://approve.example.com` ห้ามเป็น localhost ใน production |
| `MYSQL_ROOT_PASSWORD` | รหัสผ่าน root ที่ใช้ตอนสร้าง MySQL container |
| `MYSQL_DATABASE` | ชื่อฐานข้อมูลที่ Compose สร้าง |
| `MYSQL_USER` | application database user |
| `MYSQL_PASSWORD` | รหัสผ่าน application database user ต้องตรงกับ `DATABASE_URL` |
| `BOOTSTRAP_ADMIN_EMAILS` | รายการ email ที่มีสิทธิ์ bootstrap admin คั่นด้วย comma; seed ใช้ email แรกสร้าง employee ตั้งต้น |

สร้าง secret ตัวอย่าง:

```bash
openssl rand -base64 48
```

ใช้ค่าคนละชุดสำหรับ secret แต่ละตัว และอย่าใช้ค่าตัวอย่างจาก repository ในระบบจริง

### Authentication

| Variable | Default | หน้าที่ |
| --- | --- | --- |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS` | `900` | อายุ access token (15 นาที) |
| `AUTH_REFRESH_TOKEN_TTL_SECONDS` | `2592000` | อายุ refresh token (30 วัน) |

ค่าทั้งสองต้องเป็นจำนวนเต็มบวก

### Email

| Variable | หน้าที่ |
| --- | --- |
| `SMTP_HOST` | SMTP server |
| `SMTP_PORT` | ปกติ `587` สำหรับ STARTTLS หรือ `465` สำหรับ TLS |
| `SMTP_SECURE` | `true` เมื่อใช้ implicit TLS; กรณี port 587 ใช้ `false` |
| `SMTP_USER` / `SMTP_PASS` | บัญชี SMTP |
| `IT_TEAM_EMAIL` | email ปลายทางของทีมไอที |
| `EMAIL_REQUEST_INAPP_RECIPIENT_EMAILS` | email ผู้รับ in-app notification คั่นด้วย comma |

ถ้าไม่ตั้ง `SMTP_USER` หรือ `SMTP_PASS` ระบบจะส่ง email ไม่ได้ และ event ที่ต้องส่ง email จะเข้า retry/dead ตาม policy ของ notification outbox; สำหรับ Routine production ต้องตั้งค่า SMTP ให้ครบ

### LINE

| Variable | หน้าที่ |
| --- | --- |
| `LINE_IT_CHANNEL_ACCESS_TOKEN` | channel access token สำหรับ IT |
| `LINE_IT_CHANNEL_SECRET` | ใช้ตรวจ signature ของ IT webhook |
| `LINE_STOCK_CHANNEL_ACCESS_TOKEN` | channel access token สำหรับ Stock |
| `LINE_STOCK_CHANNEL_SECRET` | ใช้ตรวจ signature ของ Stock webhook |
| `LINE_IT_TEAM_USER_ID` | LINE user/group ID ของทีมไอที |
| `LINE_WEBHOOK_URL` | URL ปลายทางเสริมที่ integration ใช้ |

Webhook route ของแอปคือ `/api/line/webhook`

### Feature Flags

| Variable | Production default | หน้าที่ |
| --- | --- | --- |
| `NEXT_PUBLIC_FEATURE_LEAVE` | ปิด | เปิดโมดูล Leave เมื่อเป็น `true` |
| `NEXT_PUBLIC_FEATURE_ITSUPPORT` | ปิด | เปิดโมดูล IT Support เมื่อเป็น `true` |
| `NEXT_PUBLIC_FEATURE_ROUTINE` | ปิด | เปิดโมดูล Routine เมื่อเป็น `true` |

ค่า `NEXT_PUBLIC_*` ถูกฝังใน client bundle ตอน build ดังนั้นต้องตั้งค่าก่อน `npm run build` และ build ใหม่ทุกครั้งที่เปลี่ยนค่า

### Local Upload Storage

รูปสินค้าถูกแปลงเป็น WebP และเก็บใต้ `.uploads/` ที่ project root จากนั้นให้บริการผ่าน `/api/uploads/*`

- production ต้องเก็บ `.uploads/` บน persistent disk
- user ที่รัน Node.js ต้องมีสิทธิ์อ่าน/เขียน directory นี้
- ต้องรวม `.uploads/` ในแผน backup
- ถ้ารันหลาย app instances ต้องใช้ shared filesystem หรือเปลี่ยนไปใช้ object storage ก่อน scale out

หลักฐานการลาถูกเก็บแยกเป็น private files ใต้ `.uploads/private/leave/<leaveRequestId>/` และอ่านได้ผ่าน
`/api/leave/attachments/<attachmentId>` หลังตรวจสิทธิ์ทุกครั้งเท่านั้น ระบบไม่สร้าง public URL และห้ามเพิ่ม
`.uploads/private` เป็น Nginx static location

- ให้สร้าง directory ด้วย owner/group เดียวกับ process user ของ Node.js และ permission ที่ไม่เปิดให้ web server หรือผู้ใช้ทั่วไปอ่านโดยตรง
- ต้อง backup `.uploads/private/leave/` คู่กับตาราง `leave_attachments` และฐานข้อมูล เพื่อให้ metadata กับไฟล์สอดคล้องกัน
- การติดตั้งแบบหลาย instance ต้อง mount shared filesystem ที่มี locking/permission เดียวกัน หรือย้าย storage service ไป object storage ก่อน scale out
- multipart request ถูกจำกัดที่ reverse proxy `client_max_body_size 25m;` (ไฟล์รวมสูงสุด 20 MB และมี overhead)

## Production Deployment

รูปแบบ deployment ที่ repository รองรับในปัจจุบัน:

```text
Internet → Cloudflare → Nginx :443 → Next.js 127.0.0.1:3000
                                      ↓
                                  MySQL :3308
                                      ↓
                                .uploads/ (disk)
```

### 1. เตรียม production environment

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

### 2. เริ่มฐานข้อมูล

```bash
docker compose config --quiet
docker compose up -d --wait
docker compose ps
```

Named volume `nhfemployee-data` เก็บข้อมูล MySQL แบบ persistent คำสั่ง `docker compose down` จะไม่ลบ volume แต่ **ห้าม** ใช้ `docker compose down --volumes` ใน production เว้นแต่ตั้งใจลบฐานข้อมูล

### 3. ติดตั้งและตรวจสอบ release

```bash
npm ci
npx prisma generate
npm run check
```

`npm run check` รัน `lint:strict`, `typecheck` และ `test:run`

### 4. Apply migrations และ seed

สำรองฐานข้อมูลก่อน migration ทุกครั้ง แล้วรัน:

```bash
npx prisma migrate deploy
```

รัน seed เฉพาะการติดตั้งครั้งแรก หรือเมื่อต้องการ reconcile ข้อมูลตั้งต้น:

```bash
npm run db:seed
```

ห้ามใช้ `prisma migrate dev` หรือ `prisma db push` กับ production

### 5. Build และเริ่มแอป

ตั้ง production environment ให้ครบก่อน build โดยเฉพาะ `NEXT_PUBLIC_*`:

```bash
npm run build
npm run start
```

`npm run start` ใช้ build จาก `.next/` และฟังพอร์ต `3000` ให้ใช้ process supervisor ของเครื่อง (เช่น systemd, Supervisor หรือ PM2) เพื่อ:

- ตั้ง working directory เป็น project root
- โหลด `.env`/environment ของ production
- restart เมื่อ process ล้มเหลวหรือเครื่อง reboot
- รันด้วย non-root user ที่เขียน `.uploads/` ได้

หลังเริ่ม process ให้ตรวจจากเครื่อง origin:

```bash
curl --fail http://127.0.0.1:3000/
```

### 6. ตั้ง Nginx และ Cloudflare

ไฟล์ตัวอย่างอยู่ที่:

- `deployment/nginx/employee_nhf.cloudflare-origin.conf`
- `deployment/nginx/cloudflare-real-ip.conf`

ก่อนใช้ต้องแก้:

- `server_name` ให้เป็น hostname จริง
- path ของ Cloudflare Origin Certificate และ private key
- upstream หาก Next.js ไม่ได้ฟังที่ `127.0.0.1:3000`

ตัวอย่างติดตั้งบน Linux:

```bash
sudo cp deployment/nginx/cloudflare-real-ip.conf /etc/nginx/snippets/cloudflare-real-ip.conf
sudo cp deployment/nginx/employee_nhf.cloudflare-origin.conf /etc/nginx/sites-available/employee_nhf.conf
sudo ln -s /etc/nginx/sites-available/employee_nhf.conf /etc/nginx/sites-enabled/employee_nhf.conf
sudo nginx -t
sudo systemctl reload nginx
```

ขั้นตอน Cloudflare Tunnel และ Zero Trust แบบละเอียด:

- [Cloudflare Tunnel Setup](./CLOUDFLARE_TUNNEL_SETUP.md)
- [Cloudflare Zero Trust Setup](./CLOUDFLARE_ZERO_TRUST_SETUP.md)

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

### Routine scheduler — ทุก 1 นาที

สร้าง occurrence ตาม schedule และ enqueue reminder เข้า notification outbox แต่ไม่ได้ส่ง notification เอง ต้องตั้ง
Notification outbox worker ด้านล่างด้วย สำหรับ production ต้องตั้ง `NEXT_PUBLIC_FEATURE_ROUTINE=true` ก่อน build มิฉะนั้น
endpoint จะตอบสำเร็จแบบ no-op โดยไม่สร้าง occurrence หรือ reminder:

```cron
* * * * * . /etc/employee_nhf/cron.env && curl --fail --silent --show-error --max-time 50 --request POST --header "x-routine-secret: $ROUTINE_SCHEDULER_CRON_SECRET" "$APP_BASE_URL/api/cron/routine-scheduler"
```

### Notification outbox — ทุก 1 นาที

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

## Deployment Checklist

- [ ] `.env` ไม่อยู่ใน Git และ secrets ไม่ใช้ค่าตัวอย่าง
- [ ] `PUBLIC_APPROVE_URL` เป็น HTTPS origin จริง
- [ ] `docker compose up -d --wait` ผ่านและ MySQL healthy
- [ ] backup ฐานข้อมูลสำเร็จก่อน migration
- [ ] `npx prisma migrate deploy` ผ่าน
- [ ] `npm run check` ผ่าน
- [ ] ตั้ง feature flags ก่อน `npm run build`
- [ ] process supervisor รัน Next.js ด้วย non-root user
- [ ] `.uploads/` เป็น persistent storage และมี backup
- [ ] Nginx `nginx -t` ผ่านและส่ง forwarded headers ครบ
- [ ] scheduled maintenance ทั้ง 5 endpoints ทำงาน, cron โหลด environment ได้ และเก็บ secrets อย่างปลอดภัย
- [ ] ทดสอบ dry-run ของ leave attachment cleanup และตรวจ disk usage/permission
- [ ] backup ฐานข้อมูลและ `.uploads/private/leave/` สำเร็จก่อน migration และเก็บไว้นอกเครื่องเดียวกับ app
- [ ] ทดสอบ login, refresh session, upload รูป, Email/LINE และหน้า feature ที่เปิด

## การอัปเดตเวอร์ชัน

```bash
git pull --ff-only
npm ci
npx prisma generate
npm run check
npx prisma migrate deploy
npm run build
```

จากนั้น restart process ด้วย supervisor ที่ใช้งาน และตรวจ application/database logs

## Rollback และ Backup

- ก่อน deploy ให้สำรอง MySQL และ `.uploads/` พร้อมกันเพื่อให้ข้อมูลอ้างอิงไฟล์ตรงกัน
- สำรอง `.uploads/private/leave/` พร้อมตาราง `leave_attachments`; ขั้นตอน restore ให้ restore database และ directory จาก snapshot เวลาเดียวกัน แล้วตรวจจำนวน metadata/file ก่อนเปิด traffic
- rollback application ได้ด้วยการนำ source/build รุ่นก่อนกลับมารัน
- Prisma migrations ใน repository ออกแบบให้เดินหน้า การย้อน schema ต้องทำเป็น migration ใหม่และทดสอบกับสำเนาข้อมูลก่อน
- migration เพิ่ม `leave_attachments` เป็น additive และไม่ลบ `attachmentUrl`; หากต้อง rollback application หลัง migration ให้คงตาราง/ไฟล์ไว้ เพราะรุ่นเก่าจะไม่อ่านข้อมูลใหม่ แล้ว deploy forward migration ที่ผ่านการทดสอบแทนการลบตาราง
- การลบ Compose named volume เป็น destructive operation และไม่ใช่ขั้นตอน rollback

รายละเอียด permission, restore, cleanup และแผนจัดการ `attachmentUrl` อยู่ใน [Leave attachment deployment runbook](./docs/leave-attachments-deployment.md)

## MySQL Integration Tests

ชุดทดสอบ concurrency ของสต็อกใช้ MySQL 8 จริงและฐานข้อมูลแยกจากฐานพัฒนา:

```powershell
Copy-Item integration.env.example integration.env
# แก้รหัสผ่านใน integration.env ก่อนรัน
docker compose --env-file integration.env -f docker-compose.integration.yml up -d --wait --force-recreate
npm run test:integration:mysql
docker compose --env-file integration.env -f docker-compose.integration.yml down
```

Runner จะ apply Prisma migrations ก่อนทดสอบ และปฏิเสธ URL ที่ชื่อฐานข้อมูลไม่ได้ลงท้ายด้วย `_integration` หรือ `_test` เพื่อป้องกันการล้างข้อมูลผิดฐาน

## คำสั่งที่ใช้บ่อย

```bash
npm run dev
npm run lint:strict
npm run typecheck
npm run test:run
npm run test:coverage
npm run check
npm run build
npm run start
npm run db:seed
```

## Troubleshooting

### Prisma เชื่อมต่อ MySQL ไม่ได้

- ตรวจว่า `docker compose ps` แสดง MySQL เป็น `healthy`
- ถ้าแอปรันบน host ให้ `DATABASE_URL` ใช้ `127.0.0.1:3308`
- ตรวจว่า user, password และ database ตรงกับ `MYSQL_*`
- รหัสผ่านที่มีอักขระพิเศษต้อง URL-encode ใน `DATABASE_URL`

### Redirect ไป localhost ใน production

ตั้ง `PUBLIC_APPROVE_URL` เป็น public HTTPS origin และตรวจว่า reverse proxy ส่ง `Host`, `X-Forwarded-Host` และ `X-Forwarded-Proto`

### รูปที่อัปโหลดหายหลัง deploy

ตรวจว่า deploy ไม่ได้ลบ `.uploads/`, process มีสิทธิ์อ่าน/เขียน และ shared/persistent storage ถูก mount ที่ project root เดิม

### เปลี่ยน feature flag แล้วหน้าไม่เปลี่ยน

ค่า `NEXT_PUBLIC_*` ต้องตั้งก่อน build จากนั้นรัน `npm run build` และ restart process

## เอกสารอ้างอิง

- [Next.js — Deploying](https://nextjs.org/docs/app/getting-started/deploying)
- [Next.js — Environment Variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Prisma — Deploying database changes](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)
- [Docker Compose CLI](https://docs.docker.com/compose/reference/)

โปรเจกต์นี้เป็นระบบภายในองค์กร ควรจำกัดการเข้าถึง production ด้วย Cloudflare Zero Trust และนโยบายเครือข่ายขององค์กร
