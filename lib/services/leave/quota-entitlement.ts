import type { LeaveQuota, LeaveType, Prisma } from "@prisma/client";

import {
    ALL_LEAVE_TYPES,
    DEFAULT_LEAVE_QUOTA_HALF_DAYS,
} from "@/constants/leave";
import {
    calculateEffectiveEntitlementHalfDays,
    calculateOpeningCarryBalanceHalfDays,
    isCarryForwardLeaveType,
} from "@/lib/services/leave/quota-accounting";

type EnsureLeaveQuotaInput = {
    employeeId: number;
    year: number;
    leaveType: LeaveType;
};

type QuotaBalanceSnapshot = Pick<
    LeaveQuota,
    "year" | "carryBalanceHalfDays" | "usedHalfDays"
>;

export function calculateEffectiveEntitlementForYearHalfDays(input: {
    leaveType: LeaveType;
    year: number;
    latestQuota?: QuotaBalanceSnapshot | null;
}): number {
    const { leaveType, year, latestQuota } = input;
    const totalHalfDays = DEFAULT_LEAVE_QUOTA_HALF_DAYS[leaveType];
    if (!isCarryForwardLeaveType(leaveType) || !latestQuota) {
        return totalHalfDays;
    }
    if (latestQuota.year > year) {
        throw new RangeError("ปีโควต้าล่าสุดต้องไม่เกินปีเป้าหมาย");
    }

    const carryBalanceHalfDays = latestQuota.year === year
        ? latestQuota.carryBalanceHalfDays
        : calculateOpeningCarryBalanceHalfDays({
            leaveType,
            totalHalfDays,
            targetYear: year,
            previousQuota: latestQuota,
        });

    return calculateEffectiveEntitlementHalfDays(
        totalHalfDays,
        carryBalanceHalfDays,
    );
}

function getNormalizedQuotaData(
    leaveType: LeaveType,
    carryBalanceHalfDays: number,
): Pick<LeaveQuota, "totalHalfDays" | "carryBalanceHalfDays"> {
    return {
        totalHalfDays: DEFAULT_LEAVE_QUOTA_HALF_DAYS[leaveType],
        carryBalanceHalfDays: isCarryForwardLeaveType(leaveType)
            ? carryBalanceHalfDays
            : 0,
    };
}

async function normalizeQuota(
    tx: Prisma.TransactionClient,
    quota: LeaveQuota,
): Promise<LeaveQuota> {
    const normalized = getNormalizedQuotaData(
        quota.leaveType,
        quota.carryBalanceHalfDays,
    );
    if (
        quota.totalHalfDays === normalized.totalHalfDays
        && quota.carryBalanceHalfDays === normalized.carryBalanceHalfDays
    ) {
        return quota;
    }

    return tx.leaveQuota.update({
        where: { id: quota.id },
        data: normalized,
    });
}

export async function ensureLeaveQuotaForYear(
    tx: Prisma.TransactionClient,
    input: EnsureLeaveQuotaInput,
): Promise<LeaveQuota> {
    const { employeeId, year, leaveType } = input;
    const totalHalfDays = DEFAULT_LEAVE_QUOTA_HALF_DAYS[leaveType];
    const previousQuota = isCarryForwardLeaveType(leaveType)
        ? await tx.leaveQuota.findFirst({
            where: {
                employeeId,
                leaveType,
                year: { lt: year },
            },
            orderBy: { year: "desc" },
        })
        : null;
    const normalizedPreviousQuota = previousQuota
        ? await normalizeQuota(tx, previousQuota)
        : null;
    const carryBalanceHalfDays = calculateOpeningCarryBalanceHalfDays({
        leaveType,
        totalHalfDays,
        targetYear: year,
        previousQuota: normalizedPreviousQuota,
    });

    return tx.leaveQuota.upsert({
        where: {
            employeeId_year_leaveType: {
                employeeId,
                year,
                leaveType,
            },
        },
        update: {
            totalHalfDays,
            carryBalanceHalfDays,
        },
        create: {
            employeeId,
            year,
            leaveType,
            totalHalfDays,
            carryBalanceHalfDays,
            usedHalfDays: 0,
        },
    });
}

export async function reconcileLeaveQuotaForward(
    tx: Prisma.TransactionClient,
    changedQuota: LeaveQuota,
): Promise<void> {
    let previousQuota = await normalizeQuota(tx, changedQuota);
    if (!isCarryForwardLeaveType(previousQuota.leaveType)) {
        return;
    }

    const futureQuotas = await tx.leaveQuota.findMany({
        where: {
            employeeId: previousQuota.employeeId,
            leaveType: previousQuota.leaveType,
            year: { gt: previousQuota.year },
        },
        orderBy: { year: "asc" },
    });

    for (const futureQuota of futureQuotas) {
        const totalHalfDays = DEFAULT_LEAVE_QUOTA_HALF_DAYS[futureQuota.leaveType];
        const carryBalanceHalfDays = calculateOpeningCarryBalanceHalfDays({
            leaveType: futureQuota.leaveType,
            totalHalfDays,
            targetYear: futureQuota.year,
            previousQuota,
        });
        const isAlreadyReconciled =
            futureQuota.totalHalfDays === totalHalfDays
            && futureQuota.carryBalanceHalfDays === carryBalanceHalfDays;

        previousQuota = isAlreadyReconciled
            ? futureQuota
            : await tx.leaveQuota.update({
                where: { id: futureQuota.id },
                data: {
                    totalHalfDays,
                    carryBalanceHalfDays,
                },
            });
    }
}

export async function ensureLeaveQuotasForYear(
    tx: Prisma.TransactionClient,
    employeeId: number,
    year: number,
): Promise<LeaveQuota[]> {
    const quotas: LeaveQuota[] = [];

    for (const leaveType of ALL_LEAVE_TYPES) {
        const quota = await ensureLeaveQuotaForYear(tx, {
            employeeId,
            year,
            leaveType,
        });
        await reconcileLeaveQuotaForward(tx, quota);
        quotas.push(quota);
    }

    return quotas;
}
