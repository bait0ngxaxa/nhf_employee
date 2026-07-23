export const HALF_DAYS_PER_DAY = 2;

export function daysToHalfDays(days: number): number {
    const halfDays = days * HALF_DAYS_PER_DAY;
    if (!Number.isSafeInteger(halfDays) || halfDays < 0) {
        throw new RangeError("จำนวนวันลาต้องเป็นค่าที่เพิ่มทีละครึ่งวันและห้ามติดลบ");
    }
    return halfDays;
}

export function halfDaysToDays(halfDays: number): number {
    if (!Number.isSafeInteger(halfDays) || halfDays < 0) {
        throw new RangeError("หน่วยครึ่งวันต้องเป็นจำนวนเต็มที่ไม่ติดลบ");
    }
    return halfDays / HALF_DAYS_PER_DAY;
}

type StoredLeaveQuota = {
    totalHalfDays: number;
    usedHalfDays: number;
};

type StoredLeaveRequest = {
    durationHalfDays: number;
    overQuotaHalfDays: number;
};

export function toLeaveQuotaDays<T extends StoredLeaveQuota>(
    quota: T,
): Omit<T, keyof StoredLeaveQuota> & { totalDays: number; usedDays: number } {
    const { totalHalfDays, usedHalfDays, ...rest } = quota;
    return {
        ...rest,
        totalDays: halfDaysToDays(totalHalfDays),
        usedDays: halfDaysToDays(usedHalfDays),
    };
}

export function toLeaveRequestDays<T extends StoredLeaveRequest>(
    request: T,
): Omit<T, keyof StoredLeaveRequest> & {
    durationDays: number;
    overQuotaDays: number;
} {
    const { durationHalfDays, overQuotaHalfDays, ...rest } = request;
    return {
        ...rest,
        durationDays: halfDaysToDays(durationHalfDays),
        overQuotaDays: halfDaysToDays(overQuotaHalfDays),
    };
}
