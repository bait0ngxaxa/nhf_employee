import type { LeaveStatus } from "@prisma/client";

export interface LeaveChargeSnapshot {
    status: LeaveStatus;
    durationHalfDays: number;
    chargedHalfDays?: number | null;
}

export function isQuotaChargedStatus(status: LeaveStatus): boolean {
    return status === "APPROVED" || status === "CANCELLATION_REQUESTED";
}

/** NULL is deliberately a lazy legacy compatibility marker, not an automatic history rewrite. */
export function getEffectiveChargedHalfDays(request: LeaveChargeSnapshot): number {
    if (!isQuotaChargedStatus(request.status)) return 0;
    const charge = request.chargedHalfDays ?? request.durationHalfDays;
    if (!Number.isSafeInteger(charge) || charge < 0) throw new RangeError("ยอดหักโควต้าต้องเป็นจำนวนเต็มครึ่งวันที่ไม่ติดลบ");
    return charge;
}
