/**
 * Calculates the number of working days between two dates (inclusive).
 * Ignores Saturdays (6) and Sundays (0).
 *
 * @param startDate The start date of the leave
 * @param endDate The end date of the leave
 * @returns The total number of working days
 */
export function getWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const matchEndDate = new Date(endDate);
    matchEndDate.setHours(0, 0, 0, 0);

    while (current <= matchEndDate) {
        const dayOfWeek = current.getDay();
        // 0 is Sunday, 6 is Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}
