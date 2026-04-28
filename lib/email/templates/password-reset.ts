export function generatePasswordResetEmailHTML(
    resetUrl: string,
    userName: string,
): string {
    return `
  <!DOCTYPE html>
  <html lang="th">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>รีเซ็ตรหัสผ่าน - NHFapp</title>
      <style>
          body { 
              font-family: 'Sarabun', Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background-color: #f8fafc;
          }
          .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: white; 
              border-radius: 12px; 
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
              background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); 
              color: white; 
              padding: 30px 20px; 
              text-align: center; 
          }
          .header h1 { 
              margin: 0; 
              font-size: 24px; 
              font-weight: 600;
          }
          .content { 
              padding: 30px 20px; 
          }
          .info-box { 
              background: #f8fafc; 
              border-radius: 8px; 
              padding: 20px; 
              margin: 20px 0; 
              border-left: 4px solid #8B5CF6;
          }
          .button { 
              display: inline-block; 
              padding: 16px 40px; 
              background-color: #2563EB;
              color: #ffffff !important; 
              text-decoration: none; 
              border-radius: 8px; 
              font-weight: 700; 
              font-size: 18px;
              margin: 20px 0;
              border: 2px solid #1D4ED8;
              letter-spacing: 0.5px;
          }
          .button:hover {
              opacity: 0.9;
          }
          .warning { 
              background: #fffbeb; 
              border: 1px solid #fcd34d; 
              border-radius: 8px; 
              padding: 15px; 
              margin: 20px 0;
              color: #92400e;
              font-size: 14px;
          }
          .footer { 
              background: #f8fafc; 
              padding: 20px; 
              text-align: center; 
              color: #6B7280; 
              font-size: 14px;
              border-top: 1px solid #e5e7eb;
          }
          .link-text {
              word-break: break-all;
              font-size: 12px;
              color: #6B7280;
              margin-top: 10px;
          }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <h1>🔐 รีเซ็ตรหัสผ่าน</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">NHFapp</p>
          </div>
          
          <div class="content">
              <p style="font-size: 16px; color: #1F2937;">สวัสดีคุณ <strong>${userName}</strong>,</p>
              
              <p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่:</p>

              <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetUrl}" class="button">
                      ตั้งรหัสผ่านใหม่
                  </a>
              </div>

              <div class="warning">
                  <strong>⏰ ลิงก์นี้จะหมดอายุภายใน 1 ชั่วโมง</strong><br>
                  หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้ รหัสผ่านของคุณจะไม่ถูกเปลี่ยนแปลง
              </div>

              <div class="info-box">
                  <p style="margin: 0; font-size: 14px; color: #4B5563;">
                      <strong>หากปุ่มด้านบนไม่ทำงาน</strong> ให้คัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์:
                  </p>
                  <p class="link-text">${resetUrl}</p>
              </div>
          </div>
          
          <div class="footer">
              <p>อีเมลนี้ถูกส่งอัตโนมัติจากระบบ NHFapp<br>
              National Health Foundation (NHF)</p>
          </div>
      </div>
  </body>
  </html>
  `;
}
