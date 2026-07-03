export const LEAVE_BUSINESS_TIME_ZONE = "Asia/Bangkok";

const DATE_PREFIX_PATTERN = /^(\d{4})-\d{2}-\d{2}/;
const LEAVE_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
    timeZone: LEAVE_BUSINESS_TIME_ZONE,
    year: "numeric",
});

export function getCurrentLeaveYear(now: Date = new Date()): number {
    return parseLeaveYear(LEAVE_YEAR_FORMATTER.format(now));
}

export function getLeaveYearFromDateValue(value: Date | string): number {
    if (typeof value === "string") {
        const match = DATE_PREFIX_PATTERN.exec(value);
        if (match) {
            return parseLeaveYear(match[1]);
        }
        return getCurrentLeaveYear(new Date(value));
    }

    return getCurrentLeaveYear(value);
}

function parseLeaveYear(value: string): number {
    const year = Number.parseInt(value, 10);
    if (Number.isNaN(year)) {
        throw new Error("Invalid leave year");
    }
    return year;
}
