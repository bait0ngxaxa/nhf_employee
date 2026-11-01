"use client";

import { createContext, useContext, useRef, useState, type ReactElement } from "react";
import { DayPicker, TZDate, DayButton, type DayButtonProps } from "react-day-picker";
import { th } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { toDateOnlyString, LEAVE_BUSINESS_TIME_ZONE } from "../domain/business-date";
import { isWorkingDay } from "../domain/utils";
import type { useLeaveRequestFormModel } from "./dashboard/hooks/useLeaveRequestFormModel";
import type { HolidayReferenceChannel } from "./holiday-reference-client";
import { HolidayReferenceClientError } from "./holiday-reference-client";
import { useHolidayReference } from "./useHolidayReference";
import { AnnualHolidayOverview, HolidayDetails } from "./HolidayDetails";
import { formatCalendarDate, HOLIDAY_LABELS } from "./holiday-display";
import type { HolidayReferenceEvent } from "../schemas/holiday-reference";

type Model = ReturnType<typeof useLeaveRequestFormModel>;

export function LeaveDateCalendar({ model, channel }: { model: Model; channel: HolidayReferenceChannel }): ReactElement {
    const [month, setMonth] = useState<Date>(() => new TZDate(`${model.startDateValue}T12:00:00+07:00`, LEAVE_BUSINESS_TIME_ZONE));
    const [detail, setDetail] = useState<{ date: string; anchor: HTMLButtonElement } | null>(null);
    const [host, setHost] = useState<HTMLDivElement | null>(null);
    const committedSummaryRef = useRef<HTMLParagraphElement>(null);
    const year = Number(toDateOnlyString(month).slice(0, 4));
    const { data, error, isLoading, mutate, supported } = useHolidayReference(channel, year);
    const events = !error ? data?.events ?? [] : [];
    const byDate = new Map<string, typeof events>();
    for (const event of events) byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
    const { start, end } = model.draftDates;
    const dateKey = (date: Date): string => toDateOnlyString(date);
    const inRange = (date: Date): boolean => !!end && dateKey(date) >= start && dateKey(date) <= end;

    return <CalendarEvents.Provider value={byDate}><section aria-label="เลือกวันที่ลา" data-calendar-month={toDateOnlyString(month).slice(0, 7)} className="min-w-0 space-y-3">
        <h3 className="text-sm font-medium">เลือกวันที่ลา</h3>
        <p className="text-xs leading-5 text-muted-foreground">{model.isMultiDay ? "เลือกวันเริ่มต้น แล้วเลือกวันสิ้นสุด" : "เลือกวันทำงานที่ต้องการลา"} · เสาร์–อาทิตย์เลือกเป็นวันเริ่มต้นหรือสิ้นสุดไม่ได้</p>
        <div ref={setHost} className="relative min-w-0 rounded-lg border p-2 sm:p-3">
            <DayPicker locale={th} weekStartsOn={0} timeZone={LEAVE_BUSINESS_TIME_ZONE} month={month}
                onMonthChange={(next) => { setDetail(null); setMonth(next); }} navLayout="around"
                disabled={model.isSubmitting} onDayClick={(date, modifiers, event) => {
                    if (modifiers.disabled) return;
                    const key = dateKey(date);
                    model.selectDraftDate(key);
                    setDetail(byDate.has(key) && event.currentTarget instanceof HTMLButtonElement ? { date: key, anchor: event.currentTarget } : null);
                }}
                modifiers={{ selected: inRange, range_start: (date) => dateKey(date) === start,
                    range_end: (date) => dateKey(date) === end, range_middle: (date) => inRange(date) && dateKey(date) !== start && dateKey(date) !== end,
                    weekend: (date) => !isWorkingDay(dateKey(date)) }}
                modifiersClassNames={{ weekend: "bg-muted text-muted-foreground", range_middle: "bg-primary/15", range_start: "rounded-l-md bg-primary text-primary-foreground", range_end: "rounded-r-md bg-primary text-primary-foreground" }}
                formatters={{ formatCaption: (date) => formatCalendarDate(dateKey(date), true), formatWeekdayName: (date) => ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][date.getDay()] }}
                labels={{ labelPrevious: () => "เดือนก่อนหน้า", labelNext: () => "เดือนถัดไป", labelGrid: (date) => formatCalendarDate(dateKey(date), true),
                    labelDayButton: (date) => {
                        const key = dateKey(date);
                        const items = byDate.get(key) ?? [];
                        return `${formatCalendarDate(key)}${!isWorkingDay(key) ? " · วันหยุดสุดสัปดาห์ เลือกไม่ได้" : ""}${items.length ? ` · ${items.map((item) => HOLIDAY_LABELS[item.classification]).join(" / ")}` : ""}`;
                    } }}
                classNames={{ root: "w-full", months: "w-full", month: "relative w-full", month_caption: "flex h-11 items-center justify-center px-11 font-semibold", caption_label: "text-sm sm:text-base", nav: "flex justify-between", button_previous: "absolute left-0 top-0 size-11 rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring", button_next: "absolute right-0 top-0 size-11 rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring", chevron: "mx-auto size-5 fill-current", month_grid: "w-full table-fixed border-collapse text-center text-sm", weekday: "h-9 text-xs font-medium text-muted-foreground", day: "p-0 text-center", day_button: "relative flex min-h-11 w-full flex-col items-center justify-center rounded-md hover:ring-1 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", today: "font-bold underline underline-offset-4" }}
                components={{ DayButton: HolidayDayButton }} />
            {model.step === "edit" && detail && host && byDate.has(detail.date) ? <HolidayDetails key={detail.date} {...detail} events={byDate.get(detail.date) ?? []} calendar={host} close={() => setDetail(null)} /> : null}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">วันนี้: ขีดใต้ · เสาร์–อาทิตย์: พื้นเทา · ขีดทึบ: วันหยุดตาม Google · วงกลมโปร่ง: วันสำคัญ · กรอบเส้นประ: ยังไม่ยืนยันประเภท</p>
        <div aria-live="polite" className="space-y-2 text-sm leading-6">
            {model.hasPendingDates ? <p>กำลังเลือก: {formatCalendarDate(start)}{model.isMultiDay ? ` – ${formatCalendarDate(end)}` : ""}</p> : null}
            {model.draftDateWarning ? <p role="alert" className="text-status-danger-strong">{model.draftDateWarning}</p> : null}
            {model.hasPendingDates ? <p>ยังไม่ยืนยันวันที่ กรุณายืนยันหรือยกเลิกก่อนตรวจสอบคำขอ</p> : null}
            {model.hasPendingDates ? <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={model.isSubmitting || !!model.draftDateWarning} onClick={() => {
                    setDetail(null);
                    model.confirmDraftDates();
                    committedSummaryRef.current?.focus();
                }}>ยืนยันวันที่ลา</Button>
                <Button type="button" variant="outline" disabled={model.isSubmitting} onClick={() => {
                    model.discardDraftDates();
                    committedSummaryRef.current?.focus();
                }}>ยกเลิกวันที่ที่กำลังเลือก</Button>
            </div> : null}
            <p ref={committedSummaryRef} tabIndex={-1} className="rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">วันที่ในคำขอ: {formatCalendarDate(model.startDateValue)}{model.isMultiDay ? ` – ${formatCalendarDate(model.endDateValue)}` : ""}</p>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">ข้อมูลจาก Google Calendar ใช้อ้างอิงเท่านั้น อาจไม่ครบถ้วน ไม่มีผลต่อการนับวันลาหรือสิทธิ์ลาของ NHF</p>
        {isLoading ? <p role="status" className="text-xs">กำลังโหลดข้อมูลวันหยุด...</p> : null}
        {!supported ? <p role="status" className="text-xs">ไม่มีข้อมูลวันหยุดอ้างอิงสำหรับปีนี้ ยังเลือกวันที่ลาได้ตามปกติ</p> : error ? <div role="status" className="text-xs leading-5">
            <p>{error instanceof HolidayReferenceClientError && error.incomplete ? "ข้อมูลวันหยุดปีนี้ยังไม่ครบถ้วนหรือยังยืนยันช่วงข้อมูลไม่ได้" : "ไม่สามารถโหลดข้อมูลวันหยุดได้ในขณะนี้"} · ยังเลือกวันที่ลาได้ตามปกติ</p>
            <Button type="button" variant="ghost" disabled={model.isSubmitting} onClick={() => { void mutate(); }}>ลองใหม่</Button>
        </div> : data ? <AnnualHolidayOverview events={events} year={year} /> : null}
    </section></CalendarEvents.Provider>;
}

const CalendarEvents = createContext(new Map<string, readonly HolidayReferenceEvent[]>());

function HolidayDayButton(props: DayButtonProps): ReactElement {
    const byDate = useContext(CalendarEvents);
    const { day, modifiers, children } = props;
    const key = toDateOnlyString(day.date);
    const items = byDate.get(key) ?? [];
    return <DayButton {...props} aria-disabled={props.disabled || !isWorkingDay(key)} aria-current={modifiers.today ? "date" : undefined}
        aria-pressed={!!(modifiers.selected || modifiers.range_start)}>
        {children}<span aria-hidden="true" className="flex h-2 items-center gap-0.5">{[...new Set(items.map((item) => item.classification))].map((classification) => <span key={classification} className={classification === "public-holiday" ? "h-1 w-3 rounded-full bg-current" : classification === "observance" ? "size-1.5 rounded-full border border-current" : "size-1.5 border border-dashed border-current"} />)}</span>
    </DayButton>;
}
