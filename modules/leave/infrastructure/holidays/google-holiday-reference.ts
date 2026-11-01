import ICAL from "ical.js";
import { isValidDateOnly, toDateOnlyString } from "../../domain/business-date";
import {
    holidayReferenceSchema,
    MAX_HOLIDAY_REFERENCE_EVENTS,
    type HolidayReference,
    type HolidayReferenceEvent,
} from "../../schemas/holiday-reference";

const SOURCE_URL = "https://calendar.google.com/calendar/ical/en.th%23holiday%40group.v.calendar.google.com/public/basic.ics";
const THAI_SOURCE_URL = "https://calendar.google.com/calendar/ical/th.th%23holiday%40group.v.calendar.google.com/public/basic.ics";
const MAX_BYTES = 512 * 1024;
const MAX_OCCURRENCES = 10000;

export class HolidayReferenceError extends Error {
    constructor(public readonly reason: "network" | "timeout" | "invalid-source" | "incomplete") {
        super(`Holiday reference unavailable: ${reason}`);
        this.name = "HolidayReferenceError";
    }
}

function classify(event: ICAL.Event): HolidayReferenceEvent["classification"] {
    // Verified Google DESCRIPTION vocabulary; CLASS:PUBLIC is visibility, not holiday type.
    const description = event.component.getFirstPropertyValue("description");
    if (description === "Public holiday" || description === "วันหยุดนักขัตฤกษ์") return "public-holiday";
    if (typeof description === "string" && ["Observance", "วันสำคัญ"].includes(description.split("\n")[0])) return "observance";
    return "unverified";
}

function normalizeDate(time: ICAL.Time): string {
    if (time.isDate || time.zone === ICAL.Timezone.localTimezone) {
        return toDateOnlyString({ year: time.year, month: time.month, day: time.day });
    }
    return toDateOnlyString(time.toJSDate());
}

