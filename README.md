# Employee & IT Management System (NHF)

ระบบจัดการข้อมูลพนักงานและงานบริการด้านไอทีสำหรับมูลนิธิสาธารณสุขแห่งชาติ (National Health Foundation - NHF)

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

หากระบบอยู่หลัง reverse proxy หรือ Cloudflare ให้ตั้ง `NEXTAUTH_URL` และ `PUBLIC_APPROVE_URL` เป็น public URL จริงของระบบ เช่น `https://approve.example.com`

## หมายเหตุ

โปรเจกต์นี้พัฒนาสำหรับการใช้งานภายในองค์กร และมีการขยายโมดูลเพิ่มเติมต่อเนื่อง เช่น ระบบลา ระบบสต็อก และระบบแจ้งเตือน
