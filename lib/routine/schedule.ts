export const ROUTINE_TIME_ZONE = "Asia/Bangkok" as const;
export const ROUTINE_GENERATION_HORIZON_MONTHS = 2 as const;
export const ROUTINE_GENERATION_SAFETY_DAYS = 7 as const;
export const ROUTINE_BUSINESS_DAY_CANDIDATE_MARGIN_DAYS = 7 as const;
export const ROUTINE_MAX_REMINDER_DAYS_BEFORE = 365 as const;
export const ROUTINE_RECONCILIATION_MAX_FUTURE_DAYS =
    ROUTINE_MAX_REMINDER_DAYS_BEFORE
    + ROUTINE_GENERATION_SAFETY_DAYS
    + 31
    + ROUTINE_BUSINESS_DAY_CANDIDATE_MARGIN_DAYS;

// Phase 1 treats Saturday and Sunday as non-business days; public holidays are deferred.

export const ROUTINE_SCHEDULE_TYPES = [
    "MONTHLY_DAY",
    "MONTH_END",
    "INTERVAL_MONTHS",
    "YEARLY_DATE",
    "ONE_TIME",
    "MANUAL",
] as const;
export type RoutineScheduleType = (typeof ROUTINE_SCHEDULE_TYPES)[number];

export const ROUTINE_BUSINESS_DAY_POLICIES = [
    "NONE",
    "PREVIOUS_BUSINESS_DAY",
    "NEXT_BUSINESS_DAY",
] as const;
export type RoutineBusinessDayPolicy =
    (typeof ROUTINE_BUSINESS_DAY_POLICIES)[number];

export type CalendarDate = string;

export interface MonthlyDayScheduleConfig {
    day: number;
    monthOffset: number;
}

export interface MonthEndScheduleConfig {
    [key: string]: never;
}

export interface IntervalMonthsScheduleConfig {
    intervalMonths: number;
    anchorDate: CalendarDate;
}

export interface YearlyDateScheduleConfig {
    month: number;
    day: number;
}

export interface OneTimeScheduleConfig {
    date: CalendarDate;
}

export interface ManualScheduleConfig {
    [key: string]: never;
}

export type RoutineScheduleDefinition =
    | { scheduleType: "MONTHLY_DAY"; config: MonthlyDayScheduleConfig }
    | { scheduleType: "MONTH_END"; config: MonthEndScheduleConfig }
    | { scheduleType: "INTERVAL_MONTHS"; config: IntervalMonthsScheduleConfig }
    | { scheduleType: "YEARLY_DATE"; config: YearlyDateScheduleConfig }
    | { scheduleType: "ONE_TIME"; config: OneTimeScheduleConfig }
    | { scheduleType: "MANUAL"; config: ManualScheduleConfig };

export type RoutineScheduleConfig = RoutineScheduleDefinition["config"];

export interface RoutineDateWindow {
    from: CalendarDate;
    to: CalendarDate;
}

export interface ScheduledRoutineOccurrence {
    periodKey: string;
    originalDueDate: CalendarDate;
    dueDate: CalendarDate;
}

interface CalendarDateParts {
    year: number;
    month: number;
    day: number;
}

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number): string {
    return String(value).padStart(2, "0");
}

function dateParts(value: CalendarDate): CalendarDateParts {
    const match = CALENDAR_DATE_PATTERN.exec(value);
    if (!match) {
        throw new RangeError("Invalid calendar date");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));

    if (
        candidate.getUTCFullYear() !== year
        || candidate.getUTCMonth() !== month - 1
        || candidate.getUTCDate() !== day
    ) {
        throw new RangeError("Invalid calendar date");
    }

    return { year, month, day };
}

function fromDateParts(parts: CalendarDateParts): CalendarDate {
    const value = `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}`;
    dateParts(value);
    return value;
}

function monthStartFromIndex(monthIndex: number): CalendarDate {
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex - year * 12 + 1;
    return fromDateParts({ year, month, day: 1 });
}

function monthIndex(value: CalendarDate): number {
    const parts = dateParts(value);
    return parts.year * 12 + parts.month - 1;
}

function makeDate(year: number, month: number, day: number): CalendarDate {
    const safeDay = Math.min(day, daysInMonth(year, month));
    return fromDateParts({ year, month, day: safeDay });
}

function makeExactDate(
    year: number,
    month: number,
    day: number,
): CalendarDate | null {
    if (day > daysInMonth(year, month)) return null;
    return fromDateParts({ year, month, day });
}

export function isCalendarDate(value: string): boolean {
    try {
        dateParts(value);
        return true;
    } catch {
        return false;
    }
}

