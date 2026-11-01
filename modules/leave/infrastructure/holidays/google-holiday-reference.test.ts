import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGoogleHolidayReference, parseGoogleHolidayReference } from "./google-holiday-reference";

const fixture = readFileSync(new URL("./fixtures/reference.ics", import.meta.url), "utf8");
const thaiFixture = readFileSync(new URL("./fixtures/thai-reference.ics", import.meta.url), "utf8");
function withEvent(properties: string): string {
    return fixture.replace("END:VCALENDAR", `BEGIN:VEVENT\n${properties}\nEND:VEVENT\nEND:VCALENDAR`);
}
function response(body = fixture, status = 200): Response {
    return new Response(body, { status, headers: { "Content-Type": "text/calendar; charset=utf-8" } });
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Google holiday reference normalization", () => {
    it("recognizes verified Thai DESCRIPTION terminology without classifying by title", () => {
        const thai = fixture.replaceAll("Public holiday", "วันหยุดนักขัตฤกษ์").replaceAll("Observance", "วันสำคัญ");
        const parsed = parseGoogleHolidayReference(thai, 2026);
        expect(parsed.events.map((event) => event.classification)).toEqual(parseGoogleHolidayReference(fixture, 2026).events.map((event) => event.classification));
        const unknown = parseGoogleHolidayReference(withEvent("UID:thai-title\nDTSTART;VALUE=DATE:20261013\nSUMMARY:วันหยุดนักขัตฤกษ์\nDESCRIPTION:Unknown"), 2026);
        expect(unknown.events.find((event) => event.date === "2026-10-13")?.classification).toBe("unverified");
    });
    it("parses valid all-day dates without shifting and retains folded Thai titles and classification", () => {
        expect(parseGoogleHolidayReference(fixture, 2026)).toEqual({ year: 2026, events: [
            { date: "2026-01-01", name: "New Year's Day", classification: "public-holiday" },
            { date: "2026-02-14", name: "ชื่อวันสำคัญที่พับบรรทัด", classification: "observance" },
            { date: "2026-02-14", name: "Another event", classification: "unverified" },
            { date: "2026-05-10", name: "Second quarter reference", classification: "observance" },
            { date: "2026-08-10", name: "Third quarter reference", classification: "public-holiday" },
            { date: "2026-11-10", name: "Fourth quarter reference", classification: "unverified" },
        ] });
    });
    it("retains different events on a date and deduplicates exact display records", () => {
        const data = parseGoogleHolidayReference(withEvent("UID:duplicate\nDTSTART;VALUE=DATE:20260101\nSUMMARY:New Year's Day\nDESCRIPTION:Public holiday"), 2026);
        expect(data.events).toHaveLength(6);
        expect(data.events.filter((event) => event.date === "2026-02-14")).toHaveLength(2);
    });
    it("normalizes UTC instants at the Bangkok date/year boundary", () => {
        const data = parseGoogleHolidayReference(withEvent("UID:utc\nDTSTART:20251231T180000Z\nDTEND:20251231T190000Z\nSUMMARY:Bangkok midnight"), 2026);
        expect(data.events.find((event) => event.name === "Bangkok midnight")?.date).toBe("2026-01-01");
    });
    it("uses embedded timezone rules, never the server's local timezone", () => {
        const ics = withEvent("UID:tz\nDTSTART;TZID=Asia/Bangkok:20260101T010000\nDTEND;TZID=Asia/Bangkok:20260101T020000\nSUMMARY:Local holiday")
            .replace("BEGIN:VEVENT", "BEGIN:VTIMEZONE\nTZID:Asia/Bangkok\nBEGIN:STANDARD\nDTSTART:19700101T000000\nTZOFFSETFROM:+0700\nTZOFFSETTO:+0700\nEND:STANDARD\nEND:VTIMEZONE\nBEGIN:VEVENT");
        expect(parseGoogleHolidayReference(ics, 2026).events.find((event) => event.name === "Local holiday")?.date).toBe("2026-01-01");
    });
    it("rejects unresolved timezones", () => {
        expect(() => parseGoogleHolidayReference(withEvent("UID:bad-tz\nDTSTART;TZID=Missing/Zone:20260101T010000\nSUMMARY:Unknown timezone"), 2026)).toThrow("invalid-source");
    });
    it("expands all-day spans with an exclusive DTEND", () => {
        const data = parseGoogleHolidayReference(withEvent("UID:span\nDTSTART;VALUE=DATE:20260413\nDTEND;VALUE=DATE:20260416\nSUMMARY:Festival"), 2026);
        expect(data.events.filter((event) => event.name === "Festival").map((event) => event.date)).toEqual(["2026-04-13", "2026-04-14", "2026-04-15"]);
    });
    it("expands recurring dates and respects EXDATE, RDATE and recurrence exceptions", () => {
        let ics = withEvent("UID:repeat\nDTSTART;VALUE=DATE:20260103\nDTEND;VALUE=DATE:20260104\nRRULE:FREQ=DAILY;COUNT=3\nEXDATE;VALUE=DATE:20260104\nRDATE;VALUE=DATE:20260108\nSUMMARY:Repeated");
        ics = ics.replace("END:VCALENDAR", "BEGIN:VEVENT\nUID:repeat\nRECURRENCE-ID;VALUE=DATE:20260105\nDTSTART;VALUE=DATE:20260106\nDTEND;VALUE=DATE:20260107\nSUMMARY:Moved\nEND:VEVENT\nEND:VCALENDAR");
        const data = parseGoogleHolidayReference(ics, 2026).events;
        expect(data.filter((event) => event.name === "Repeated").map((event) => event.date)).toEqual(["2026-01-03", "2026-01-08"]);
        expect(data.find((event) => event.name === "Moved")?.date).toBe("2026-01-06");
    });
    it("includes only the requested year", () => {
        expect(parseGoogleHolidayReference(fixture, 2026).events.every((event) => event.date.startsWith("2026-"))).toBe(true);
    });
    it.each(["", "<html>Failure</html>", "BEGIN:VCALENDAR\nVERSION:2.0", "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Missing date\nEND:VEVENT\nEND:VCALENDAR"])("rejects malformed responses: %s", (ics) => {
        expect(() => parseGoogleHolidayReference(ics, 2026)).toThrow("invalid-source");
    });
    it("does not interpret CLASS:PUBLIC as official holiday status", () => {
        expect(parseGoogleHolidayReference(fixture, 2026).events.find((event) => event.name === "Another event")?.classification).toBe("unverified");
    });
    it.each([
        "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR",
        fixture.replaceAll("2026", "2025"),
        "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:only\nDTSTART;VALUE=DATE:20260214\nSUMMARY:Only one date\nEND:VEVENT\nEND:VCALENDAR",
    ])("treats empty, missing-year and partial-range results as incomplete", (ics) => {
        expect(() => parseGoogleHolidayReference(ics, 2026)).toThrow("incomplete");
    });
    it("rejects subdaily recurrence to bound expansion", () => {
        expect(() => parseGoogleHolidayReference(withEvent("UID:frequent\nDTSTART:20260101T000000Z\nRRULE:FREQ=SECONDLY\nSUMMARY:Unbounded"), 2026)).toThrow("invalid-source");
    });
    it.each(["20260230", "20261301", "20260001"])("rejects impossible dates instead of normalizing %s to another day", (date) => {
        expect(() => parseGoogleHolidayReference(withEvent(`UID:invalid-date\nDTSTART;VALUE=DATE:${date}\nSUMMARY:Invalid`), 2026)).toThrow("invalid-source");
    });
    it("rejects an end before the start", () => {
        expect(() => parseGoogleHolidayReference(withEvent("UID:reversed\nDTSTART;VALUE=DATE:20260415\nDTEND;VALUE=DATE:20260413\nSUMMARY:Invalid"), 2026)).toThrow("invalid-source");
    });
});

