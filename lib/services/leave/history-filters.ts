import type { LeaveStatus, LeaveType, Prisma } from "@prisma/client";

import {
    ALL_LEAVE_STATUSES,
    ALL_LEAVE_TYPES,
    APPROVER_LEAVE_HISTORY_STATUSES,
} from "@/constants/leave";
import { toUtcDate } from "@/lib/services/leave/business-date";
import { getLeaveYearFromDateValue } from "@/lib/services/leave/quota-year";

export interface LeaveHistoryFilters {
    query?: string;
    leaveType?: LeaveType;
    status?: LeaveStatus;
    year?: number;
}

export interface LeaveHistoryMetadata {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    availableYears: number[];
}

export const LEAVE_HISTORY_QUERY_MAX_LENGTH = 200;
export const LEAVE_HISTORY_MIN_YEAR = 2000;
export const LEAVE_HISTORY_MAX_YEAR = 2100;

interface LeaveHistoryFilterParameterNames {
    query: string;
    leaveType: string;
    status: string;
    year: string;
    allowedStatuses: readonly LeaveStatus[];
}

interface LeaveHistoryFiltersSuccess {
    success: true;
    filters: LeaveHistoryFilters;
}

interface LeaveHistoryFiltersFailure {
    success: false;
    error: string;
}

export type LeaveHistoryFiltersParseResult =
    | LeaveHistoryFiltersSuccess
    | LeaveHistoryFiltersFailure;

const INVALID_FILTERS_MESSAGE = "ตัวกรองประวัติการลาไม่ถูกต้อง";

const EMPLOYEE_HISTORY_FILTER_PARAMETERS: LeaveHistoryFilterParameterNames = {
    query: "q",
    leaveType: "leaveType",
    status: "status",
    year: "year",
    allowedStatuses: ALL_LEAVE_STATUSES,
};

const APPROVER_HISTORY_FILTER_PARAMETERS: LeaveHistoryFilterParameterNames = {
    query: "historyQuery",
    leaveType: "historyLeaveType",
    status: "historyStatus",
    year: "historyYear",
    allowedStatuses: APPROVER_LEAVE_HISTORY_STATUSES,
};

export function parseEmployeeLeaveHistoryFilters(
    url: URL,
): LeaveHistoryFiltersParseResult {
    return parseLeaveHistoryFilters(url, EMPLOYEE_HISTORY_FILTER_PARAMETERS);
}

export function parseApproverLeaveHistoryFilters(
    url: URL,
): LeaveHistoryFiltersParseResult {
    return parseLeaveHistoryFilters(url, APPROVER_HISTORY_FILTER_PARAMETERS);
}

export function parseLeaveHistoryFilters(
    url: URL,
    parameters: LeaveHistoryFilterParameterNames,
): LeaveHistoryFiltersParseResult {
    const query = getOptionalTrimmedValue(url.searchParams.get(parameters.query));
    if (query && query.length > LEAVE_HISTORY_QUERY_MAX_LENGTH) {
        return { success: false, error: INVALID_FILTERS_MESSAGE };
    }

    const leaveTypeValue = getOptionalTrimmedValue(
        url.searchParams.get(parameters.leaveType),
    );
    let leaveType: LeaveType | undefined;
    if (leaveTypeValue) {
        if (!isAllowedValue(leaveTypeValue, ALL_LEAVE_TYPES)) {
            return { success: false, error: INVALID_FILTERS_MESSAGE };
        }
        leaveType = leaveTypeValue;
    }

    const statusValue = getOptionalTrimmedValue(
        url.searchParams.get(parameters.status),
    );
    let status: LeaveStatus | undefined;
    if (statusValue) {
        if (!isAllowedValue(statusValue, parameters.allowedStatuses)) {
            return { success: false, error: INVALID_FILTERS_MESSAGE };
        }
        status = statusValue;
    }

    const yearValue = getOptionalTrimmedValue(url.searchParams.get(parameters.year));
    const yearResult = parseYear(yearValue);
    if (!yearResult.success) {
        return yearResult;
    }

    return {
        success: true,
        filters: {
            ...(query ? { query } : {}),
            ...(leaveType ? { leaveType } : {}),
            ...(status ? { status } : {}),
            ...(yearResult.year !== undefined ? { year: yearResult.year } : {}),
        },
    };
}

