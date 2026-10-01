export class EmailRequestAccessConflictError extends Error {
    constructor() {
        super("สิทธิ์การใช้งานถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง");
        this.name = "EmailRequestAccessConflictError";
    }
}

export class EmailRequestNotFoundError extends Error {
    constructor() {
        super("ไม่พบคำร้องพนักงานใหม่");
        this.name = "EmailRequestNotFoundError";
    }
}
