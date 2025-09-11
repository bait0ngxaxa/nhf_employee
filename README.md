# Employee & IT Management System (NHF)

ระบบจัดการพนักงานและ IT Support สำหรับองค์กร Northern Hill Foundation (NHF) ที่พัฒนาด้วย Next.js และ TypeScript

## 📋 คุณสมบัติหลัก

### 🧑‍💼 การจัดการพนักงาน
- ✅ เพิ่ม แก้ไข ลบข้อมูลพนักงาน
- ✅ จัดการสถานะพนักงาน (ทำงานอยู่, ไม่ทำงาน, ถูกระงับ)
- ✅ อัปโหลด/ดาวน์โหลดข้อมูลพนักงานผ่าน CSV
- ✅ ค้นหาและกรองข้อมูลพนักงาน
- ✅ แบ่งหน้าแสดงผล (Pagination)
- ✅ จัดการแผนกและสังกัด

### 🎫 ระบบ IT Support Ticket
- ✅ แจ้งปัญหา IT ตามหมวดหมู่ (ฮาร์ดแวร์, ซอฟต์แวร์, เครือข่าย, etc.)
- ✅ จัดการระดับความสำคัญ (ต่ำ, ปานกลาง, สูง, เร่งด่วน)
- ✅ ติดตามสถานะงาน (เปิด, กำลังดำเนินการ, แก้ไขแล้ว, ปิด)
- ✅ ระบบความคิดเห็น (Comments)
- ✅ การแจ้งเตือนทางอีเมล
- ✅ มอบหมายงานให้ทีม IT

### 🔐 ระบบสิทธิ์และการยืนยันตัวตน
- ✅ ล็อกอิน/สมัครสมาชิกด้วยอีเมล
- ✅ บทบาทผู้ใช้ (USER, ADMIN)
- ✅ ป้องกันเส้นทาง (Route Protection)
- ✅ การจัดการเซสชัน

### 📊 แดชบอร์ด
- ✅ ภาพรวมสถิติระบบ
- ✅ การนำทางแบบ Sidebar
- ✅ เมนูตามสิทธิ์ผู้ใช้

## 🛠 เทคโนโลยีที่ใช้

### Frontend
- **Next.js 15.5.2** - React Framework with App Router
- **React 19.1.0** - UI Library
- **TypeScript 5** - Type Safety
- **Tailwind CSS 4** - Utility-first CSS Framework
- **Radix UI** - Accessible UI Components
- **Lucide React** - Icon Library

### Backend
- **Next.js API Routes** - Serverless Functions
- **Prisma ORM 6.15.0** - Database ORM
- **NextAuth.js 4.24.11** - Authentication
- **bcryptjs** - Password Hashing
- **Nodemailer** - Email Service

### Database
- **MySQL** - Primary Database
- **Prisma Client** - Database Access

### Development Tools
- **ESLint** - Code Linting
- **TypeScript** - Static Type Checking
- **Turbopack** - Build Optimization

## 📦 การติดตั้ง

### ความต้องการของระบบ
- Node.js (compatible with Next.js 15)
- npm/yarn/pnpm
- MySQL Database

### ขั้นตอนการติดตั้ง

1. **Clone Repository**
```bash
git clone <repository-url>
cd employee_nhf
```

2. **ติดตั้ง Dependencies**
```bash
npm install
# หรือ
yarn install
```

3. **ตั้งค่า Environment Variables**
สร้างไฟล์ `.env` และกำหนดค่าต่อไปนี้:
```env
# Database
DATABASE_URL="mysql://username:password@localhost:3306/nhf_employee"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
IT_TEAM_EMAIL="it-team@yourorg.com"
```

4. **ตั้งค่าฐานข้อมูล**
```bash
# Generate Prisma Client
npx prisma generate

# Run Database Migrations
npx prisma migrate dev

# Seed Initial Data (optional)
npm run db:seed
```

5. **เรียกใช้งาน Development Server**
```bash
npm run dev
```

เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

## 🏗 โครงสร้างโปรเจค

```
employee_nhf/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── auth/          # Authentication APIs
│   │   ├── employees/     # Employee Management APIs
│   │   ├── tickets/       # Ticket System APIs
│   │   └── departments/   # Department APIs
│   ├── dashboard/         # Dashboard Pages
│   ├── login/            # Login Page
│   └── signup/           # Signup Page
├── components/            # Reusable UI Components
│   ├── ui/               # Base UI Components
│   ├── forms/            # Form Components
│   └── modals/           # Modal Components
├── lib/                  # Utility Libraries
│   ├── auth.ts          # Auth Configuration
│   ├── prisma.ts        # Database Connection
│   └── email.ts         # Email Service
├── prisma/              # Database Schema & Migrations
│   ├── schema.prisma    # Database Schema
│   ├── migrations/      # Migration Files
│   └── seed.ts         # Seed Data
├── types/               # TypeScript Type Definitions
└── public/             # Static Assets
```

