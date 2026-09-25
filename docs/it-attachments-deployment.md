# IT Ticket attachment deployment runbook

คู่มือนี้ใช้กับ IT5B private Ticket image attachments บน deployment ที่ใช้ local persistent disk

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
