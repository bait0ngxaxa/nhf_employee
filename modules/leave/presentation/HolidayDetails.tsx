"use client";

import { Popover } from "radix-ui";
import { X } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import type { HolidayReferenceEvent } from "../schemas/holiday-reference";
import { formatCalendarDate, holidayDisplayName, HOLIDAY_LABELS } from "./holiday-display";

export function HolidayEventList({ events }: { events: readonly HolidayReferenceEvent[] }): ReactElement {
    return <ul className="space-y-2 text-sm leading-6">{events.map((event) => <li key={JSON.stringify(event)} className="break-words">
        <span>{holidayDisplayName(event.name)}</span>
        <span className="block text-xs text-muted-foreground">{HOLIDAY_LABELS[event.classification]}</span>
    </li>)}</ul>;
}

export function HolidayDetails({ date, events, anchor, calendar, close }: {
    date: string; events: readonly HolidayReferenceEvent[]; anchor: HTMLButtonElement;
    calendar: HTMLElement; close: () => void;
}): ReactElement {
    const modal = calendar.closest('[role="dialog"]');
    return <Popover.Root open onOpenChange={(open) => { if (!open) close(); }}>
        {/* Anchor outside the whole grid so scrollable details never cover a range endpoint. */}
        <Popover.Anchor virtualRef={{ current: calendar }} />
        <Popover.Portal container={modal ?? calendar}>
            <Popover.Content aria-label="ข้อมูลวันหยุด" aria-live="polite" sideOffset={6} collisionPadding={12} collisionBoundary={modal}
                className="z-50 flex max-h-[var(--radix-popover-content-available-height)] w-64 max-w-[var(--radix-popover-content-available-width)] flex-col overflow-hidden rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
                onOpenAutoFocus={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => event.preventDefault()}
                onInteractOutside={(event) => {
                    // Calendar clicks own selection and detail replacement. Keeping
                    // those events local avoids a stale dismissal closing new details.
                    const target = event.detail.originalEvent.target;
                    if (target instanceof Node && calendar.contains(target)) event.preventDefault();
                }}
                onEscapeKeyDown={(event) => { event.preventDefault(); event.stopPropagation(); close(); anchor.focus(); }}>
                <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{formatCalendarDate(date)}</p>
                    <Popover.Close asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label="ปิดข้อมูลวันหยุด" onClick={() => anchor.focus()}><X aria-hidden="true" /></Button>
                    </Popover.Close>
                </div>
                <div role="region" aria-label="รายการวันหยุดในวันที่เลือก" tabIndex={0}
                    className="min-h-0 overflow-y-auto overscroll-contain rounded-sm touch-pan-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [-webkit-overflow-scrolling:touch]">
                    <HolidayEventList events={events} />
                </div>
            </Popover.Content>
        </Popover.Portal>
    </Popover.Root>;
}

export function AnnualHolidayOverview({ events, year }: { events: readonly HolidayReferenceEvent[]; year: number }): ReactElement {
    return <details className="border-t pt-3">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">รายการวันหยุดทั้งปี {year + 543} · {events.length} รายการ</summary>
        <div role="region" aria-label="รายการวันหยุดทั้งปี" tabIndex={0} className="max-h-64 space-y-4 overflow-y-auto overscroll-contain py-2 focus-visible:ring-2 focus-visible:ring-ring">
            {Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`).map((prefix) => {
                const monthEvents = events.filter((event) => event.date.startsWith(prefix));
                return monthEvents.length ? <section key={prefix}>
                    <h4 className="mb-2 text-sm font-semibold">{formatCalendarDate(`${prefix}-01`, true)}</h4>
                    {monthEvents.map((event) => <div key={JSON.stringify(event)} className="mb-2"><time className="text-xs text-muted-foreground" dateTime={event.date}>{formatCalendarDate(event.date)}</time><HolidayEventList events={[event]} /></div>)}
                </section> : null;
            })}
        </div>
    </details>;
}