export function compareCalendarDates(
    left: CalendarDate,
    right: CalendarDate,
): number {
    if (left === right) return 0;
    return left < right ? -1 : 1;
}

export function calendarDateToDate(value: CalendarDate): Date {
    dateParts(value);
    return new Date(`${value}T00:00:00.000Z`);
}

export function calendarDateToBangkokStart(value: CalendarDate): Date {
    dateParts(value);
    return new Date(`${value}T00:00:00.000+07:00`);
}

export function toBangkokCalendarDate(value: Date): CalendarDate {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: ROUTINE_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = formatter.formatToParts(value);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (!year || !month || !day) {
        throw new RangeError("Unable to format calendar date");
    }
    return `${year}-${month}-${day}`;
}

export function getCurrentBangkokDate(now = new Date()): CalendarDate {
    return toBangkokCalendarDate(now);
}

export function getCurrentBangkokHour(now = new Date()): number {
    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: ROUTINE_TIME_ZONE,
        hour: "2-digit",
        hourCycle: "h23",
    });
    return Number(formatter.format(now));
}

export function formatRoutineSendTime(sendHour: number): string {
    if (!Number.isInteger(sendHour) || sendHour < 0 || sendHour > 23) {
        throw new RangeError("Invalid Routine send hour");
    }
    return `${pad(sendHour)}:00`;
}

