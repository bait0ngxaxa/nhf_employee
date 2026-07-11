export function calculateAdditionalOverQuotaDays(
    totalDays: number,
    usedDays: number,
    requestedDays: number,
): number {
    const currentOverQuotaDays = Math.max(0, usedDays - totalDays);
    const nextOverQuotaDays = Math.max(0, usedDays + requestedDays - totalDays);

    return nextOverQuotaDays - currentOverQuotaDays;
}