## 🗄 โครงสร้างฐานข้อมูล

### ตารางหลัก
- **users** - ข้อมูลผู้ใช้และการยืนยันตัวตน
- **employees** - ข้อมูลพนักงาน
- **departments** - ข้อมูลแผนก
- **tickets** - ข้อมูล IT Support Ticket
- **ticket_comments** - ความคิดเห็นในตั๋ว
- **ticket_views** - การดูตั๋วของผู้ใช้

### ความสัมพันธ์
- Employee ↔ Department (Many-to-One)
- User ↔ Employee (One-to-One)
- Ticket ↔ User (Many-to-One for reporter and assignee)
- Ticket ↔ TicketComment (One-to-Many)
- Ticket ↔ TicketView (One-to-Many)

## 🚀 การ Deploy

### การเตรียมการ Production
```bash
# Build Application
npm run build

# Start Production Server
npm start
```

### Vercel Deployment (แนะนำ)
1. Push โค้ดไปยัง GitHub Repository
2. เชื่อมต่อ Repository กับ Vercel
3. ตั้งค่า Environment Variables ใน Vercel Dashboard
4. Deploy จะทำอัตโนมัติ

## 📧 การตั้งค่าอีเมล

ระบบใช้ Gmail SMTP สำหรับส่งอีเมลแจ้งเตือน:
1. เปิดใช้ 2-Factor Authentication ในบัญชี Gmail
2. สร้าง App Password
3. ใส่ App Password ในตัวแปรสภาพแวดล้อม `SMTP_PASS`

## 🧪 การทดสอบ

```bash
# Test Email Configuration
npm run test:email

# Run Linting
npm run lint
```

## 🔧 การใช้งาน API

### Employee Management
- `GET /api/employees` - ดึงรายชื่อพนักงาน
- `POST /api/employees` - เพิ่มพนักงานใหม่
- `PATCH /api/employees/[id]` - แก้ไขข้อมูลพนักงาน
- `DELETE /api/employees/[id]` - ลบพนักงาน
- `POST /api/employees/import` - นำเข้าข้อมูลจาก CSV

### Ticket System
- `GET /api/tickets` - ดึงรายการตั๋ว
- `POST /api/tickets` - สร้างตั๋วใหม่
- `GET /api/tickets/[id]` - ดูรายละเอียดตั๋ว
- `PATCH /api/tickets/[id]` - อัปเดตตั๋ว
- `POST /api/tickets/[id]/comments` - เพิ่มความคิดเห็น

### Authentication
- `POST /api/auth/signin` - เข้าสู่ระบบ
- `POST /api/auth/signout` - ออกจากระบบ
- `POST /api/signup` - สมัครสมาชิก

## 👥 บทบาทผู้ใช้

### USER (ผู้ใช้ทั่วไป)
- ดูข้อมูลพนักงาน (อ่านอย่างเดียว)
- สร้างและดู IT Support Ticket ของตนเอง
- แสดงความคิดเห็นในตั๋วของตนเอง

### ADMIN (ผู้ดูแลระบบ)
- จัดการข้อมูลพนักงานทั้งหมด
- นำเข้า/ส่งออกข้อมูล CSV
- จัดการ IT Support Ticket ทั้งหมด
- มอบหมายงานให้ทีม IT
- ดูสถิติและรายงานระบบ

## 🔒 ความปลอดภัย

- รหัสผ่านเข้ารหัสด้วย bcrypt
- Session-based Authentication
- CSRF Protection
- Role-based Access Control
- Input Validation & Sanitization

## 📝 การสนับสนุน

หากพบปัญหาหรือต้องการความช่วยเหลือ:
1. ตรวจสอบ Console สำหรับข้อผิดพลาด
2. ตรวจสอบการตั้งค่า Environment Variables
3. ตรวจสอบการเชื่อมต่อฐานข้อมูล
4. ตรวจสอบ Log Files

## 📄 License

This project is private and proprietary to National Health Foundation.

---

**พัฒนาโดย:** IT Team, National Health Foundation  
**เวอร์ชัน:** 0.1.0  
**อัปเดตล่าสุด:** 2025