export function parseRoutineSendTime(value: string): number | null {
    const match = /^(?:[01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match || match[1] !== "00") return null;
    return Number(value.slice(0, 2));
}

export function isRoutineReminderDue(
    dueDate: CalendarDate,
    daysBefore: number,
    sendHour: number,
    now = new Date(),
): boolean {
    return isRoutineReminderSendable(dueDate, daysBefore, sendHour, now);
}

export function getRoutineReminderScheduledFor(
    dueDate: CalendarDate,
    daysBefore: number,
    sendHour: number,
): Date {
    const reminderDate = addCalendarDays(dueDate, -daysBefore);
    return new Date(
        calendarDateToBangkokStart(reminderDate).getTime()
        + sendHour * 60 * 60 * 1000,
    );
}

export function getRoutineDueDateEnd(dueDate: CalendarDate): Date {
    return calendarDateToBangkokStart(addCalendarDays(dueDate, 1));
}

export function isRoutineReminderExpired(
    dueDate: CalendarDate,
    now = new Date(),
): boolean {
    return now.getTime() >= getRoutineDueDateEnd(dueDate).getTime();
}

export function isRoutineReminderSendable(
    dueDate: CalendarDate,
    daysBefore: number,
    sendHour: number,
    now = new Date(),
): boolean {
    return (
        now.getTime() >= getRoutineReminderScheduledFor(
            dueDate,
            daysBefore,
            sendHour,
        ).getTime()
        && !isRoutineReminderExpired(dueDate, now)
    );
}

export function addCalendarDays(
    value: CalendarDate,
    amount: number,
): CalendarDate {
    const parts = dateParts(value);
    const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    result.setUTCDate(result.getUTCDate() + amount);
    return fromDateParts({
        year: result.getUTCFullYear(),
        month: result.getUTCMonth() + 1,
        day: result.getUTCDate(),
    });
}

export function calendarDayDifference(
    from: CalendarDate,
    to: CalendarDate,
): number {
    dateParts(from);
    dateParts(to);
    return Math.round(
        (calendarDateToDate(to).getTime() - calendarDateToDate(from).getTime())
        / 86_400_000,
    );
}

export function addCalendarMonths(
    value: CalendarDate,
    amount: number,
): CalendarDate {
    const parts = dateParts(value);
    const targetMonthIndex = monthIndex(value) + amount;
    const targetMonth = monthStartFromIndex(targetMonthIndex);
    const targetParts = dateParts(targetMonth);
    return makeDate(targetParts.year, targetParts.month, parts.day);
}

export function startOfMonth(value: CalendarDate): CalendarDate {
    const parts = dateParts(value);
    return fromDateParts({ year: parts.year, month: parts.month, day: 1 });
}

export function endOfMonth(value: CalendarDate): CalendarDate {
    const start = startOfMonth(value);
    const nextMonth = addCalendarMonths(start, 1);
    return addCalendarDays(nextMonth, -1);
}

export function daysInMonth(year: number, month: number): number {
    if (month < 1 || month > 12) {
        throw new RangeError("Invalid month");
    }
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function applyBusinessDayPolicy(
    value: CalendarDate,
    policy: RoutineBusinessDayPolicy,
): CalendarDate {
    if (policy === "NONE") return value;

    let result = value;
    const step = policy === "PREVIOUS_BUSINESS_DAY" ? -1 : 1;
    while (true) {
        const weekday = calendarDateToDate(result).getUTCDay();
        if (weekday !== 0 && weekday !== 6) return result;
        result = addCalendarDays(result, step);
    }
}

function monthKey(value: CalendarDate): string {
    return startOfMonth(value).slice(0, 7);
}

function monthDifference(
    earlierMonth: CalendarDate,
    laterMonth: CalendarDate,
): number {
    return monthIndex(laterMonth) - monthIndex(earlierMonth);
}

function isWithinWindow(value: CalendarDate, window: RoutineDateWindow): boolean {
    return (
        compareCalendarDates(value, window.from) >= 0
        && compareCalendarDates(value, window.to) <= 0
    );
}

function isWithinRoutineTargetWindow(
    occurrence: Pick<ScheduledRoutineOccurrence, "originalDueDate" | "dueDate">,
    window: RoutineDateWindow,
): boolean {
    // Keep a period anchored at a target boundary when its weekend adjustment crosses it.
    return (
        isWithinWindow(occurrence.originalDueDate, window)
        || isWithinWindow(occurrence.dueDate, window)
    );
}

export function getRoutineCandidateCalculationWindow(
    targetWindow: RoutineDateWindow,
): RoutineDateWindow {
    return {
        from: addCalendarDays(
            targetWindow.from,
            -ROUTINE_BUSINESS_DAY_CANDIDATE_MARGIN_DAYS,
        ),
        to: addCalendarDays(
            targetWindow.to,
            ROUTINE_BUSINESS_DAY_CANDIDATE_MARGIN_DAYS,
        ),
    };
}

function calculateMonthlyOccurrences(
    config: MonthlyDayScheduleConfig,
    candidateWindow: RoutineDateWindow,
    targetWindow: RoutineDateWindow,
    policy: RoutineBusinessDayPolicy,
): ScheduledRoutineOccurrence[] {
    const firstBaseMonth = addCalendarMonths(
        startOfMonth(candidateWindow.from),
        -config.monthOffset,
    );
    const lastBaseMonth = addCalendarMonths(
        startOfMonth(candidateWindow.to),
        -config.monthOffset,
    );
    const occurrences: ScheduledRoutineOccurrence[] = [];

    for (
        let baseMonth = startOfMonth(firstBaseMonth);
        compareCalendarDates(baseMonth, lastBaseMonth) <= 0;
        baseMonth = addCalendarMonths(baseMonth, 1)
    ) {
        const shiftedMonth = addCalendarMonths(baseMonth, config.monthOffset);
        const shiftedParts = dateParts(shiftedMonth);
        const originalDueDate = makeExactDate(
            shiftedParts.year,
            shiftedParts.month,
            config.day,
        );
        if (!originalDueDate) continue;
        const dueDate = applyBusinessDayPolicy(originalDueDate, policy);
        const occurrence = {
            periodKey: monthKey(baseMonth),
            originalDueDate,
            dueDate,
        };
        if (!isWithinRoutineTargetWindow(occurrence, targetWindow)) continue;

        occurrences.push(occurrence);
    }

    return occurrences;
}

function calculateMonthEndOccurrences(
    candidateWindow: RoutineDateWindow,
    targetWindow: RoutineDateWindow,
    policy: RoutineBusinessDayPolicy,
): ScheduledRoutineOccurrence[] {
    const occurrences: ScheduledRoutineOccurrence[] = [];
    for (
        let month = startOfMonth(candidateWindow.from);
        compareCalendarDates(month, startOfMonth(candidateWindow.to)) <= 0;
        month = addCalendarMonths(month, 1)
    ) {
        const originalDueDate = endOfMonth(month);
        const dueDate = applyBusinessDayPolicy(originalDueDate, policy);
        const occurrence = {
            periodKey: monthKey(month),
            originalDueDate,
            dueDate,
        };
        if (!isWithinRoutineTargetWindow(occurrence, targetWindow)) continue;
        occurrences.push(occurrence);
    }
    return occurrences;
}

function calculateIntervalOccurrences(
    config: IntervalMonthsScheduleConfig,
    candidateWindow: RoutineDateWindow,
    targetWindow: RoutineDateWindow,
    policy: RoutineBusinessDayPolicy,
): ScheduledRoutineOccurrence[] {
    const anchor = dateParts(config.anchorDate);
    const anchorMonth = startOfMonth(config.anchorDate);
    const occurrences: ScheduledRoutineOccurrence[] = [];

    for (
        let month = startOfMonth(candidateWindow.from);
        compareCalendarDates(month, startOfMonth(candidateWindow.to)) <= 0;
        month = addCalendarMonths(month, 1)
    ) {
        const distance = monthDifference(anchorMonth, month);
        if (distance < 0 || distance % config.intervalMonths !== 0) continue;

        const parts = dateParts(month);
        const originalDueDate = makeExactDate(parts.year, parts.month, anchor.day);
        if (!originalDueDate) continue;
        if (compareCalendarDates(originalDueDate, config.anchorDate) < 0) continue;
        const dueDate = applyBusinessDayPolicy(originalDueDate, policy);
        const occurrence = {
            periodKey: monthKey(month),
            originalDueDate,
            dueDate,
        };
        if (!isWithinRoutineTargetWindow(occurrence, targetWindow)) continue;
        occurrences.push(occurrence);
    }
    return occurrences;
}

function calculateYearlyOccurrences(
    config: YearlyDateScheduleConfig,
    candidateWindow: RoutineDateWindow,
    targetWindow: RoutineDateWindow,
    policy: RoutineBusinessDayPolicy,
): ScheduledRoutineOccurrence[] {
    const firstYear = dateParts(candidateWindow.from).year;
    const lastYear = dateParts(candidateWindow.to).year;
    const occurrences: ScheduledRoutineOccurrence[] = [];

    for (let year = firstYear; year <= lastYear; year += 1) {
        const originalDueDate = makeExactDate(year, config.month, config.day);
        if (!originalDueDate) continue;
        const dueDate = applyBusinessDayPolicy(originalDueDate, policy);
        const occurrence = {
            periodKey: `${year}-${pad(config.month)}`,
            originalDueDate,
            dueDate,
        };
        if (!isWithinRoutineTargetWindow(occurrence, targetWindow)) continue;
        occurrences.push(occurrence);
    }
    return occurrences;
}

export function calculateRoutineOccurrences(
    definition: RoutineScheduleDefinition,
    window: RoutineDateWindow,
    policy: RoutineBusinessDayPolicy,
): ScheduledRoutineOccurrence[] {
    if (compareCalendarDates(window.from, window.to) > 0) {
        return [];
    }

    const candidateWindow = getRoutineCandidateCalculationWindow(window);
    let occurrences: ScheduledRoutineOccurrence[];

    switch (definition.scheduleType) {
        case "MONTHLY_DAY":
            occurrences = calculateMonthlyOccurrences(
                definition.config,
                candidateWindow,
                window,
                policy,
            );
            break;
        case "MONTH_END":
            occurrences = calculateMonthEndOccurrences(
                candidateWindow,
                window,
                policy,
            );
            break;
        case "INTERVAL_MONTHS":
            occurrences = calculateIntervalOccurrences(
                definition.config,
                candidateWindow,
                window,
                policy,
            );
            break;
        case "YEARLY_DATE":
            occurrences = calculateYearlyOccurrences(
                definition.config,
                candidateWindow,
                window,
                policy,
            );
            break;
        case "ONE_TIME": {
            const originalDueDate = definition.config.date;
            const dueDate = applyBusinessDayPolicy(originalDueDate, policy);
            const occurrence = { periodKey: originalDueDate, originalDueDate, dueDate };
            occurrences = isWithinRoutineTargetWindow(occurrence, window)
                ? [occurrence]
                : [];
            break;
        }
        case "MANUAL":
            occurrences = [];
            break;
    }

    return [...new Map(
        occurrences.map((occurrence) => [occurrence.periodKey, occurrence]),
    ).values()];
}

export function getRoutineGenerationWindow(
    now = new Date(),
    maxActiveDaysBefore = 0,
): RoutineDateWindow {
    if (
        !Number.isInteger(maxActiveDaysBefore)
        || maxActiveDaysBefore < 0
    ) {
        throw new RangeError("Invalid Routine reminder horizon");
    }

    const today = getCurrentBangkokDate(now);
    const currentMonth = startOfMonth(today);
    const baselineTo = endOfMonth(
        addCalendarMonths(currentMonth, ROUTINE_GENERATION_HORIZON_MONTHS),
    );
    const reminderTo = endOfMonth(
        addCalendarDays(
            today,
            maxActiveDaysBefore + ROUTINE_GENERATION_SAFETY_DAYS,
        ),
    );
    return {
        from: currentMonth,
        to: compareCalendarDates(baselineTo, reminderTo) >= 0
            ? baselineTo
            : reminderTo,
    };
}
