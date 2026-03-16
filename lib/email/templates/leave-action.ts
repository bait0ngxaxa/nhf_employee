import { type LeaveActionPayload } from "../types";

export function generateLeaveActionEmailHTML(data: LeaveActionPayload, approveLink: string, rejectLink: string): string {
    const typeLabel = data.leaveType === "SICK" ? "ลาป่วย" : data.leaveType === "PERSONAL" ? "ลากิจ" : "ลาพักร้อน";

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>แจ้งเตือนคำขออนุมัติลางาน</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
        <h2 style="color: #2c3e50; margin-top: 0; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
            มีคำขออนุมัติลางานใหม่
        </h2>
        
        <p>เรียน ผู้จัดการ,</p>
        <p>พนักงาน <strong>${data.employeeName}</strong> ได้ส่งคำขออนุมัติ${typeLabel} โดยมีรายละเอียดดังนี้:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; width: 30%; color: #6c757d;">ประเภทการลา:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; font-weight: bold;">${typeLabel}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">วันที่:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${data.startDate} ถึง ${data.endDate}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">จำนวนวัน:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${data.durationDays} วัน</td>
            </tr>
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #6c757d;">เหตุผล:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${data.reason}</td>
            </tr>
        </table>

        <p style="margin-top: 30px; text-align: center;">
            <a href="${approveLink}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px;">อนุมัติลางาน</a>
            <a href="${rejectLink}" style="display: inline-block; padding: 12px 24px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">ไม่อนุมัติ</a>
        </p>

        <p style="font-size: 12px; color: #6c757d; margin-top: 40px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            ระบบจัดการวันลา NHF<br>
            อีเมลฉบับนี้สร้างโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ
        </p>
    </div>
</body>
</html>`;
}