function calendar(...events: string[]): string {
    return `BEGIN:VCALENDAR\nVERSION:2.0\n${events.map((event) => `BEGIN:VEVENT\n${event}\nEND:VEVENT`).join("\n")}\nEND:VCALENDAR`;
}
function datedEvent(date: string, name = date, extra = ""): string {
    return `UID:${name}\nDTSTART;VALUE=DATE:${date}\nSUMMARY:${name}\n${extra}`;
}
const distributed = ["20260210", "20260510", "20260810", "20261110"].map((date) => datedEvent(date));
const adjacent = [datedEvent("20250101"), datedEvent("20271231")];

describe("target-year coverage", () => {
    it.each([
        [],
        adjacent,
        [...adjacent, datedEvent("20260601")],
        [...adjacent, datedEvent("20260102"), datedEvent("20260210"), datedEvent("20260320")],
        [datedEvent("20260102"), datedEvent("20261220")],
    ].map((events) => ({ events })))("rejects empty, missing or insufficiently distributed target-year dates: $events", ({ events }) => {
        expect(() => parseGoogleHolidayReference(calendar(...events), 2026)).toThrow("incomplete");
    });
    it("accepts events distributed through every quarter without exact year endpoints", () => {
        const expected = parseGoogleHolidayReference(calendar(...distributed), 2026);
        expect(expected.events).toHaveLength(4);
        expect(parseGoogleHolidayReference(calendar(...adjacent, ...distributed), 2026)).toEqual(expected);
    });
    it.each(["20251231", "20260101"])("does not treat expanded days of one long event starting %s as independent coverage", (start) => {
        const span = datedEvent(start, "Span", "DTEND;VALUE=DATE:20261002");
        expect(() => parseGoogleHolidayReference(calendar(span), 2026)).toThrow("incomplete");
        expect(() => parseGoogleHolidayReference(calendar(...adjacent, span), 2026)).toThrow("incomplete");
    });
    it("does not let duplicates of a long event establish independent coverage", () => {
        const span = datedEvent("20260101", "Span", "DTEND;VALUE=DATE:20270101");
        expect(() => parseGoogleHolidayReference(calendar(span, span, span, span), 2026)).toThrow("incomplete");
    });
    it("preserves expanded all-day dates once independent occurrences establish coverage", () => {
        const data = parseGoogleHolidayReference(calendar(...distributed, datedEvent("20251231", "Span", "DTEND;VALUE=DATE:20261002")), 2026);
        const span = data.events.filter((event) => event.name === "Span");
        expect(span[0]?.date).toBe("2026-01-01");
        expect(span.at(-1)?.date).toBe("2026-10-01");
        expect(span).toHaveLength(274);
    });
    it("uses recurring occurrences crossing into the target year for coverage", () => {
        const data = parseGoogleHolidayReference(calendar(datedEvent("20251110", "Quarterly", "RRULE:FREQ=MONTHLY;INTERVAL=3;COUNT=5")), 2026);
        expect(data.events.map((event) => event.date)).toEqual(["2026-02-10", "2026-05-10", "2026-08-10", "2026-11-10"]);
    });
    it("does not use the duration of recurring occurrences to fill missing quarters", () => {
        const event = datedEvent("20251231", "Long recurring event", "DTEND;VALUE=DATE:20261002\nRRULE:FREQ=YEARLY;COUNT=2");
        expect(() => parseGoogleHolidayReference(calendar(event), 2026)).toThrow("incomplete");
    });
    it("preserves multi-day recurring occurrences as independent coverage at their starts", () => {
        const event = datedEvent("20251110", "Quarterly", "DTEND;VALUE=DATE:20251112\nRRULE:FREQ=MONTHLY;INTERVAL=3;COUNT=5");
        expect(parseGoogleHolidayReference(calendar(event), 2026).events.map((item) => item.date)).toEqual([
            "2026-02-10", "2026-02-11", "2026-05-10", "2026-05-11",
            "2026-08-10", "2026-08-11", "2026-11-10", "2026-11-11",
        ]);
    });
    it("does not use excluded or cancelled occurrences as coverage evidence", () => {
        const excluded = datedEvent("20251110", "Quarterly", "RRULE:FREQ=MONTHLY;INTERVAL=3;COUNT=5\nEXDATE;VALUE=DATE:20261110");
        expect(() => parseGoogleHolidayReference(calendar(excluded), 2026)).toThrow("incomplete");
        const cancelled = datedEvent("20261110", "Cancelled", "STATUS:CANCELLED");
        expect(() => parseGoogleHolidayReference(calendar(...distributed.slice(0, 3), cancelled), 2026)).toThrow("incomplete");
    });
    it("uses a recurrence exception's actual start instead of its original quarter", () => {
        const master = datedEvent("20251110", "Quarterly", "RRULE:FREQ=MONTHLY;INTERVAL=3;COUNT=5");
        const moved = datedEvent("20260820", "Quarterly", "RECURRENCE-ID;VALUE=DATE:20261110");
        expect(() => parseGoogleHolidayReference(calendar(master, moved), 2026)).toThrow("incomplete");
    });
    it("normalizes occurrence starts to Bangkok dates before determining coverage", () => {
        const utc = "UID:utc-start\nDTSTART:20251231T180000Z\nSUMMARY:Bangkok new year";
        expect(parseGoogleHolidayReference(calendar(...distributed.slice(1), utc), 2026).events[0]?.date).toBe("2026-01-01");
    });
    it("clips an all-day span ending in the next year without including its exclusive end", () => {
        const data = parseGoogleHolidayReference(calendar(...distributed, datedEvent("20261230", "Boundary", "DTEND;VALUE=DATE:20270103")), 2026);
        expect(data.events.filter((event) => event.name === "Boundary").map((event) => event.date)).toEqual(["2026-12-30", "2026-12-31"]);
    });
});

