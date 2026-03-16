import { type LeaveResultPayload } from "../types";

export function generateLeaveResultEmailHTML(data: LeaveResultPayload): string {
    const statusText = data.status === "APPROVED" ? "อนุมัติ" : "ไม่อนุมัติ";
    const statusColor = data.status === "APPROVED" ? "#10b981" : "#ef4444";

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ผลการพิจารณาคำขออนุมัติลางาน</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
        <h2 style="color: #2c3e50; margin-top: 0; border-bottom: 2px solid ${statusColor}; padding-bottom: 10px;">
            ผลการพิจารณาคำขออนุมัติลางาน: <span style="color: ${statusColor};">${statusText}</span>
        </h2>
        
        <p>เรียนพนักงาน,</p>
        <p>คำขออนุมัติลางานของคุณได้รับการพิจารณาแล้ว โดยมีผลคือ <strong>${statusText}</strong></p>
        
        ${data.reason ? `
        <div style="background-color: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #ffeeba;">
            <strong>เหตุผลจากหัวหน้างาน:</strong><br>
            ${data.reason}
        </div>
        ` : ''}

        <p style="margin-top: 30px;">
            คุณสามารถตรวจสอบข้อมูลและประวัติการลางานทั้งหมดได้ที่:<br>
            <a href="${process.env.NEXTAUTH_URL}/dashboard/leave" style="color: #3b82f6; text-decoration: none; font-weight: bold;">หน้าแดชบอร์ดการลางานของคุณ</a>
        </p>

        <p style="font-size: 12px; color: #6c757d; margin-top: 40px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            ระบบจัดการวันลา NHF<br>
            อีเมลฉบับนี้สร้างโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ
        </p>
    </div>
</body>
</html>`;
}
