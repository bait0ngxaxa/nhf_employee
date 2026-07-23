export function calculateAdditionalOverQuotaHalfDays(
    totalHalfDays: number,
    usedHalfDays: number,
    requestedHalfDays: number,
): number {
    const currentOverQuotaHalfDays = Math.max(0, usedHalfDays - totalHalfDays);
    const nextOverQuotaHalfDays = Math.max(
        0,
        usedHalfDays + requestedHalfDays - totalHalfDays,
    );

    return nextOverQuotaHalfDays - currentOverQuotaHalfDays;
}

export function calculateAdditionalOverQuotaDays(
    totalDays: number,
    usedDays: number,
    requestedDays: number,
): number {
    const currentOverQuotaDays = Math.max(0, usedDays - totalDays);
    const nextOverQuotaDays = Math.max(0, usedDays + requestedDays - totalDays);
    return nextOverQuotaDays - currentOverQuotaDays;
}
