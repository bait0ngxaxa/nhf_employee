# Persistent Storage and Attachments Operations

**สถานะ: CURRENT** — คู่มือปฏิบัติการของ persistent `.uploads/` และ private attachments ทั้ง Leave และ IT; ลำดับ deploy/rollback หลักอยู่ที่ [production runbook](./production-deployment.md)

## Shared production contract

- `.uploads/` ต้องอยู่บน persistent disk และอยู่ใน backup/restore set เดียวกับ MySQL จากช่วงเวลาที่สอดคล้องกัน ห้ามลบระหว่าง deploy/restart
- ให้ Next.js process เดียวที่รันด้วย non-root user และ working directory คงที่เป็นเจ้าของไฟล์; Nginx ห้ามเสิร์ฟหรือ alias `.uploads/private` โดยตรง และการอ่านไฟล์ต้องผ่าน route ที่ตรวจ authentication/authorization ฝั่ง server
- Cloudflare Tunnel ต้องผ่าน Nginx ก่อน Next.js `127.0.0.1:3000`; คง `client_max_body_size 25m;` และ `client_body_timeout 30s;` ตาม configuration ปัจจุบัน ไม่เปิด port 3000 สู่ Internet
- Restore ใน maintenance window: กู้ database และ filesystem จาก backup set เดียวกัน ตรวจ metadata เทียบไฟล์จริงและสิทธิ์อ่านก่อนเปิด traffic; ไฟล์ที่หายต้องกู้จาก backup ไม่สร้าง public copy
- Orphan cleanup ของแต่ละ domain ต้องใช้ external scheduler, secret แยก และ dry-run ก่อนเปิดลบจริง; ห้าม log secret, storage key, path หรือ private bytes
- Production รองรับหนึ่ง Next.js process; shared filesystem อย่างเดียวไม่ทำให้ multi-process/multi-host ปลอดภัย เพราะ rate limiter เป็น process-local. การย้อน application ต้องเข้ากับ forward-only schema และคงตาราง/ไฟล์ไว้

## Leave-specific rules and procedures

## Storage boundary และ permission

- ไฟล์สุดท้ายอยู่ใต้ `.uploads/private/leave/<leaveRequestId>/<random-id>.webp`
- client อ้างอิงเฉพาะ attachment ID และอ่านผ่าน `GET /api/leave/attachments/[attachmentId]` ซึ่งตรวจ session, owner, stored approver หรือ ADMIN ก่อนอ่านไฟล์
- ห้ามสร้าง Nginx `alias`, static location หรือ public URL ให้ `.uploads/private`; proxy ได้เฉพาะ request ไปยัง Next.js route
- สร้าง directory ก่อน start process และให้ owner/group เป็น user เดียวกับ Node.js/PM2 เช่น `app:app` พร้อม permission แบบจำกัด (ตัวอย่าง `0750` สำหรับ directory และ `0640` สำหรับไฟล์)
- ห้ามรัน Node.js เป็น root และอย่าให้ user ของ Nginx มีสิทธิ์เขียน private directory โดยตรง

ตัวอย่างบน Linux (ปรับ user/group และ path ให้ตรงเครื่องจริง):

```bash
sudo install -d -o app -g app -m 0750 /srv/employee_nhf/.uploads/private/leave
sudo chown -R app:app /srv/employee_nhf/.uploads/private
```

## Persistent disk, backup และ restore

`.uploads/private/leave` เป็น stateful data เช่นเดียวกับ `leave_attachments` ใน MySQL ต้องใช้ persistent disk ที่ไม่ถูกลบ
ตอน deploy/restart และต้อง snapshot สองส่วนจากเวลาใกล้เคียงกัน:

1. backup MySQL ก่อน `npx prisma migrate deploy` (รวมตาราง `leave_attachments`)
2. backup `.uploads/private/leave/` ด้วย filesystem snapshot หรือ archive ที่เก็บนอกเครื่อง app
3. ตรวจจำนวนแถว `leave_attachments` และจำนวนไฟล์หลัง backup

