# Employee & IT Management System (NHF)

ระบบจัดการข้อมูลพนักงานและงานบริการด้านไอทีสำหรับมูลนิธิสาธารณสุขแห่งชาติ (National Health Foundation - NHF)

## MySQL Integration Tests

ชุดทดสอบ concurrency ของสต็อกใช้ MySQL 8 จริงและฐานข้อมูลแยกจากฐานพัฒนา

```powershell
Copy-Item integration.env.example integration.env
# แก้รหัสผ่านใน integration.env ก่อนรัน
docker compose --env-file integration.env -f docker-compose.integration.yml up -d --wait --force-recreate
npm run test:integration:mysql
docker compose --env-file integration.env -f docker-compose.integration.yml down
```

คำสั่งทดสอบจะรัน Prisma migrations ก่อนเสมอ และปฏิเสธ URL ที่ชื่อฐานข้อมูลไม่ได้ลงท้ายด้วย
`_integration` หรือ `_test` เพื่อป้องกันการล้างข้อมูลผิดฐาน

## ภาพรวม

ระบบนี้รวมงานหลัก 2 ส่วนไว้ในที่เดียว

1. `Employee Directory`
- จัดการข้อมูลพนักงาน
- ค้นหา กรอง และอัปเดตข้อมูลได้สะดวก
- รองรับการดูข้อมูลแผนกและสถานะการทำงาน

2. `IT Support Ticket`
- แจ้งปัญหาด้านไอที
- ติดตามสถานะการแก้ไข
- สื่อสารกับทีมไอทีได้จากในระบบ

## คุณสมบัติหลัก

### Employee Management
- ค้นหาและกรองรายชื่อพนักงาน
- จัดการข้อมูลส่วนตัว แผนก และตำแหน่ง
- รองรับการนำเข้าและส่งออกข้อมูลด้วยไฟล์ CSV

### IT Service Desk
- แจ้งปัญหาพร้อมกำหนดความเร่งด่วนและประเภทงาน
- ติดตามสถานะงาน เช่น `Open`, `In Progress`, `Resolved`
- แจ้งเตือนผ่าน Email และ LINE เมื่อมีความคืบหน้า

### Dashboard
- สรุปภาพรวมข้อมูลสำคัญของระบบ
- แยกสิทธิ์การเข้าถึงระหว่าง `User` และ `Admin`

### Security
- มีระบบยืนยันตัวตน
- ควบคุมสิทธิ์ด้วย Role-based Access Control

## เทคโนโลยีหลัก

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: Next.js API Routes / Server Actions
- Database: MySQL, Prisma ORM
- Integration: Nodemailer, LINE Messaging API

## เริ่มต้นใช้งาน

1. สร้างไฟล์ `.env` จาก `.env.example` แล้วใส่ค่าจริงของระบบ
2. ติดตั้ง dependencies

```bash
npm ci
```

3. สร้าง Prisma Client และ apply migrations

```bash
npx prisma generate
npx prisma migrate deploy
```

4. Seed ข้อมูลเริ่มต้นถ้าจำเป็น

```bash
npm run db:seed
```

5. รันระบบสำหรับพัฒนา

```bash
npm run dev
```

## คำสั่งที่ใช้บ่อย

```bash
npm run dev
npm run build
npm run start
npm run lint:strict
npm run typecheck
npm run test:run
npm run check
```

## Quality Gate

ก่อน merge ควรให้คำสั่งต่อไปนี้ผ่านทั้งหมด

```bash
npm run check
```

คำสั่งนี้จะรันตามลำดับ:

- `lint:strict`
- `typecheck`
- `test:run`

หากระบบอยู่หลัง reverse proxy หรือ Cloudflare ให้ตั้ง `PUBLIC_APPROVE_URL` เป็น public URL จริงของระบบ เช่น `https://approve.example.com`

## Maintenance

ตั้งค่า cron ภายนอกให้เรียก `POST /api/audit-logs/cleanup` วันละครั้งพร้อม header `x-cleanup-secret` ที่ตรงกับ `AUDIT_LOG_CLEANUP_SECRET` เพื่อให้ระบบลบ `บันทึกการใช้งาน` ที่เก่ากว่า 90 วันออกจากฐานข้อมูล

ตั้งค่า scheduled worker ให้เรียก `POST /api/cron/notification-outbox` ทุก 1 นาที พร้อม header `x-outbox-secret` ที่ตรงกับ `NOTIFICATION_OUTBOX_CRON_SECRET` เพื่อประมวลผล notification outbox โดยไม่ต้องรอ request จากผู้ใช้ ตัวอย่าง crontab:

```cron
* * * * * curl --fail --silent --show-error --request POST --header "x-outbox-secret: $NOTIFICATION_OUTBOX_CRON_SECRET" "$APP_BASE_URL/api/cron/notification-outbox"
```

Worker จะลองส่งสูงสุด 3 ครั้ง โดย retry หลังความล้มเหลวครั้งแรกและครั้งที่สองด้วย exponential backoff 1 และ 2 นาที รายการที่ยังล้มเหลวหลังครั้งที่ 3 จะเปลี่ยนเป็น `DEAD` และไม่ถูกส่งซ้ำอัตโนมัติ

## หมายเหตุ

โปรเจกต์นี้พัฒนาสำหรับการใช้งานภายในองค์กร และมีการขยายโมดูลเพิ่มเติมต่อเนื่อง เช่น ระบบลา ระบบสต็อก และระบบแจ้งเตือน
