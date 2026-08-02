import { getBusinessDate } from "@/lib/services/leave/business-date";

export { LEAVE_BUSINESS_TIME_ZONE } from "@/lib/services/leave/business-date";

export function getCurrentLeaveYear(now: Date = new Date()): number {
    return getBusinessDate(now).year;
}

export function getLeaveYearFromDateValue(value: Date | string): number {
    return getBusinessDate(value).year;
}
