"use client";

import { useId, useState, type ReactElement } from "react";
import useSWR from "swr";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogScrollArea, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/ui/utils";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { getBusinessDate, toDateOnlyString } from "../domain/business-date";
import type { HolidayReferenceEvent } from "../schemas/holiday-reference";
import {
    fetchHolidayReference, HolidayReferenceClientError, type HolidayReferenceChannel,
} from "./holiday-reference-client";

const CLASSIFICATION_LABELS: Record<HolidayReferenceEvent["classification"], string> = {
    "public-holiday": "วันหยุดตาม Google",
    observance: "วันสำคัญ",
    unverified: "ยังไม่ยืนยันประเภท",
};
const MONTH_FORMAT = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
const DAY_FORMAT = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
const FULL_DATE_FORMAT = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

function displayDate(date: string): Date {
    return new Date(`${date}T00:00:00+07:00`);
}

export function HolidayReferenceViewer({ channel = "dashboard" }: { channel?: HolidayReferenceChannel }): ReactElement | null {
    const [open, setOpen] = useState(false);
    const [today, setToday] = useState(() => getBusinessDate(new Date()));
    const [month, setMonth] = useState(today.month);
    const [selected, setSelected] = useState<string | null>(null);
    const monthId = useId();
    const enabled = isFeatureEnabled(FEATURE_KEYS.leave);
    const { data, error, isLoading, mutate } = useSWR(
        open && enabled ? ["holiday-reference", channel, today.year] : null,
        async () => {
            const result = await fetchHolidayReference(channel);
            if (result.year !== today.year) throw new HolidayReferenceClientError(true);
            return result;
        },
        { revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: true, shouldRetryOnError: false, dedupingInterval: 86400000 },
    );
    if (!enabled) return null;
    const events = data?.events ?? [];
    const byDate = new Map<string, HolidayReferenceEvent[]>();
    for (const event of events) byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
    const monthStart = `${today.year}-${String(month).padStart(2, "0")}-01`;
    const days = new Date(Date.UTC(today.year, month, 0)).getUTCDate();
    const offset = new Date(Date.UTC(today.year, month - 1, 1)).getUTCDay();
    const weeks = Math.ceil((offset + days) / 7);
    const changeMonth = (next: number): void => { setMonth(next); setSelected(null); };

    return (
        <Dialog open={open} onOpenChange={(next) => {
            if (next) {
                const now = getBusinessDate(new Date());
                setToday(now);
                setMonth(now.month);
                setSelected(null);
            }
            setOpen(next);
        }}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" className="self-start">
                    <CalendarDays aria-hidden="true" />ดูปฏิทินวันหยุด
                </Button>
            </DialogTrigger>
            <DialogContent closeLabel="ปิดปฏิทินวันหยุด" className="rounded-xl p-0 sm:max-w-3xl">
                <DialogHeader className="border-b px-4 py-5 pr-16 text-left sm:px-6">
                    <DialogTitle className="leading-7">ปฏิทินวันหยุดประจำปี {today.year + 543}</DialogTitle>
                    <DialogDescription>ข้อมูลอ้างอิงจาก Google Calendar</DialogDescription>
                </DialogHeader>
                <DialogScrollArea className="px-3 pb-4 sm:px-6">
                    <p className="mb-4 text-sm leading-6 text-muted-foreground">
                        วันหยุดและวันสำคัญจาก Google Calendar บางวันอาจไม่ใช่วันหยุดราชการ
                        ข้อมูลอาจไม่ครบถ้วน ใช้เพื่ออ้างอิงเท่านั้น ไม่มีผลต่อการนับวันลาหรือสิทธิ์ลาของ NHF
                        ชื่อรายการแสดงตามต้นฉบับ
                    </p>
                    {isLoading ? <p role="status">กำลังโหลดข้อมูลวันหยุด...</p> : null}
                    {error ? (
                        <Alert role="alert">
                            <AlertDescription className="flex flex-col items-start gap-3">
                                <p>{error instanceof HolidayReferenceClientError && error.incomplete
                                    ? "ข้อมูลวันหยุดปีนี้ยังไม่ครบถ้วนหรือยังยืนยันช่วงข้อมูลไม่ได้ กรุณาลองใหม่อีกครั้ง"
                                    : "ไม่สามารถโหลดข้อมูลวันหยุดได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง"}</p>
                                <Button type="button" variant="outline" onClick={() => { void mutate(); }}>ลองใหม่</Button>
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    {data && !error ? (
                        <div className="grid min-w-0 gap-6 md:grid-cols-2">
                            <section aria-label="ปฏิทินรายเดือน" className="min-w-0">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="เดือนก่อนหน้า" disabled={month === 1} onClick={() => changeMonth(month - 1)}><ChevronLeft aria-hidden="true" /></Button>
                                    <h3 id={monthId} className="font-semibold" aria-live="polite">{MONTH_FORMAT.format(displayDate(monthStart))}</h3>
                                    <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="เดือนถัดไป" disabled={month === 12} onClick={() => changeMonth(month + 1)}><ChevronRight aria-hidden="true" /></Button>
                                </div>
                                <table className="w-full table-fixed border-collapse text-center text-sm" aria-labelledby={monthId}>
                                    <thead><tr>{["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((day, index) => <th scope="col" key={day} className={cn("h-9 font-medium", (index === 0 || index === 6) && "text-muted-foreground")}>{day}</th>)}</tr></thead>
                                    <tbody>{Array.from({ length: weeks }, (_, week) => (
                                        <tr key={week}>{Array.from({ length: 7 }, (_, weekday) => {
                                            const day = week * 7 + weekday - offset + 1;
                                            if (day < 1 || day > days) return <td key={weekday} />;
                                            const date = `${monthStart.slice(0, 8)}${String(day).padStart(2, "0")}`;
                                            const dayEvents = byDate.get(date) ?? [];
                                            const publicHoliday = dayEvents.some((event) => event.classification === "public-holiday");
                                            return <td key={weekday} className="p-0.5">
                                                <button type="button" aria-pressed={selected === date} aria-current={date === toDateOnlyString(today) ? "date" : undefined}
                                                    aria-label={`${FULL_DATE_FORMAT.format(displayDate(date))}${dayEvents.length ? ` · ${dayEvents.length} รายการ · ${[...new Set(dayEvents.map((event) => CLASSIFICATION_LABELS[event.classification]))].join(" / ")}` : ""}`}
                                                    onClick={() => setSelected(date)}
                                                    className={cn("flex min-h-11 w-full flex-col items-center justify-center rounded-md border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent",
                                                        (weekday === 0 || weekday === 6) && "bg-muted text-muted-foreground",
                                                        dayEvents.length > 0 && "border-border bg-accent text-accent-foreground font-semibold",
                                                        selected === date && "ring-2 ring-ring")}>
                                                    {day}<span aria-hidden="true" className={cn("h-1 w-3 rounded-full", dayEvents.length > 0 && (publicHoliday ? "bg-primary" : "bg-muted-foreground"))} />
                                                </button>
                                            </td>;
                                        })}</tr>
                                    ))}</tbody>
                                </table>
                                <p className="mt-3 text-xs leading-5 text-muted-foreground">พื้นสีเทา: เสาร์–อาทิตย์ · ขีดสีหลัก: วันหยุดตาม Google · ขีดสีเทา: วันสำคัญหรือยังไม่ยืนยันประเภท</p>
                                <div className="mt-4" aria-live="polite">
                                    {selected ? <><h4 className="mb-2 text-sm font-semibold">{FULL_DATE_FORMAT.format(displayDate(selected))}</h4><EventList events={byDate.get(selected) ?? []} /></> : <p className="text-sm text-muted-foreground">เลือกวันที่เพื่อดูชื่อรายการ</p>}
                                </div>
                            </section>
                            <section aria-label="รายการวันหยุดทั้งปี" className="min-w-0">
                                <h3 className="mb-3 font-semibold">รายการทั้งปี · {events.length} รายการ</h3>
                                <div role="region" aria-label="เลื่อนดูรายการทั้งปี" tabIndex={0} className="max-h-80 overflow-y-auto overscroll-contain rounded-md pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:max-h-96">
                                    {Array.from({ length: 12 }, (_, index) => index + 1).map((eventMonth) => {
                                        const prefix = `${today.year}-${String(eventMonth).padStart(2, "0")}`;
                                        const monthEvents = events.filter((event) => event.date.startsWith(prefix));
                                        if (!monthEvents.length) return null;
                                        return <div key={prefix} className="mb-5"><h4 className="mb-2 text-sm font-semibold">{MONTH_FORMAT.format(displayDate(`${prefix}-01`))}</h4><EventList events={monthEvents} showDate /></div>;
                                    })}
                                </div>
                            </section>
                        </div>
                    ) : null}
                </DialogScrollArea>
                <DialogFooter className="border-t px-4 py-3 sm:px-6">
                    <DialogClose asChild><Button type="button" variant="outline">กลับไปกรอกคำขอลา</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EventList({ events, showDate = false }: { events: HolidayReferenceEvent[]; showDate?: boolean }): ReactElement {
    if (!events.length) return <p className="text-sm text-muted-foreground">ไม่มีรายการจากแหล่งข้อมูลในวันที่เลือก</p>;
    return <ul className="flex flex-col gap-2 text-sm leading-6">{events.map((event) => (
        <li key={JSON.stringify(event)} className="break-words">
            {showDate ? <><time dateTime={event.date}>{DAY_FORMAT.format(displayDate(event.date))}</time> — </> : null}
            <span>{event.name}</span><span className="block text-xs text-muted-foreground">{CLASSIFICATION_LABELS[event.classification]}</span>
        </li>
    ))}</ul>;
}
