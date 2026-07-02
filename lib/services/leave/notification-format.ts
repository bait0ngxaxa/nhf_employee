import type { LeavePeriodValue } from "@/lib/services/leave/utils";

export type LeaveTypeValue = "SICK" | "PERSONAL" | "VACATION";

export type LeaveSummaryInput = {
    startDate: string;
    endDate: string;
    period: LeavePeriodValue;
    durationDays: number;
};

type LeaveFlagInput = {
    emergencyReason: string | null;
    specialReason: string | null;
    overQuotaDays: number;
};

const thaiDateFormatter = new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
});

export function getLeaveTypeLabel(leaveType: LeaveTypeValue): string {
    if (leaveType === "SICK") return "ลาป่วย";
    if (leaveType === "PERSONAL") return "ลากิจ";
    return "ลาพักร้อน";
}

export function getLeavePeriodLabel(period: LeavePeriodValue): string {
    if (period === "MORNING") return "ครึ่งวันเช้า";
    if (period === "AFTERNOON") return "ครึ่งวันบ่าย";
    return "เต็มวัน";
}

export function formatLeaveDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return thaiDateFormatter.format(date);
}

export function formatLeaveDateRange(startDate: string, endDate: string): string {
    const start = formatLeaveDate(startDate);
    const end = formatLeaveDate(endDate);

    if (start === end) {
        return start;
    }

    return `${start} - ${end}`;
}

export function formatLeaveDurationDays(durationDays: number): string {
    return durationDays.toLocaleString("th-TH", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
    });
}

export function formatLeaveSummary(input: LeaveSummaryInput): string {
    return `${formatLeaveDateRange(input.startDate, input.endDate)} (${formatLeaveDurationDays(input.durationDays)} วัน, ${getLeavePeriodLabel(input.period)})`;
}

export function getLeaveFlagLabels(input: LeaveFlagInput): string[] {
    const labels: string[] = [];

    if (input.emergencyReason) {
        labels.push("ลาย้อนหลัง");
    }

    if (input.specialReason || input.overQuotaDays > 0) {
        labels.push("เกินโควต้า");
    }

    return labels;
}

export function formatLeaveFlagSummary(input: LeaveFlagInput): string {
    const labels = getLeaveFlagLabels(input);
    return labels.length > 0 ? ` (${labels.join(", ")})` : "";
}
