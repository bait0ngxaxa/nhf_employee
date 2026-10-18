"use client";

import { useId, useMemo, type ReactElement } from "react";

import {
    addCalendarDays,
    addCalendarMonths,
    calculateRoutineOccurrences,
    calendarDateToBangkokStart,
    calendarDateToDate,
    compareCalendarDates,
    getCurrentBangkokDate,
    isRoutineOccurrenceWithinContract,
    ROUTINE_BUSINESS_DAY_CANDIDATE_MARGIN_DAYS,
    type CalendarDate,
    type RoutineBusinessDayPolicy,
    type RoutineScheduleType,
    type ScheduledRoutineOccurrence,
} from "../../domain/schedule";
import { buildRoutineScheduleDefinition, routineSchedulePreviewSchema } from "../../schemas/routine";

const ROUTINE_PREVIEW_LIMIT = 5;
const MONTHLY_PREVIEW_MONTHS = 12;
const YEARLY_PREVIEW_MONTHS = 20 * 12;

interface RoutineSchedulePreviewProps {
    scheduleType: RoutineScheduleType;
    scheduleConfig: Record<string, unknown>;
    businessDayPolicy: RoutineBusinessDayPolicy;
    contractStartDate: string;
    contractEndDate: string;
}

type PreviewState =
    | { kind: "manual" }
    | { kind: "empty-window" }
    | { kind: "invalid"; message: string }
    | {
        kind: "ready";
        from: CalendarDate;
        to: CalendarDate;
        occurrences: ScheduledRoutineOccurrence[];
        totalCount: number;
    };

const dateFormatter = new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
});

const weekdayFormatter = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    timeZone: "UTC",
});

function formatRoutineDate(value: CalendarDate): string {
    return dateFormatter.format(calendarDateToBangkokStart(value));
}

function getPreviewStart(
    today: CalendarDate,
    contractStartDate: CalendarDate | null,
    scheduleType: RoutineScheduleType,
    scheduleConfig: Record<string, unknown>,
): CalendarDate {
    let from = contractStartDate
        && compareCalendarDates(contractStartDate, today) > 0
        ? contractStartDate
        : today;

    if (
        scheduleType === "INTERVAL_MONTHS"
        && typeof scheduleConfig.anchorDate === "string"
        && compareCalendarDates(scheduleConfig.anchorDate, from) > 0
    ) {
        from = scheduleConfig.anchorDate;
    }

    return from;
}

function getPreviewHorizonMonths(
    scheduleType: RoutineScheduleType,
    scheduleConfig: Record<string, unknown>,
): number {
    if (scheduleType === "INTERVAL_MONTHS") {
        const intervalMonths = typeof scheduleConfig.intervalMonths === "number"
            ? scheduleConfig.intervalMonths
            : Number(scheduleConfig.intervalMonths);
        return intervalMonths * ROUTINE_PREVIEW_LIMIT + 7;
    }
    if (scheduleType === "YEARLY_DATE") return YEARLY_PREVIEW_MONTHS;
    return MONTHLY_PREVIEW_MONTHS;
}

function createPreviewState(
    props: RoutineSchedulePreviewProps,
): PreviewState {
    const validation = routineSchedulePreviewSchema.safeParse({
        scheduleType: props.scheduleType,
        scheduleConfig: props.scheduleConfig,
        businessDayPolicy: props.businessDayPolicy,
        contractStartDate: props.contractStartDate || null,
        contractEndDate: props.contractEndDate || null,
    });

    if (!validation.success) {
        return {
            kind: "invalid",
            message: validation.error.issues[0]?.message
                ?? "กรุณาตรวจสอบค่ากำหนดการและช่วงสัญญา",
        };
    }

    if (validation.data.scheduleType === "MANUAL") return { kind: "manual" };

    try {
        const definition = buildRoutineScheduleDefinition(
            validation.data.scheduleType,
            validation.data.scheduleConfig,
        );
        const today = getCurrentBangkokDate();
        const contractStartDate = validation.data.contractStartDate ?? null;
        const contractEndDate = validation.data.contractEndDate ?? null;
        const from = getPreviewStart(
            today,
            contractStartDate,
            definition.scheduleType,
            props.scheduleConfig,
        );
        let rawEnd: CalendarDate;
        if (definition.scheduleType === "ONE_TIME") {
            const adjustmentBoundary = addCalendarDays(
                from,
                ROUTINE_BUSINESS_DAY_CANDIDATE_MARGIN_DAYS,
            );
            rawEnd = compareCalendarDates(
                definition.config.date,
                adjustmentBoundary,
            ) > 0
                ? definition.config.date
                : adjustmentBoundary;
        } else {
            rawEnd = addCalendarMonths(
                from,
                getPreviewHorizonMonths(definition.scheduleType, props.scheduleConfig),
            );
        }
        const to = contractEndDate
            && compareCalendarDates(contractEndDate, rawEnd) < 0
            ? contractEndDate
            : rawEnd;
        if (compareCalendarDates(to, from) < 0) return { kind: "empty-window" };
        const allOccurrences = calculateRoutineOccurrences(
            definition,
            { from, to },
            validation.data.businessDayPolicy,
        );
        const upcoming = allOccurrences
            .filter((occurrence) =>
                compareCalendarDates(occurrence.dueDate, from) >= 0
                && isRoutineOccurrenceWithinContract(
                    occurrence,
                    contractStartDate,
                    contractEndDate,
                ),
            )
            .sort((left, right) =>
                compareCalendarDates(left.dueDate, right.dueDate)
                || compareCalendarDates(left.originalDueDate, right.originalDueDate),
            );

        return {
            kind: "ready",
            from,
            to,
            occurrences: upcoming.slice(0, ROUTINE_PREVIEW_LIMIT),
            totalCount: upcoming.length,
        };
    } catch {
        return {
            kind: "invalid",
            message: "ช่วงวันที่นี้ยังแสดงตัวอย่างไม่ได้ กรุณาตรวจสอบวันที่และการตั้งค่ากำหนดการ",
        };
    }
}

