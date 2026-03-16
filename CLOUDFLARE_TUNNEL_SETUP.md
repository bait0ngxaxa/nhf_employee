# Cloudflare Tunnel Setup — Leave Approve Magic Link

## Architecture

```
Manager คลิกลิงก์ Email
       ↓
https://approve.baitongtestdeploy.online/leave/action?token=eyJ...
       ↓
Cloudflare Tunnel (cloudflared)
       ↓  (อนุญาตเฉพาะ /leave/action และ /api/leave/action)
Intranet Server (192.168.x.x:3000)
       ↓
Next.js App → ถอด JWT → อัปเดตข้อมูล LeaveRequest
```

> **สำคัญ:** Cloudflare Tunnel จะเปิดรับ request เฉพาะเส้นทาง (paths) ที่กำหนดเท่านั้น ไม่ได้เปิดให้ใช้งานหน้าเว็บ Intranet ทั้งหมดจากภายนอก

---

## Step 1: เตรียม Domain บน Cloudflare

1. นำ domain ขององค์กร (เช่น `baitongtestdeploy.online`) ไปจัดการ DNS บน Cloudflare Dashboard
2. ไม่ต้องเปิด A/CNAME record เอง — เดี๋ยว Tunnel จะเป็นคนสร้าง record ให้อัตโนมัติ

---

## Step 2: ติดตั้ง cloudflared บน Server (เครื่อง Intranet)

### Linux (Ubuntu/Debian)

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-archive-keyring.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-archive-keyring.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared -y
```

### Windows

```powershell
winget install --id Cloudflare.cloudflared
```

---

## Step 3: Login และสร้าง Tunnel

```bash
# พิมพ์คำสั่ง login (ระบบจะเปิดลิงก์ให้กด authorize ในเบราว์เซอร์)
cloudflared tunnel login

# สร้าง tunnel ชื่อสำหรับโปรเจคนี้ เช่น nhf-approve
cloudflared tunnel create nhf-approve

# เมื่อสร้างเสร็จจะได้ Tunnel ID กลับมา ตัวอย่าง: a1b2c3d4-e5f6-7890-abcd-ef1234567890
# (ให้คัดลอกเก็บไว้ใช้ใน Step 4)
```

---

## Step 4: สร้างไฟล์ Configuration สำหรับ Ingress Rules

ก่อนสร้างไฟล์ ต้องสร้างโฟลเดอร์ `.cloudflared` ก่อน (ถ้ายังไม่มี):

```bash
# สำหรับ Linux
mkdir -p ~/.cloudflared
```

จากนั้นสร้างไฟล์ `~/.cloudflared/config.yml` (Linux) หรือ `%USERPROFILE%\.cloudflared\config.yml` (Windows)
โดยเพิ่มเนื้อหาตามนี้:

```yaml
tunnel: 04a59b7c-ab41-45da-9512-a32c2379bfa7 # ← เปลี่ยนเป็น Tunnel ID ของตัวเอง
credentials-file: /home/yingyot/.cloudflared/04a59b7c-ab41-45da-9512-a32c2379bfa7.json # ← เปลี่ยน path ให้ตรงกับเครื่องของตัวเอง