export function createLeaveHistoryYearRange(year: number): {
    startOfYear: Date;
    endOfYear: Date;
} {
    return {
        startOfYear: toUtcDate({ year, month: 1, day: 1 }),
        endOfYear: toUtcDate({ year: year + 1, month: 1, day: 1 }),
    };
}

export function buildEmployeeLeaveHistoryFilterWhere(
    filters: LeaveHistoryFilters,
): Prisma.LeaveRequestWhereInput | null {
    const conditions: Prisma.LeaveRequestWhereInput[] = [];
    const query = filters.query?.trim();

    if (query) {
        conditions.push({
            OR: [
                { reason: { contains: query } },
                { emergencyReason: { contains: query } },
                { specialReason: { contains: query } },
                { rejectReason: { contains: query } },
                { notTakenReason: { contains: query } },
                { cancellationReason: { contains: query } },
            ],
        });
    }

    appendLeaveRequestAttributeFilters(conditions, filters);
    return combineLeaveHistoryConditions(conditions);
}

export function buildApproverLeaveHistoryFilterWhere(
    filters: LeaveHistoryFilters,
): Prisma.LeaveRequestWhereInput | null {
    const conditions: Prisma.LeaveRequestWhereInput[] = [];
    const query = filters.query?.trim();

    if (query) {
        conditions.push({
            employee: {
                OR: [
                    { firstName: { contains: query } },
                    { lastName: { contains: query } },
                    { nickname: { contains: query } },
                ],
            },
        });
    }

    appendLeaveRequestAttributeFilters(conditions, filters);
    return combineLeaveHistoryConditions(conditions);
}

export function hasLeaveHistoryFilters(filters: LeaveHistoryFilters): boolean {
    return Boolean(
        filters.query?.trim()
        || filters.leaveType
        || filters.status
        || filters.year !== undefined,
    );
}

export function getAvailableLeaveHistoryYears(
    minDate: Date | string | null,
    maxDate: Date | string | null,
): number[] {
    if (minDate === null || maxDate === null) {
        return [];
    }

    const minYear = getLeaveYearFromDateValue(minDate);
    const maxYear = getLeaveYearFromDateValue(maxDate);
    const firstYear = Math.min(minYear, maxYear);
    const lastYear = Math.max(minYear, maxYear);

    return Array.from(
        { length: lastYear - firstYear + 1 },
        (_, index) => lastYear - index,
    );
}

function appendLeaveRequestAttributeFilters(
    conditions: Prisma.LeaveRequestWhereInput[],
    filters: LeaveHistoryFilters,
): void {
    if (filters.leaveType) {
        conditions.push({ leaveType: filters.leaveType });
    }

    if (filters.status) {
        conditions.push({ status: filters.status });
    }

    if (filters.year !== undefined) {
        const { startOfYear, endOfYear } = createLeaveHistoryYearRange(filters.year);
        conditions.push({
            startDate: {
                gte: startOfYear,
                lt: endOfYear,
            },
        });
    }
}

function combineLeaveHistoryConditions(
    conditions: Prisma.LeaveRequestWhereInput[],
): Prisma.LeaveRequestWhereInput | null {
    return conditions.length > 0 ? { AND: conditions } : null;
}

function getOptionalTrimmedValue(value: string | null): string | undefined {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : undefined;
}

function isAllowedValue<T extends string>(
    value: string,
    allowedValues: readonly T[],
): value is T {
    return allowedValues.some((allowedValue) => allowedValue === value);
}

function parseYear(
    value: string | undefined,
): { success: true; year?: number } | LeaveHistoryFiltersFailure {
    if (value === undefined) {
        return { success: true };
    }

    if (!/^\d{4}$/.test(value)) {
        return { success: false, error: INVALID_FILTERS_MESSAGE };
    }

    const year = Number(value);
    if (
        !Number.isSafeInteger(year)
        || year < LEAVE_HISTORY_MIN_YEAR
        || year > LEAVE_HISTORY_MAX_YEAR
    ) {
        return { success: false, error: INVALID_FILTERS_MESSAGE };
    }

    return { success: true, year };
}
