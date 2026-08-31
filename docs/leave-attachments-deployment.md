# Leave attachment deployment runbook

เอกสารนี้ครอบคลุม private leave evidence ที่เก็บด้วย Phase 1–5 และใช้คู่กับ `README.md` ใน production
deployment ของ repository นี้

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
จะข้าม body-size/body-timeout controls ของ Nginx และไม่ใช่ deployment ที่รองรับใน phase นี้

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

การเก็บไฟล์แบบ local disk รองรับ single instance หรือหลาย instance ที่ mount shared filesystem เดียวกันและมี
permission/locking ที่สอดคล้องกันเท่านั้น หากใช้หลายเครื่องโดยไม่มี shared disk ให้ย้าย service ไป object storage
ที่มี private bucket และ authorization policy ก่อน scale out; phase นี้ยังไม่รองรับ object storage หรือ PDF

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
