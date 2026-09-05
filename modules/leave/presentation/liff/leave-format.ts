import type { LeavePeriodValue, LeaveStatusValue, LeaveTypeValue } from "../types";

export function getLeaveTypeLabel(type: LeaveTypeValue): string {
    if (type === "SICK") return "ลาป่วย";
    if (type === "PERSONAL") return "ลากิจ";
    return "ลาพักร้อน";
}

export function getLeavePeriodLabel(period: LeavePeriodValue): string {
    if (period === "FULL_DAY") return "เต็มวัน";
    if (period === "MORNING") return "ครึ่งวันเช้า";
    return "ครึ่งวันบ่าย";
}

export function getLeaveStatusLabel(status: LeaveStatusValue): string {
    const labels: Record<LeaveStatusValue, string> = {
        PENDING: "รออนุมัติ",
        APPROVED: "อนุมัติแล้ว",
        REJECTED: "ไม่อนุมัติ",
        CANCELLED: "ยกเลิกแล้ว",
        NOT_TAKEN: "ไม่ได้ใช้วันลา",
        CANCELLATION_REQUESTED: "รอยืนยันยกเลิก",
        CANCELLED_AFTER_APPROVAL: "ยกเลิกหลังอนุมัติ",
    };
    return labels[status];
}

export function formatLeaveDateRange(startDate: string, endDate: string): string {
    const formatter = new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
    const start = formatter.format(new Date(startDate));
    return startDate === endDate
        ? start
        : `${start} – ${formatter.format(new Date(endDate))}`;
}

export function formatLeaveDays(value: number): string {
    return new Intl.NumberFormat("th-TH", {
        maximumFractionDigits: 1,
    }).format(value);
}