Restore ให้หยุด traffic หรือทำ maintenance window, restore database และ directory จาก snapshot เวลาเดียวกัน,
ตรวจว่า `storageKey` ทุกตัวชี้ไปยังไฟล์ที่มีอยู่ และตรวจ endpoint ด้วย owner/approver test ก่อนเปิด traffic
หากไฟล์จริงหาย ระบบตอบ 404 แบบปลอดภัยและไม่คืน path ภายใน; ให้กู้จาก backup แทนการสร้าง public copy

## Reverse proxy และ process supervisor

คำขอ multipart มีไฟล์รวมได้ 20 MB และ overhead ของ multipart จึงต้องตั้ง body limit อย่างน้อย:

```nginx
client_max_body_size 25m;
client_body_timeout 30s;
```

ค่าใน `deployment/nginx/employee_nhf.cloudflare-origin.conf` ใช้ 25m แล้ว ห้ามลดต่ำกว่า 20 MB หรือเพิ่มโดยไม่พิจารณา
memory/abuse budget และต้องไม่มี static location สำหรับ `.uploads/private` ตัวอย่าง deployment ปัจจุบันคือ
Cloudflare → Nginx → Next.js `127.0.0.1:3000` → MySQL และ local persistent disk

ให้ firewall/Cloudflare เปิดถึง Nginx เท่านั้นและ bind Next.js ไว้ที่ loopback; การเปิด port 3000 ตรงสู่ Internet
จะข้าม body-size/body-timeout controls ของ Nginx และไม่ใช่ deployment ที่รองรับใน phase นี้. L2 รองรับ
หนึ่ง Next.js production process เท่านั้น; PM2 cluster, หลาย process หลัง Nginx และหลาย host ยังไม่รองรับ
เพราะ application rate-limit state เป็น process-local และไม่ survive process restart

PM2/systemd ต้อง:

- ตั้ง working directory เป็น project root เพื่อให้ `.uploads/private` อยู่ตำแหน่งเดียวกับ storage service
- โหลด environment production รวม `LEAVE_ATTACHMENT_CLEANUP_SECRET`
- รันด้วย non-root user ที่อ่าน/เขียน `.uploads/private/leave` ได้
- restart เมื่อ process ล้มเหลวหรือเครื่อง reboot โดยไม่ลบ directory

## Request size และ memory limitation

server ใช้ `Content-Length` เป็นเพียง fast path แล้วอ่าน stream ของ multipart แบบจำกัดไม่เกิน 25 MB ก่อนสร้าง
`FormData`; body ที่ไม่มีหรือมี `Content-Length` ไม่ถูกต้องจึงยังถูกปฏิเสธด้วย 413 โดยไม่พึ่ง header อย่างเดียว
Next.js/undici ยัง buffer body ที่ถูกจำกัดแล้วใน memory ระหว่าง `formData()` และรองรับเฉพาะ JPG, PNG, WEBP
จึงยังไม่ใช่ streaming multipart parser เต็มรูปแบบ: Nginx limit, rate limit, จำนวนไฟล์สูงสุด 3, ขนาดไฟล์ 8 MB
และขนาดรวม 20 MB ยังคงเป็น defense-in-depth และ deployment boundary ที่ต้องตรวจใน Phase 5B หากต้องรองรับ
concurrent upload สูงมากให้ย้ายไป streaming/object storage ใน phase ถัดไป

## Orphan cleanup

ระหว่าง request ไฟล์ถูกเขียนก่อน Serializable transaction เพื่อไม่ให้ Sharp/filesystem อยู่ใน transaction หาก
business validation หรือ transaction ล้มเหลว route ลบไฟล์ที่เขียนใน request นั้นด้วย `Promise.allSettled` แต่ process
crash อาจทิ้งไฟล์ไว้ได้ จึงมี protected maintenance route:

```text
POST /api/leave/attachments/cleanup?dryRun=true
POST /api/leave/attachments/cleanup
x-cleanup-secret: $LEAVE_ATTACHMENT_CLEANUP_SECRET
```

