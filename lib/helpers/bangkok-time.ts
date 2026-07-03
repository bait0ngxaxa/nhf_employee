const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function createBangkokYearRange(year: number): {
    startOfYear: Date;
    endOfYear: Date;
} {
    return {
        startOfYear: new Date(Date.UTC(year, 0, 1) - BANGKOK_OFFSET_MS),
        endOfYear: new Date(Date.UTC(year + 1, 0, 1) - BANGKOK_OFFSET_MS),
    };
}

export function getBangkokYear(date: Date): number {
    return new Date(date.getTime() + BANGKOK_OFFSET_MS).getUTCFullYear();
}

export function toBangkokExcelDate(date: Date): Date {
    return new Date(date.getTime() + BANGKOK_OFFSET_MS);
}
