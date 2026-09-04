export const LEAVE_REQUEST_MESSAGES = {
    holidayConflict: "วันที่ลาตรงกับวันหยุด",
    approverNotConfigured: "ยังไม่ได้ตั้งค่าผู้อนุมัติ",
    approverAccountNotConfigured: "ผู้อนุมัติยังไม่มีบัญชีผู้ใช้ในระบบ",
    overlapConflict: "มีคำขอลาในช่วงวันที่นี้อยู่แล้ว",
    employeeNotFound: "ไม่พบข้อมูลพนักงาน",
    halfDayMultiDate: "การลาครึ่งวันต้องเลือกวันลาเพียงวันเดียว",
    specialReasonRequired: "กรุณาระบุเหตุผลพิเศษสำหรับการลาเกินโควต้า",
} as const;

export class LeaveRequestError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "LeaveRequestError";
        this.statusCode = statusCode;
    }
}
