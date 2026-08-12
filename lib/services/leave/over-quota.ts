export function calculateAdditionalOverQuotaHalfDays(
    effectiveTotalHalfDays: number,
    usedHalfDays: number,
    requestedHalfDays: number,
): number {
    const currentOverQuotaHalfDays = Math.max(
        0,
        usedHalfDays - effectiveTotalHalfDays,
    );
    const nextOverQuotaHalfDays = Math.max(
        0,
        usedHalfDays + requestedHalfDays - effectiveTotalHalfDays,
    );

    return nextOverQuotaHalfDays - currentOverQuotaHalfDays;
}

export function calculateAdditionalOverQuotaDays(
    effectiveTotalDays: number,
    usedDays: number,
    requestedDays: number,
): number {
    const currentOverQuotaDays = Math.max(0, usedDays - effectiveTotalDays);
    const nextOverQuotaDays = Math.max(
        0,
        usedDays + requestedDays - effectiveTotalDays,
    );
    return nextOverQuotaDays - currentOverQuotaDays;
}