describe("normalized expansion limits", () => {
    const yearSpan = (name: string): string => datedEvent("20260101", name, "DTEND;VALUE=DATE:20270101");
    it("rejects collectively oversized non-recurring spans instead of returning partial results", () => {
        expect(() => parseGoogleHolidayReference(calendar(...Array.from({ length: 6 }, (_, index) => yearSpan(`Span ${index}`))), 2026)).toThrow("invalid-source");
    });
    it("counts expanded days even when all overlapping events deduplicate", () => {
        expect(() => parseGoogleHolidayReference(calendar(...Array.from({ length: 28 }, () => yearSpan("Same"))), 2026)).toThrow("invalid-source");
    });
    it("accepts exactly 10,000 processed days and rejects the next duplicate day", () => {
        // 27 * 365 + 142 span days + 3 independent quarter starts = 10,000.
        const events = [
            ...Array.from({ length: 27 }, () => yearSpan("Same")),
            datedEvent("20260101", "Same", "DTEND;VALUE=DATE:20260523"),
            ...distributed.slice(1),
        ];
        expect(parseGoogleHolidayReference(calendar(...events), 2026).events).toHaveLength(368);
        expect(() => parseGoogleHolidayReference(calendar(...events, datedEvent("20260526", "Same")), 2026)).toThrow("invalid-source");
    });
    it("accepts exactly 2,000 unique records with exclusive DTEND and rejects the next record", () => {
        // 5 * 365 + 172 span days + 3 independent quarter starts = 2,000.
        const events = [
            ...Array.from({ length: 5 }, (_, index) => yearSpan(`Span ${index}`)),
            datedEvent("20260101", "Remainder", "DTEND;VALUE=DATE:20260622"),
            ...distributed.slice(1),
        ];
        expect(parseGoogleHolidayReference(calendar(...events), 2026).events).toHaveLength(2000);
        expect(() => parseGoogleHolidayReference(calendar(...events, datedEvent("20260625", "Extra")), 2026)).toThrow("invalid-source");
    });
    it("bounds expanded days outside the target year too", () => {
        expect(() => parseGoogleHolidayReference(calendar(...Array.from({ length: 28 }, () => datedEvent("20250101", "Previous", "DTEND;VALUE=DATE:20260101"))), 2026)).toThrow("invalid-source");
    });
});