ingress:
    # 1) อนุญาตเฉพาะหน้า Approve Page (Frontend)
    - hostname: approve.baitongtestdeploy.online
      path: /leave/action*
      service: http://localhost:3000

    # 2) อนุญาตเฉพาะ API endpoint ของการ Approve
    - hostname: approve.baitongtestdeploy.online
      path: /api/leave/action*
      service: http://localhost:3000

    # 3) อนุญาตไฟล์ Static Assets เพื่อให้หน้าเว็บโหลด CSS/JS ได้สมบูรณ์
    - hostname: approve.baitongtestdeploy.online
      path: /_next/*
      service:
          http://localhost:3000

          # เพิ่มบรรทัดนี้ — ให้ NextAuth session ทำงานได้
    - hostname: approve.baitongtestdeploy.online
      path: /api/auth/*
      service: http://localhost:3000

    # Rule สุดท้าย: ถ้า path ไม่เข้าเงื่อนไขด้านบน ให้ผลักเป็น 404 (Block ทั้งหมด)
    - service: http_status:404
```

---

## Step 5: สร้าง DNS Route เพื่อเชื่อม Domain กับ Tunnel

```bash
cloudflared tunnel route dns nhf-approve approve.baitongtestdeploy.online
```

> **ผลลัพธ์:** Cloudflare จะจัดการสร้าง CNAME `approve.baitongtestdeploy.online` ชี้ไปที่ `<tunnel-id>.cfargotunnel.com` ให้ในหน้า Dashboard โดยอัตโนมัติ

---

## Step 6: ทดลองรัน Tunnel (และตั้งค่าเป็น Service)

### ลองรันแบบ Foreground เพื่อทดสอบ

```bash
cloudflared tunnel run nhf-approve
```

(หากไม่มี error แสดงว่าเซิร์ฟเวอร์เชื่อมกับ Cloudflare สำเร็จ)

### รันเป็น Background Service (สำหรับ Production)

```bash
# สำหรับ Linux (systemd)
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# สำหรับ Windows
cloudflared service install
```

---

## Step 7: เพิ่ม Environment Variable ในแอป Next.js

เปิดไฟล์ `.env` ของโปรเจค `employee_nhf` แล้วเพิ่ม 1 บรรทัดดังนี้:

```env
# URL ภายในองค์กร (ใช้สำหรับตอนคนอยู่ในออฟฟิศ)
NEXTAUTH_URL=http://192.168.1.100:3000

# URL สาธารณะ ผ่าน Cloudflare Tunnel (สร้างขึ้นใหม่)
PUBLIC_APPROVE_URL=https://approve.baitongtestdeploy.online
```

> **Note:** โค้ดในส่วนของการสร้าง "Magic Link" จะถูกปรับให้อ่าน `PUBLIC_APPROVE_URL` ก่อน ถ้าใน `.env` ไม่ได้ระบุไว้ มันจะ fallback กลับไปใช้ `NEXTAUTH_URL` แทน

---

## Step 8: ทดสอบการทำงาน

ให้คุณหยิบมือถือ หรือเชื่อมต่อเน็ตเวิร์ก **ที่อยู่ภายนอกออฟฟิศ (นอก LAN)** แล้วทดสอบการเข้าถึง URL:

```bash
# 1. ลองเข้าหน้า approve → ควรจะเข้าได้ปกติ ได้ Status 200 (แต่ก็จะเจอข้อความว่าลิงก์ไม่ถูกต้อง เพราะไม่มี token ส่งไป)
curl -I https://approve.baitongtestdeploy.online/leave/action

# 2. ลองแอบเข้าหน้า dashboard โดยตรง → ควรจะโดน Block ด้วยเลข 404 Not Found (ตาม Rule ข้อ 4 ในไฟล์ config.yml)
curl -I https://approve.baitongtestdeploy.online/dashboard

# 3. ลองแอบเรียก API อื่นของระบบ → ควรจะโดน Block 404
curl -I https://approve.baitongtestdeploy.online/api/employees/1
```

---

## Security Features Summary

| สิ่งที่ช่วยป้องกัน            | รายละเอียด                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Cloudflare Tunnel Ingress** | เปิดเฉพาะทางเข้าที่จำเป็นคือ `/leave/action` และ `/api/leave/action` เพื่อลดความเสี่ยง                                |
| **JWT Magic Link**            | "Token ยืนยันสิทธิ์" จะผูก `leaveId` + `approverId` + `action (approve/reject)` เข้าด้วยกันและถูก Sign ปลอมแปลงไม่ได้ |
| **Token Expiration**          | Token จะมีอายุตามที่เราเขียนโค้ดกำหนดไว้ ตอนเลยระยะเวลาไปแล้วก็นำมาใช้ไม่ได้                                          |
| **Strict Action Flow**        | ต่อให้คนอื่นเดาลิงก์มาได้ ระบบก็จะตรวจสอบสถานะใบลาด้วยว่าต้องเป็น "PENDING" เท่านั้น ป้องกันการกดย้ำซ้ำๆ              |
| **SSL Enforcement**           | เข้าข่ายผ่านระบบ HTTPS ฟรีและอัตโนมัติ 100% จากทาง Cloudflare เอง                                                     |

_(Optional)_ หากต้องการเพิ่มการป้องกันให้รัดกุมไปอีก สามารถเข้าไปตั้งค่าที่ Cloudflare Dashboard เมนู Zero Trust » Access » Applications ให้บังคับล็อกอินผ่าน Microsoft 365 หรือส่งเลข OTP ไปที่อีเมล `@baitongtestdeploy.online` ก่อนถึงจะเข้าใช้งานลิงก์ดังกล่าวได้