function getAdjustmentDescription(
    occurrence: ScheduledRoutineOccurrence,
    policy: RoutineBusinessDayPolicy,
): { weekday: string; direction: string } | null {
    if (
        occurrence.originalDueDate === occurrence.dueDate
        || policy === "NONE"
    ) {
        return null;
    }

    const originalWeekday = weekdayFormatter.format(
        calendarDateToDate(occurrence.originalDueDate),
    );
    const direction = policy === "PREVIOUS_BUSINESS_DAY"
        ? "วันทำการก่อนหน้า"
        : "วันทำการถัดไป";

    return { weekday: originalWeekday, direction };
}

export function RoutineSchedulePreview(props: RoutineSchedulePreviewProps): ReactElement {
    const headingId = useId();
    const preview = useMemo(() => createPreviewState({
        scheduleType: props.scheduleType,
        scheduleConfig: props.scheduleConfig,
        businessDayPolicy: props.businessDayPolicy,
        contractStartDate: props.contractStartDate,
        contractEndDate: props.contractEndDate,
    }), [
        props.businessDayPolicy,
        props.contractEndDate,
        props.contractStartDate,
        props.scheduleConfig,
        props.scheduleType,
    ]);

    return (
        <section
            aria-labelledby={headingId}
            className="space-y-3 rounded-lg border border-border-subtle bg-surface-raised p-4"
        >
            <div className="space-y-1">
                <h3
                    id={headingId}
                    className="font-semibold text-content-heading"
                >
                    ตัวอย่างกำหนดการถัดไป
                </h3>
                <p className="text-sm leading-6 text-content-secondary">
                    ตัวอย่างนี้ใช้ประกอบการตั้งค่า ยังไม่ใช่งานที่บันทึกแล้ว และระบบจะสร้างงานตามรอบประมวลผล
                </p>
            </div>

            {preview.kind === "manual" ? (
                <p className="rounded-md bg-surface-neutral-subtle px-3 py-2 text-sm leading-6 text-content-body" role="status">
                    งานแบบสร้างเองไม่มีรายการที่จะเกิดขึ้นโดยอัตโนมัติ
                </p>
            ) : null}

            {preview.kind === "empty-window" ? (
                <>
                    <p className="text-sm font-medium text-content-heading" role="status" aria-live="polite">
                        พบ 0 รายการในช่วงนี้
                    </p>
                    <p className="rounded-md bg-surface-neutral-subtle px-3 py-2 text-sm leading-6 text-content-body">
                        ไม่มีช่วงวันที่ในอนาคตให้แสดงตามวันครบกำหนดหรือวันสิ้นสุดสัญญาที่ระบุ
                    </p>
                </>
            ) : null}

            {preview.kind === "invalid" ? (
                <p className="rounded-md border border-status-warning-border bg-status-warning-surface px-3 py-2 text-sm leading-6 text-status-warning-foreground" role="status" aria-live="polite">
                    ยังแสดงตัวอย่างไม่ได้: {preview.message}
                </p>
            ) : null}

            {preview.kind === "ready" ? (
                <>
                    <p className="text-sm leading-6 text-content-secondary">
                        ช่วงตัวอย่าง {formatRoutineDate(preview.from)} – {formatRoutineDate(preview.to)}
                    </p>
                    <p className="text-sm font-medium text-content-heading" role="status" aria-live="polite">
                        {preview.totalCount > ROUTINE_PREVIEW_LIMIT
                            ? `แสดง ${ROUTINE_PREVIEW_LIMIT} รายการแรกจาก ${preview.totalCount} รายการในช่วงนี้`
                            : `พบ ${preview.totalCount} รายการในช่วงนี้`}
                    </p>
                    {preview.occurrences.length > 0 ? (
                        <ol className="divide-y divide-border-subtle" aria-label="วันที่ครบกำหนดที่คำนวณได้">
                            {preview.occurrences.map((occurrence) => {
                                const adjustment = getAdjustmentDescription(
                                    occurrence,
                                    props.businessDayPolicy,
                                );
                                return (
                                    <li key={occurrence.periodKey} className="py-3 first:pt-0 last:pb-0">
                                        <p className="font-medium tabular-nums text-content-heading">
                                            <time dateTime={occurrence.dueDate}>
                                                {formatRoutineDate(occurrence.dueDate)}
                                            </time>
                                        </p>
                                        {adjustment ? (
                                            <p className="mt-1 text-sm leading-6 text-content-secondary">
                                                วันเดิม <time dateTime={occurrence.originalDueDate}>
                                                    {formatRoutineDate(occurrence.originalDueDate)}
                                                </time> ตรงกับ{adjustment.weekday} จึงเลื่อนไป{adjustment.direction}
                                            </p>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ol>
                    ) : (
                        <p className="rounded-md bg-surface-neutral-subtle px-3 py-2 text-sm leading-6 text-content-body">
                            ไม่พบวันครบกำหนดในช่วงตัวอย่างนี้
                        </p>
                    )}
                </>
            ) : null}

            <p className="text-xs leading-5 text-content-secondary">
                การเลื่อนวันทำการพิจารณาเฉพาะวันเสาร์–อาทิตย์ ไม่รวมวันหยุดนักขัตฤกษ์
            </p>
        </section>
    );
}
