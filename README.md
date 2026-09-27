# Employee Management System (NHF)

ระบบจัดการพนักงานของมูลนิธิสาธารณสุขแห่งชาติ ครอบคลุมข้อมูลบุคลากร การลา สต็อก งานประจำ คำร้อง IT และการแจ้งเตือนในระบบ, Email และ LINE

**คู่มือ production หลัก:** [Production Deployment & LIFF Runbook](./docs/operations/production-deployment.md). ใช้คู่กับ [production acceptance](./docs/operations/production-acceptance.md) สำหรับแต่ละ release

## เทคโนโลยี

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, MySQL 8, Prisma 6, Nodemailer, LINE Messaging API, Sharp และ Vitest

## เริ่มพัฒนาในเครื่อง

ต้องมี Node.js >= 20.9.0, npm และ Docker Engine พร้อม Docker Compose plugin. คัดลอก `.env.example` เป็น `.env` แล้วตั้งค่ารหัสผ่าน/secret สำหรับเครื่องพัฒนา; อย่า commit `.env`. Compose รัน MySQL เท่านั้น และแอปรันบน host

```bash
npm ci
docker compose config --quiet
docker compose up -d --wait
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

เปิด `http://localhost:3000`. สำหรับ Windows PowerShell ใช้ `Copy-Item .env.example .env`; สำหรับ Bash ใช้ `cp .env.example .env` ก่อนรันคำสั่งข้างต้น

## ตรวจสอบการเปลี่ยนแปลง

```bash
npm run architecture:check
npm run lint:strict
npm run typecheck
npm run test -- path/to/relevant.test.ts
```

ระบุ path ของ test ระหว่างพัฒนา; full suite `npm run test` ใช้เมื่อ scope ของ release คุ้มกับการตรวจทั้ง repository

## เอกสาร

- [ดัชนีเอกสาร](./docs/README.md)
- [Production deployment และ LIFF rollout](./docs/operations/production-deployment.md)
- [Production acceptance](./docs/operations/production-acceptance.md)
- [Storage และ attachments](./docs/operations/storage-and-attachments.md)
- [Cloudflare Tunnel](./docs/operations/cloudflare-tunnel.md)
- [Notification architecture](./docs/integrations/notifications.md)
- [Product](./PRODUCT.md), [Context](./CONTEXT.md) และ [Design](./DESIGN.md)
