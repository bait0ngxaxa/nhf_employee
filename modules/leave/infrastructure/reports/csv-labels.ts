export const LEAVE_TYPE_TH: Readonly<Record<string, string>> = {
    SICK: "ลาป่วย",
    PERSONAL: "ลากิจ",
    VACATION: "ลาพักร้อน",
};

export const LEAVE_PERIOD_TH: Readonly<Record<string, string>> = {
    FULL_DAY: "เต็มวัน",
    MORNING: "ครึ่งวันเช้า",
    AFTERNOON: "ครึ่งวันบ่าย",
};

export const LEAVE_STATUS_TH: Readonly<Record<string, string>> = {
    PENDING: "รออนุมัติ",
    APPROVED: "อนุมัติแล้ว",
    REJECTED: "ไม่อนุมัติ",
    CANCELLED: "ยกเลิก",
    NOT_TAKEN: "ไม่ได้ใช้วันลา",
    CANCELLATION_REQUESTED: "รอยืนยันยกเลิก",
    CANCELLED_AFTER_APPROVAL: "ยกเลิกหลังอนุมัติ",
};