job scan เฉพาะ `.uploads/private/leave`, query `storageKey` จาก `leave_attachments` ครั้งเดียว, และลบเฉพาะไฟล์
ชื่อที่อยู่ในรูปแบบที่ service สร้างและเก่ากว่า safety window 24 ชั่วโมง ไฟล์ใหม่กว่าจะถูกข้ามเพื่อป้องกันลบไฟล์
ของ request ที่ยังไม่ commit มี `dryRun=true` สำหรับตรวจจำนวนก่อนลบ และ response/log ไม่คืน storage key, filename
หรือ absolute path ห้าม expose route นี้โดยไม่มี secret และควรรันจาก external scheduler วันละครั้ง

cleanup ปัจจุบันอ่านรายการ metadata และ candidate files ของ private leave directory ใน process memory หนึ่งรอบ
จึงควรรันนอกช่วง peak และติดตามจำนวนไฟล์/disk usage; หากข้อมูลโตจนไม่เหมาะสมให้เปลี่ยนเป็น paginated scanner
หรือ object-storage lifecycle ก่อน scale ต่อ

ตัวอย่าง cron:

```cron
45 2 * * * curl --fail --silent --show-error --request POST --header "x-cleanup-secret: $LEAVE_ATTACHMENT_CLEANUP_SECRET" "$APP_BASE_URL/api/leave/attachments/cleanup?dryRun=true"
0 3 * * * curl --fail --silent --show-error --request POST --header "x-cleanup-secret: $LEAVE_ATTACHMENT_CLEANUP_SECRET" "$APP_BASE_URL/api/leave/attachments/cleanup"
```

## Multi-instance และ rollback

ในเชิง storage การเก็บไฟล์แบบ local disk รองรับ single instance หรือหลาย instance ที่ mount shared filesystem เดียวกันและมี
permission/locking ที่สอดคล้องกันเท่านั้น แต่ full production deployment ของ L2 ยังรองรับหนึ่ง app process เท่านั้น
หากใช้หลายเครื่องโดยไม่มี shared disk ให้ย้าย service ไป object storage
ที่มี private bucket และ authorization policy ก่อน scale out; แต่ shared disk อย่างเดียวไม่เพียงพอสำหรับ L2
rate-limit state. ต้องออกแบบ shared atomic limiter, failure policy และ integration tests ก่อนเปิด cluster/multi-host;
phase นี้ยังไม่รองรับ object storage หรือ PDF

Migration เพิ่ม `leave_attachments` เป็น additive และยังคง `LeaveRequest.attachmentUrl` เป็น legacy field อยู่ การ
rollback application หลัง `migrate deploy` ให้รัน build รุ่นก่อนบน schema ที่มีตารางเพิ่มได้ (รุ่นก่อนจะไม่อ่านตารางนี้)
และเก็บไฟล์/metadata ไว้ ห้าม drop ตารางหรือย้อน migration ด้วยคำสั่ง destructive; หากจำเป็นต้องเปลี่ยน schema ให้
สร้าง forward migration ใหม่และทดสอบกับสำเนา production

## Legacy `attachmentUrl` cleanup plan

การค้นหา source ปัจจุบันยืนยันว่า code ใหม่ไม่เขียน `attachmentUrl`; พบ field ใน Prisma schema, migration เดิม และ
fixture/test ที่จำลองข้อมูลเดิมเท่านั้น ก่อนลบในอนาคตต้อง:

1. ตรวจ production rows และรูปแบบ URL เดิมทั้งหมด
2. ทำ data migration/ย้ายไฟล์เดิมเป็น `LeaveAttachment` หาก policy ยังต้องเก็บ
3. ตรวจ client/report/export ที่อาจพึ่ง field นี้ใน production build และ backup ข้อมูล
4. deploy migration ลบ column แยกต่างหากหลังยืนยันว่าไม่มีข้อมูลที่ต้องย้าย และทดสอบ rollback plan

## Privacy, authorization และ observability

attachment endpoint ใช้ `Cache-Control: private, no-store`, `Content-Disposition: inline` และ `X-Content-Type-Options:
nosniff`; list APIs ส่งเฉพาะ summary และไม่ส่ง binary/storage key notification หรือ email/LINE ไม่แนบไฟล์
สำหรับ audit การสร้างคำขอที่เกี่ยวกับ attachment metadata จะเก็บเพียง leave request ID, actor, action, timestamp
และ attachment count; audit action เดิมของ approval/cancel ยังรักษา status ตาม flow เดิม ห้าม log buffer, base64,
original filename, storage key, absolute path หรือเนื้อหาเอกสาร

