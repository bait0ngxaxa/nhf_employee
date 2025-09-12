# LINE Messaging API Setup Guide

## 📱 ภาพรวม
ระบบ NHF IT Support ใช้ LINE Messaging API สำหรับการแจ้งเตือน! ผู้ใช้จะได้รับการแจ้งเตือนทั้งทาง Email และ LINE เมื่อ:
- สร้าง ticket ใหม่ (ยืนยันการสร้าง)
- อัพเดทสถานะ ticket
- ticket ความสำคัญสูง/เร่งด่วน (แจ้งทีม IT)

## 🚀 วิธีการตั้งค่า

### 1. LINE Messaging API (สำหรับ LINE Official Account)

#### ขั้นตอนการสร้าง LINE Official Account:
1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. ล็อกอินด้วยบัญชี LINE Business Account
3. สร้าง Provider ใหม่ (หรือเลือกที่มีอยู่)
4. คลิก **"Create Channel"** → เลือก **"Messaging API"**
5. กรอกข้อมูล Channel:
   - **Channel name**: "NHF IT Support"
   - **Channel description**: "ระบบแจ้งเตือน IT Support"
   - **Category**: "IT/Technology"
   - **Subcategory**: เลือกตามความเหมาะสม
6. อ่านและยอมรับ Terms of Use
7. คลิก **"Create"**

#### การตั้งค่า Channel:
1. ไปที่แท็บ **"Messaging API"**
2. ในส่วน **"Channel Access Token"**:
   - คลิก **"Issue"** เพื่อสร้าง Token
   - **คัดลอก Token** มาใส่ใน `.env.local`:
   ```env
   LINE_CHANNEL_ACCESS_TOKEN="ใส่_token_ตรงนี้"
   ```

3. ในส่วน **"Webhook Settings"**:
   - เปิดใช้งาน **"Use webhook"**
   - ใส่ Webhook URL (ถ้ามี):
   ```env
   LINE_WEBHOOK_URL="https://your-domain.com/api/line/webhook"
   ```

### 2. การหา User ID สำหรับส่งข้อความ

#### วิธีที่ 1: ใช้ Broadcast (ส่งให้ผู้ติดตาม OA ทั้งหมด)
- ไม่ต้องตั้ง `LINE_IT_TEAM_USER_ID`
- ระบบจะใช้ Broadcast API แทน

#### วิธีที่ 2: ส่งให้ User เฉพาะ (แนะนำ)
1. ให้ทีม IT Add LINE OA เป็นเพื่อน
2. ส่งข้อความใดๆ ไปยัง OA
3. ดู User ID จาก Webhook events
4. ใส่ User ID ใน `.env.local`:
   ```env
   LINE_IT_TEAM_USER_ID="U1234567890abcdef1234567890abcdef"
   ```

## 🧪 การทดสอบ

### ทดสอบ LINE Messaging API:
```bash
npm run test:line
```

### ทดสอบทั้งระบบ (Email + LINE):
```bash
npm run test:notifications
```

### ทดสอบเฉพาะ Email:
```bash
npm run email:diagnostic
```

## 📋 ตัวอย่างข้อความ LINE แบบ Flex Message

### 🎫 Ticket ใหม่:
ข้อความจะแสดงเป็น Flex Message ที่สวยงาม พร้อม:
- หัวข้อสีฟ้า และ หมายเลข Ticket
- รายละเอียดครบถ้วน
- ปุ่มลิ้งค์ไปยังระบบ
- โทนสีตามความสำคัญ

### 🔄 อัพเดทสถานะ:
แสดงการเปลี่ยนสถานะแบบชัดเจน พร้อมลูกศร

## 🔧 การแก้ปัญหา

### LINE Messaging API ส่งไม่ได้:
- ตรวจสอบ `LINE_CHANNEL_ACCESS_TOKEN` ใน `.env.local`
- ตรวจสอบว่า Token ยังไม่หมดอายุ
- ลองสร้าง Token ใหม่

### LINE Webhook ไม่ทำงาน:
- ตรวจสอบ `LINE_WEBHOOK_URL` ใน `.env.local`
- ตรวจสอบว่า URL สามารถเข้าถึงได้จากภายนอก
- ตรวจสอบ SSL Certificate (ต้องเป็น HTTPS)

### ไม่ได้รับการแจ้งเตือน:
- รันคำสั่ง `npm run test:notifications` เพื่อทดสอบ
- ตรวจสอบ console log ในระบบ
- ตรวจสอบว่าทั้ง Email และ LINE settings ถูกต้อง

## 📝 หมายเหตุ

- **LINE Messaging API** เหมาะสำหรับ LINE Official Account ที่ต้องการ rich content และ interactive features
- **LINE Webhook** เหมาะสำหรับ LINE Official Account ที่ต้องการการตอบสนองแบบ interactive
- ระบบจะส่งทั้ง Email และ LINE ควบคู่กัน (ไม่ขึ้นกับกัน)
- หากการส่งการแจ้งเตือนล้มเหลว จะไม่ส่งผลต่อการทำงานหลักของระบบ

## ✅ การตรวจสอบการทำงาน

ระบบจะแสดง log ในคอนโซลเมื่อส่งการแจ้งเตือน:
```
📧 Email result: SUCCESS
📱 LINE result: SUCCESS
⚡ IT team notifications sent
```

สำหรับการ debug เพิ่มเติม ให้ดูที่ console log ของ Next.js development server

## 🔧 การแก้ปัญหา

### LINE Notify ส่งไม่ได้:
- ตรวจสอบ `LINE_NOTIFY_TOKEN` ใน `.env.local`
- ตรวจสอบว่า Token ยังไม่หมดอายุ
- ลองสร้าง Token ใหม่

### LINE Webhook ไม่ทำงาน:
- ตรวจสอบ `LINE_WEBHOOK_URL` ใน `.env.local`
- ตรวจสอบว่า URL สามารถเข้าถึงได้จากภายนอก
- ตรวจสอบ SSL Certificate (ต้องเป็น HTTPS)

### ไม่ได้รับการแจ้งเตือน:
- รันคำสั่ง `npm run test:notifications` เพื่อทดสอบ
- ตรวจสอบ console log ในระบบ
- ตรวจสอบว่าทั้ง Email และ LINE settings ถูกต้อง

## 📝 หมายเหตุ

- **LINE Notify** เหมาะสำหรับส่งข้อความแจ้งเตือนทั่วไป
- **LINE Webhook** เหมาะสำหรับ LINE Official Account ที่ต้องการการตอบสนองแบบ interactive
- ระบบจะส่งทั้ง Email และ LINE ควบคู่กัน (ไม่ขึ้นกับกัน)
- หากการส่งการแจ้งเตือนล้มเหลว จะไม่ส่งผลต่อการสร้าง/อัพเดท ticket

## ✅ การตรวจสอบการทำงาน

ระบบจะแสดง log ในคอนโซลเมื่อส่งการแจ้งเตือน:
```
📧 Email result: SUCCESS
📱 LINE result: SUCCESS
⚡ IT team notifications sent
```

สำหรับการ debug เพิ่มเติม ให้ดูที่ console log ของ Next.js development server