describe("bounded external retrieval", () => {
    it("renders source Thai titles from the verified feed through the existing parser without fallback", async () => {
        const fetch = vi.fn().mockImplementation(() => Promise.resolve(response(thaiFixture)));
        vi.stubGlobal("fetch", fetch);
        const result = await fetchGoogleHolidayReference(2026);
        expect(result.events.find((event) => event.date === "2026-04-06")).toMatchObject({ name: "วันจักรี", classification: "public-holiday" });
        expect(result.events).toHaveLength(4);
        expect(fetch).toHaveBeenCalledOnce();
    });
    it.each(["network", "incomplete"])("falls back from Thai %s to an independently validated English feed", async (reason) => {
        const fetch = vi.fn().mockImplementationOnce(() => reason === "network"
            ? Promise.reject(new TypeError("unavailable"))
            : Promise.resolve(response(fixture.replaceAll("2026", "2025"))))
            .mockImplementationOnce(() => Promise.resolve(response()));
        vi.stubGlobal("fetch", fetch);
        expect((await fetchGoogleHolidayReference(2026)).events).toHaveLength(6);
        expect(fetch.mock.calls[0][0]).toContain("/th.th%23");
        expect(fetch.mock.calls[1][0]).toContain("/en.th%23");
    });
    it("fetches only the fixed server-controlled URL and validates the response", async () => {
        const fetch = vi.fn().mockResolvedValue(response());
        vi.stubGlobal("fetch", fetch);
        expect((await fetchGoogleHolidayReference(2026)).events).toHaveLength(6);
        expect(fetch).toHaveBeenCalledWith("https://calendar.google.com/calendar/ical/th.th%23holiday%40group.v.calendar.google.com/public/basic.ics", expect.objectContaining({ cache: "no-store", redirect: "error", signal: expect.any(AbortSignal) }));
    });
    it("aborts external requests after eight seconds", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        })));
        const result = expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("timeout");
        await vi.advanceTimersByTimeAsync(16000);
        await result;
    });
    it("keeps the timeout active while reading the body", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => Promise.resolve(new Response(new ReadableStream({ start(controller) {
            init.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
        } }), { headers: { "Content-Type": "text/calendar" } }))));
        const result = expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("timeout");
        await vi.advanceTimersByTimeAsync(16000);
        await result;
    });
    it("reports server and network failures separately from parsing and incomplete data", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("server error", 500)));
        await expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("network");
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network failed")));
        await expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("network");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("broken")));
        await expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("invalid-source");
        vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response(fixture.replaceAll("2026", "2025")))));
        await expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("incomplete");
    });
    it("enforces both content type and streaming response size limits", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(fixture)));
        await expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("invalid-source");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("a".repeat(512 * 1024 + 1))));
        await expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("invalid-source");
    });
});