authorization matrix ที่ต้องคงไว้:

| ผู้ใช้ | เปิดไฟล์ได้ |
| --- | --- |
| employee เจ้าของคำขอ | ได้ |
| approver ID ที่ snapshot ตอนสร้างคำขอ | ได้ แม้เปลี่ยน manager ภายหลัง |
| ADMIN | ได้ |
| employee อื่น/manager คนใหม่ | ไม่ได้ และตอบ 404 แบบ concealment |
| ไม่มี session | ไม่ได้ |

## IT-specific rules and procedures

## Storage boundary

- ไฟล์อยู่ใต้ `.uploads/private/it/<ticketId>/<random-id>.webp` โดย `<random-id>` เป็น hexadecimal 32 ตัวที่ระบบสุ่มสร้าง
- Database เก็บ storage key; client ได้เฉพาะ attachment ID และอ่านผ่าน `GET /api/it/attachments/[attachmentId]`
- ห้ามเพิ่ม Nginx alias, static route, public URL หรือ `/api/uploads/**` สำหรับ `.uploads/private`
- IT attachment storage เป็น adapter ของ IT เองและไม่ใช้ Leave business/storage code
- Node.js/PM2 ต้องใช้ working directory เดิมเสมอ เพราะ storage root resolve จาก project working directory
- ห้ามรัน Node.js เป็น root; ให้ process มีสิทธิ์อ่าน/เขียน IT directory เท่านั้นตาม deployment policy

ตัวอย่าง Linux (ปรับ root/user/group ให้ตรง production):

```bash
sudo install -d -o app -g app -m 0750 /srv/employee_nhf/.uploads/private/it
```

Node สร้าง directory ของ Ticket ด้วย mode `0750` และสร้าง file ด้วย mode `0640` และ exclusive create ภายใต้ owner/group ของ process

## Request boundary และ reverse proxy

ไฟล์ที่รับได้คือ JPG/JPEG, PNG และ WEBP เท่านั้น ระบบ decode เนื้อหาจริง, จำกัด input 8 MiB/file, 3 files/comment, 20 MiB รวม, 40 ล้าน decoded pixels และ resize/แปลงเป็น WEBP ก่อนเขียนไฟล์ถาวร

Nginx ใน `deployment/nginx/employee_nhf.cloudflare-origin.conf` ตั้ง `client_max_body_size 25m` และ `client_body_timeout 30s` อยู่แล้ว ไม่ต้องเพิ่มค่า body limit สำหรับ IT5B แอปอ่าน request stream แบบจำกัด 25,000,000 bytes ก่อน parse multipart; Content-Length ใช้ปฏิเสธเร็วเท่านั้นและไม่แทนการนับ bytes จริง

อย่า expose `.uploads/private` ผ่าน Nginx หรือ static hosting การอ่านภาพต้องผ่าน authenticated Next.js route ซึ่งตรวจ active workforce และสิทธิ์ Ticket ปัจจุบัน แล้วตอบเฉพาะ `image/webp`, `private, no-store`, `nosniff` และ `inline`

Rate limiter ใช้ shared mutation-rate-limit implementation แบบ process-local: multipart IT pre-auth IP 60 requests/15 นาที และ authenticated principal 10 requests/นาที จึงไม่กระจายข้ามหลาย process/host และไม่คงอยู่หลัง restart ห้ามถือว่า IT5B รองรับหลาย application hosts ที่ใช้ local disk

## Persistent data, backup และ restore

`.uploads/private/it/` เป็น stateful persistent data เช่นเดียวกับ `it_ticket_attachments` ใน MySQL ต้องสำรองทั้งสองส่วนจากจุดเวลาที่สอดคล้องกัน:

1. MySQL backup ต้องรวม Ticket, comments, idempotency records และ `it_ticket_attachments`
2. filesystem backup ต้องรวม `.uploads/private/it/`
3. เก็บ backup นอกเครื่อง app และตรวจจำนวน metadata/files หลัง backup ตาม runbook ของระบบ