export function parseGoogleHolidayReference(ics: string, year: number): HolidayReference {
    try {
        if (!ics.trim().startsWith("BEGIN:VCALENDAR") || !ics.trim().endsWith("END:VCALENDAR")) {
            throw new HolidayReferenceError("invalid-source");
        }
        const calendar = new ICAL.Component(ICAL.parse(ics));
        if (calendar.name !== "vcalendar" || calendar.getFirstPropertyValue("version") !== "2.0") {
            throw new HolidayReferenceError("invalid-source");
        }
        const components = calendar.getAllSubcomponents("vevent");
        if (components.length > MAX_HOLIDAY_REFERENCE_EVENTS) throw new HolidayReferenceError("invalid-source");
        const events = components.map((component) => {
            // Reject unresolved TZIDs instead of silently treating them as local/UTC.
            for (const property of component.getAllProperties()) {
                // ICAL.Time normalizes impossible dates (e.g. February 30) forward.
                // Validate raw date values first so malformed source data cannot shift.
                if (property.type === "date" || property.type === "date-time") {
                    const raw: unknown = property.toJSON();
                    if (!Array.isArray(raw) || raw.slice(3).some((value: unknown) =>
                        typeof value !== "string" || !isValidDateOnly(value.slice(0, 10)))) {
                        throw new HolidayReferenceError("invalid-source");
                    }
                }
                const tzid = property.getParameter("tzid");
                if (typeof tzid === "string" && tzid !== "UTC" && !calendar.getTimeZoneByID(tzid)) {
                    throw new HolidayReferenceError("invalid-source");
                }
            }
            const event = new ICAL.Event(component);
            if (!component.hasProperty("dtstart") || !event.uid || !event.summary?.trim()
                || event.startDate.year < 1900 || event.summary.length > 500) {
                throw new HolidayReferenceError("invalid-source");
            }
            normalizeDate(event.startDate);
            if (event.endDate.compare(event.startDate) < 0) throw new HolidayReferenceError("invalid-source");
            return event;
        });
        const masters = events.filter((event) => !event.isRecurrenceException());
        for (const exception of events.filter((event) => event.isRecurrenceException())) {
            const master = masters.find((event) => event.uid === exception.uid);
            if (!master) throw new HolidayReferenceError("invalid-source");
            master.relateException(exception);
        }
        const normalized = new Map<string, HolidayReferenceEvent>();
        const coveredQuarters = new Set<number>();
        let expandedDays = 0;
        let occurrences = 0;
        const add = (start: ICAL.Time, end: ICAL.Time, event: ICAL.Event): void => {
            if (event.component.getFirstPropertyValue("status") === "CANCELLED") return;
            // One occurrence supplies coverage only at its actual business-date start.
            // Its duration can populate the viewer, but cannot fill other quarters.
            const occurrenceDate = normalizeDate(start);
            if (occurrenceDate.startsWith(`${year}-`)) {
                coveredQuarters.add(Math.floor((Number(occurrenceDate.slice(5, 7)) - 1) / 3));
            }
            const addDay = (time: ICAL.Time): void => {
                // Count all processed days, even outside the year or exact duplicates.
                if (++expandedDays > MAX_OCCURRENCES) throw new HolidayReferenceError("invalid-source");
                const day = normalizeDate(time);
                if (!day.startsWith(`${year}-`)) return;
                const item = { date: day, name: event.summary.trim(), classification: classify(event) };
                const key = JSON.stringify(item);
                if (!normalized.has(key)) {
                    if (normalized.size >= MAX_HOLIDAY_REFERENCE_EVENTS) throw new HolidayReferenceError("invalid-source");
                    normalized.set(key, item);
                }
            };
            addDay(start);
            if (start.isDate && end.isDate) {
                const cursor = start.clone();
                let days = 1;
                // DTEND is exclusive for all-day events (RFC 5545).
                for (cursor.adjust(1, 0, 0, 0); cursor.compare(end) < 0; cursor.adjust(1, 0, 0, 0)) {
                    if (++days > 366) throw new HolidayReferenceError("invalid-source");
                    addDay(cursor);
                }
            }
        };
        for (const event of masters) {
            if (!event.isRecurring()) {
                add(event.startDate, event.endDate, event);
                continue;
            }
            // The verified feed has no recurrences. Support bounded day-or-longer rules
            // if Google starts emitting them; reject subdaily feeds rather than hanging.
            if (Object.keys(event.getRecurrenceTypes()).some((freq) => !["YEARLY", "MONTHLY", "WEEKLY", "DAILY"].includes(freq))) {
                throw new HolidayReferenceError("invalid-source");
            }
            const iterator = event.iterator();
            let next: ICAL.Time | null;
            while ((next = iterator.next())) {
                if (++occurrences > MAX_OCCURRENCES) throw new HolidayReferenceError("invalid-source");
                const occurrence = event.getOccurrenceDetails(next);
                add(occurrence.startDate, occurrence.endDate, occurrence.item);
                if (next.year > year + 1) break;
            }
        }
        // The verified Google Thailand feed distributes reference dates throughout
        // the year but provides no completeness/verified-empty metadata. Require an
        // occurrence starting in every quarter of the requested year as a conservative
        // availability heuristic. Recurring starts count after exceptions/cancellations;
        // dates expanded from a duration and starts in adjacent years do not. No particular
        // holiday date or count is assumed. This only rejects obvious gaps; it does not
        // prove that every government holiday is present.
        if (coveredQuarters.size !== 4) {
            throw new HolidayReferenceError("incomplete");
        }
        return holidayReferenceSchema.parse({
            year,
            events: [...normalized.values()].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "th")),
        });
    } catch (error) {
        if (error instanceof HolidayReferenceError) throw error;
        throw new HolidayReferenceError("invalid-source");
    }
}

async function fetchSource(year: number, url: string): Promise<HolidayReference> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            redirect: "error",
            cache: "no-store",
            headers: { Accept: "text/calendar" },
        });
        if (!response.ok) {
            await response.body?.cancel();
            throw new HolidayReferenceError("network");
        }
        if (!response.headers.get("content-type")?.toLowerCase().startsWith("text/calendar")
            || Number(response.headers.get("content-length")) > MAX_BYTES || !response.body) {
            await response.body?.cancel();
            throw new HolidayReferenceError("invalid-source");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8", { fatal: true });
        let size = 0;
        let text = "";
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.byteLength;
                if (size > MAX_BYTES) throw new HolidayReferenceError("invalid-source");
                text += decoder.decode(value, { stream: true });
            }
            text += decoder.decode();
        } finally {
            try {
                await reader.cancel();
            } finally {
                reader.releaseLock();
            }
        }
        return parseGoogleHolidayReference(text, year);
    } catch (error) {
        if (controller.signal.aborted) throw new HolidayReferenceError("timeout");
        if (error instanceof HolidayReferenceError) throw error;
        throw new HolidayReferenceError("network");
    } finally {
        clearTimeout(timer);
    }
}

export async function fetchGoogleHolidayReference(year: number): Promise<HolidayReference> {
    try {
        return await fetchSource(year, THAI_SOURCE_URL);
    } catch {
        // Each source must independently satisfy all parser and coverage safeguards.
        return fetchSource(year, SOURCE_URL);
    }
}
