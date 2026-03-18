# คู่มือการติดตั้ง Cloudflare Zero Trust คู่กับ Cloudflare Tunnel

การนำโปรเจคที่ใช้งานภายใน (Intranet) ขึ้น Public ผ่าน Cloudflare จะใช้ 2 บริการร่วมกัน:
1. **Cloudflare Tunnel (cloudflared):** เจาะอุโมงค์เพื่อไม่ต้อง Forward Port ที่ Router ลดการโดนสแกน IP
2. **Cloudflare Zero Trust (Access):** ตั้งด่านตรวจคนเข้าเมือง (ดักหน้าเว็บ) ให้เฉพาะพนักงานที่ได้รับอนุญาตเข้าใช้ระบบได้

---

## 🏗️ ภาพรวมการทำงาน (Architecture)
ผู้ใช้ ➡️ [ด่านตรวจ Zero Trust: เช็กอีเมล/OTP] ➡️ [ตรวจสอบผ่าน] ➡️ 🌐 Cloudflare กำแพงกันยิง ➡️ 🚇 Cloudflare Tunnel ➡️ 💻 ระบบ (Next.js Localhost)

---

## 📝 ขั้นตอนที่ 1: ติดตั้งและตั้งค่า Cloudflare Tunnel
ขั้นตอนนี้เราจะสร้างช่องทางลับให้ Server ของเราคุยกับระบบของ Cloudflare

### 1.1 ลงชื่อเข้าใช้ Cloudflare แบบ Console
เปิด Terminal (หรือ Command Prompt) ในเครื่อง Server (เครื่องที่จะรัน Next.js) แล้วรัน:
```bash
cloudflared tunnel login
```
*(ระบบจะบังคับเปิดเบราว์เซอร์ ให้คุณเลือกว่าโดเมนไหนที่คุณต้องการอนุญาตให้รัน Tunnel สิทธิ)*

### 1.2 สร้าง Tunnel ใหม่
หลังจากล็อกอินสำเร็จ ให้ตั้งชื่อ Tunnel เช่น `nhf-intranet`
```bash
cloudflared tunnel create nhf-intranet
```
**(ต้องจำ Tunnel ID ที่ระบบคืนค่ากลับมาไว้ใช้ในไฟล์ Config ภายหลัง ด้วยนะ)**

### 1.3 ชี้ DNS Domain (Route DNS)
สมมติว่าคุณต้องการเปิดเว็บที่ `employee.baitongtestdeploy.online`
```bash
cloudflared tunnel route dns nhf-intranet employee.baitongtestdeploy.online
```

### 1.4 สร้างไฟล์ Config
บน Server ให้สร้างไฟล์ที่คล้ายกับที่เราเคยทำ (`~/.cloudflared/config.yml` หรือ `%USERPROFILE%\.cloudflared\config.yml`)

```yaml
tunnel: <ใส่-TUNNEL-ID-ที่ได้จากขั้นตอน-1.2>
credentials-file: /root/.cloudflared/<ใส่-TUNNEL-ID>.json  # Path ชี้ไปหาไฟล์ JSON ที่ระบบสร้างให้

ingress:
  # กฎข้อ 1: อนุญาตเว็บ Employee
  - hostname: employee.baitongtestdeploy.online
    service: http://localhost:3000

  # กฎบรรทัดสุดท้าย (Catch-all) เพื่อดักป้องกันโดเมนอื่น
  - service: http_status:404
```

### 1.5 สร้างเป็น Systemd Service (ให้รันทำงานตลอดเวลาแม้ปิด Terminal)
```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```
*ถึงจุดนี้ หากเข้า `employee.baitongtestdeploy.online` หน้าเว็บก็จะติดขึ้นมาเรียบร้อย แต่มันจะ**สาธารณะ**ไปให้ทุกคนในโลกเข้าได้ 😱 เราจึงต้องทำขั้นต่อไปเพื่อป้องกันครับ*

---

## 🛡️ ขั้นตอนที่ 2: ตั้งด่านตรวจด้วย Cloudflare Zero Trust (ตัวป้องกัน)
ตอนนี้อุโมงค์ (Tunnel) เราพร้อมแล้ว ต่อไปเราจะสั่งให้มียามหน้าประตู Cloudflare เพื่อเช็กคนเข้าเว็บครับ