Restore ให้หยุด traffic หรือใช้ maintenance window แล้วกู้ MySQL และ private IT directory จาก backup set เดียวกัน ตรวจ storage keys กับไฟล์จริงก่อนเปิดรับคำขอ ไฟล์ที่ metadata มีแต่ไฟล์จริงหายจะตอบ 404 อย่างปลอดภัย; กู้ไฟล์จาก backup แทนการสร้าง public copy

อย่าใส่ private image bytes ใน Git, Docker image, logs, database blobs, Audit payloads, Notification, email หรือ LINE

## Orphan cleanup

ไฟล์ถูกเขียนก่อน transaction เพื่อไม่ให้ decode/เขียนไฟล์ขนาดใหญ่ระหว่างถือ DB transaction ความล้มเหลวปกติจะลบเฉพาะไฟล์ที่ request นั้นสร้าง; process crash อาจทิ้ง orphan ไว้ จึงมี maintenance route ที่รับเฉพาะ secret `IT_ATTACHMENT_CLEANUP_SECRET`:

```text
POST /api/it/attachments/cleanup?dryRun=true
POST /api/it/attachments/cleanup
x-cleanup-secret: <secret จาก secret manager>
```

เก็บ secret ใน secret manager หรือ environment ของ scheduler/runtime เท่านั้น ห้าม commit ค่า secret ลง repository ค่า secret หายทำให้ route ตอบ 503 และค่าไม่ตรงตอบ 403 `dryRun` ยอมรับเฉพาะค่าเดียว `true` หรือ `false`; default คือโหมดลบ

Cleanup สแกนเฉพาะ `.uploads/private/it`, ตรวจ storage-key/file-name รูปแบบเข้มงวด, เทียบกับ storage keys ที่ commit ใน MySQL และลบเฉพาะ orphan ที่เก่ากว่า 24 ชั่วโมง ไฟล์ใหม่กว่าถูกข้าม Dry run ไม่ลบไฟล์ ผลลัพธ์เป็นจำนวนรวมเท่านั้น ไม่คืนชื่อไฟล์/key/path และไม่ scan/delete Leave หรือ Stock files

ตัวอย่าง cron จากเครื่อง scheduler ภายนอก (เก็บ `IT_ATTACHMENT_CLEANUP_SECRET` และ `APP_BASE_URL` ใน environment ของ job):

```cron
45 2 * * * curl --fail --silent --show-error --request POST --header "x-cleanup-secret: $IT_ATTACHMENT_CLEANUP_SECRET" "$APP_BASE_URL/api/it/attachments/cleanup?dryRun=true"
0 3 * * * curl --fail --silent --show-error --request POST --header "x-cleanup-secret: $IT_ATTACHMENT_CLEANUP_SECRET" "$APP_BASE_URL/api/it/attachments/cleanup"
```

Committed attachment ไม่มี application delete หรือ age-based cleanup ใน IT5B; เก็บพร้อม Ticket history จนกว่าจะมี policy ที่อนุมัติใน IT9 ไม่มีการกำหนด retention duration ใน IT5B

## Deployment topology และ rollback

Deployment ที่รองรับใน IT5B ใช้ local persistent disk และ working directory คงที่ของ Node/PM2 process เดียวกันกับที่เขียนไฟล์ การ deploy/restart ต้องไม่ลบ `.uploads/private/it` และ Node process ต้องมี read/write permission ตามข้างต้น

หากอนาคตต้องใช้ application หลาย hosts ต้องย้ายไป shared filesystem หรือ private object storage และกำหนดการสำรอง/authorization ให้สอดคล้องก่อนเปิดใช้งาน IT attachments บนหลาย hosts; object storage เช่น R2/S3 ไม่ได้อยู่ใน IT5B

Migration `20260925120000_it5b_private_ticket_attachments` เป็น additive รุ่น application เก่าที่ไม่รู้จัก table ใหม่อาจเพิกเฉยต่อ metadata/files ได้ การ rollback ให้คง table และ private files ไว้ ห้าม drop table หรือลบไฟล์; schema เปลี่ยนในอนาคตให้ใช้ forward migration
