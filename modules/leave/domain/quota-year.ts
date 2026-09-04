import { getBusinessDate } from "@/modules/leave/domain/business-date";

export { LEAVE_BUSINESS_TIME_ZONE } from "@/modules/leave/domain/business-date";

export function getCurrentLeaveYear(now: Date = new Date()): number {
    return getBusinessDate(now).year;
}

export function getLeaveYearFromDateValue(value: Date | string): number {
    return getBusinessDate(value).year;
}