### 2.1 สมัคร Zero Trust (ฟรี)
1. เข้าไปที่แดชบอร์ด Cloudflare ปกติ เลือกไปที่เมนู **Zero Trust** (เมนูด้านซ้าย)
2. ระบบจะให้กรอกบัตรเครดิตเพื่อผูก Payment Method (แต่ถ้าเลือก Free Plan คือฟรี 100% สำหรับ 50 ผู้เข้าใช้งานแรก ข้อมูลจะไม่ถูกตัดบัตรครับ)

### 2.2 สร้างแอปพลิเคชัน (Access Application)
1. ในหน้าแดชบอร์ด Zero Trust ไปเมนูซ้ายมือเลือก **Access** > **Applications**
2. กดปุ่ม `Add an Application`
3. เลือกสร้างแบบ `Self-hosted` 
4. **ตั้งค่าชื่อแอป (Application name):** `NHF Employee System` (ตั้งเป็นอะไรก็ได้)
5. **กรอกโดเมน (Domain):** ใส่ให้ตรงกับที่เราพยายามตั้ง Tunnel (เช่น Subdomain: `employee` , Domain: `baitongtestdeploy.online`)
6. กดปุ่ม `Next` เข้าสู่หน้า Policies

### 2.3 สร้างกฎการเข้าถึง (Access Policies)
นี่คือหัวใจของ Zero Trust! เราต้องอนุญาตว่าจะให้คนแบบไหนเข้ามาได้

1. **Policy Name:** ตั้งชื่อเช่น `Allow ThaiNHF Employees`
2. **Action:** เลือก `Allow` 
3. เลื่อนลงมาที่หมวด **Configure rules (Include)**
   - *ตัวเลือกที่ 1 (อนุญาตแบบ Email แบบเจาะจงบางคน):* 
     - Selector: `Emails`
     - Value: `email1@thainhf.org`, `email2@thainhf.org`
   - *ตัวเลือกที่ 2 (อนุญาตทุก Email ที่มีโดเมนองค์กร - แนะนำ):*
     - Selector: `Emails Ending In`
     - Value: `@thainhf.org`
     *(ใครพิมพ์อีเมลอื่นที่ไม่ลงท้ายด้วย @thainhf.org ระบบจะเตะออกทันที ไม่ส่งแม้แต่รหัสผ่านไปหาเบราว์เซอร์คนๆ นั้น)*
4. กด `Next` และ `Add application` เป็นอันเสร็จ!

---

## 🚀 ผลลัพธ์จากการ Setup

เมื่อคุณเข้าใช้งานที่อยู่ `https://employee.baitongtestdeploy.online` :
1. เว็บจะไม่โหลดหน้า Login ของ Next.js ทันที
2. มันจะเด้งหน้าจอสีขาวสวยงามของ Cloudflare โลโก้แบรนด์มาขอ "Enter your email" (Email Address OTP Verification)
3. พนักงานต้องใส่อีเมลพนักงาน (`@thainhf.org`) เท่านั้น 
4. พนักงานจะต้องไปเปิดอีเมล แล้วเอารหัส 6 หลัก (One-Time-PIN) ที่ระบบส่งเข้ามา กรอกให้ถูกต้อง
5. **บู้ม!** Cloudflare ถึงจะยอมเปิดกำแพงให้ Tunnel ส่งข้อมูลมาถึงเครื่อง Localhost ของคุณ
6. พนักงานคนนั้นจะสามารถเข้าใช้งานแบบ Session-based (ซึ่งค่าเริ่มต้นคือจะจำสิทธิไป 24 ชั่วโมง โดยไม่ต้องพิมพ์ OTP ใหม่)

**จุดแข็งที่สุดของแผนงานนี้:**
- เซิร์ฟเวอร์ในสำนักงานของคุณจะไม่ต้องเจอกับหน้าต่าง Internet 100% ปลอดภัยจากการจู่โจม ยิงบอท แสกนพอร์ต 
- Hacker จะเจอกำแพงของด่านหน้า Cloudflare ขวางไว้
- มั่นใจได้ว่ามีเพียงพนักงานบริษัท (ที่มีเมล์บริษัทเท่านั้น) จึงจะสามารถโหลดเว็บ Next.js ได้จริงๆ ครับ!

---

**หมายเหตุเพิ่มเติม:** สำหรับหน้าต่างที่มีการขอ Webhook เช่นของ LINE OA, เราสามารถเข้าไปตีกรอนใน Zero Trust ให้ตั้ง Policy เป็น `Bypass` แบบแยก Path `/api/line/webhook` เพื่อประจุให้เฉพาะตัว LINE Bot วิ่งทะลุกำแพงโดยไม่ต้องกรอก OTP ได้เช่นเดียวกันกับที่ดักใน Config ของอุโมงค์หน้าครับ
