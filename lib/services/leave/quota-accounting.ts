import type { LeaveType } from "@prisma/client";

type PreviousQuotaBalance = {
    year: number;
    carryBalanceHalfDays: number;
    usedHalfDays: number;
};

function assertSafeInteger(value: number, fieldName: string): void {
    if (!Number.isSafeInteger(value)) {
        throw new RangeError(`${fieldName} ต้องเป็นจำนวนเต็มที่ปลอดภัย`);
    }
}

function assertUnsignedHalfDays(value: number, fieldName: string): void {
    assertSafeInteger(value, fieldName);
    if (value < 0) {
        throw new RangeError(`${fieldName} ต้องไม่ติดลบ`);
    }
}

function assertSafeResult(value: number): number {
    if (!Number.isSafeInteger(value)) {
        throw new RangeError("ผลคำนวณโควต้าวันลาเกินช่วงจำนวนเต็มที่ปลอดภัย");
    }
    return value;
}

export function isCarryForwardLeaveType(leaveType: LeaveType): boolean {
    return leaveType === "PERSONAL" || leaveType === "VACATION";
}

export function calculateEffectiveEntitlementHalfDays(
    totalHalfDays: number,
    carryBalanceHalfDays: number,
): number {
    assertUnsignedHalfDays(totalHalfDays, "สิทธิประจำปี");
    assertSafeInteger(carryBalanceHalfDays, "ยอดยกมา");
    return assertSafeResult(totalHalfDays + carryBalanceHalfDays);
}

export function calculateRemainingBalanceHalfDays(
    totalHalfDays: number,
    carryBalanceHalfDays: number,
    usedHalfDays: number,
): number {
    assertUnsignedHalfDays(usedHalfDays, "สิทธิที่ใช้แล้ว");
    return assertSafeResult(
        calculateEffectiveEntitlementHalfDays(
            totalHalfDays,
            carryBalanceHalfDays,
        ) - usedHalfDays,
    );
}

export function calculateClosingBalanceHalfDays(
    totalHalfDays: number,
    carryBalanceHalfDays: number,
    usedHalfDays: number,
): number {
    return calculateRemainingBalanceHalfDays(
        totalHalfDays,
        carryBalanceHalfDays,
        usedHalfDays,
    );
}

export function calculateCarryBalanceForNextYear(
    leaveType: LeaveType,
    totalHalfDays: number,
    carryBalanceHalfDays: number,
    usedHalfDays: number,
): number {
    const closingBalanceHalfDays = calculateClosingBalanceHalfDays(
        totalHalfDays,
        carryBalanceHalfDays,
        usedHalfDays,
    );
    if (!isCarryForwardLeaveType(leaveType)) {
        return 0;
    }

    return closingBalanceHalfDays;
}

export function calculateOpeningCarryBalanceHalfDays(input: {
    leaveType: LeaveType;
    totalHalfDays: number;
    targetYear: number;
    previousQuota?: PreviousQuotaBalance | null;
}): number {
    const {
        leaveType,
        totalHalfDays,
        targetYear,
        previousQuota,
    } = input;
    assertUnsignedHalfDays(totalHalfDays, "สิทธิประจำปี");
    assertSafeInteger(targetYear, "ปีโควต้า");

    if (!isCarryForwardLeaveType(leaveType) || !previousQuota) {
        return 0;
    }

    assertSafeInteger(previousQuota.year, "ปีโควต้าก่อนหน้า");
    const missingYearCount = targetYear - previousQuota.year - 1;
    if (missingYearCount < 0) {
        throw new RangeError("ปีโควต้าก่อนหน้าต้องน้อยกว่าปีเป้าหมาย");
    }

    const previousClosingBalanceHalfDays = calculateClosingBalanceHalfDays(
        totalHalfDays,
        previousQuota.carryBalanceHalfDays,
        previousQuota.usedHalfDays,
    );
    const missingYearEntitlementHalfDays = assertSafeResult(
        totalHalfDays * missingYearCount,
    );

    return assertSafeResult(
        previousClosingBalanceHalfDays + missingYearEntitlementHalfDays,
    );
}
