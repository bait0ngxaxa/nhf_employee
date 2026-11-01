import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGoogleHolidayReference, parseGoogleHolidayReference } from "./google-holiday-reference";

const fixture = readFileSync(new URL("./fixtures/reference.ics", import.meta.url), "utf8");
function withEvent(properties: string): string {
    return fixture.replace("END:VCALENDAR", `BEGIN:VEVENT\n${properties}\nEND:VEVENT\nEND:VCALENDAR`);
}
function response(body = fixture, status = 200): Response {
    return new Response(body, { status, headers: { "Content-Type": "text/calendar; charset=utf-8" } });
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Google holiday reference normalization", () => {
    it("parses valid all-day dates without shifting and retains folded Thai titles and classification", () => {
        expect(parseGoogleHolidayReference(fixture, 2026)).toEqual({ year: 2026, events: [
            { date: "2026-01-01", name: "New Year's Day", classification: "public-holiday" },
            { date: "2026-02-14", name: "ชื่อวันสำคัญที่พับบรรทัด", classification: "observance" },
            { date: "2026-02-14", name: "Another event", classification: "unverified" },
        ] });
    });
    it("retains different events on a date and deduplicates exact display records", () => {
        const data = parseGoogleHolidayReference(withEvent("UID:duplicate\nDTSTART;VALUE=DATE:20260101\nSUMMARY:New Year's Day\nDESCRIPTION:Public holiday"), 2026);
        expect(data.events).toHaveLength(3);
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

describe("bounded external retrieval", () => {
    it("fetches only the fixed server-controlled URL and validates the response", async () => {
        const fetch = vi.fn().mockResolvedValue(response());
        vi.stubGlobal("fetch", fetch);
        expect((await fetchGoogleHolidayReference(2026)).events).toHaveLength(3);
        expect(fetch).toHaveBeenCalledWith("https://calendar.google.com/calendar/ical/en.th%23holiday%40group.v.calendar.google.com/public/basic.ics", expect.objectContaining({ cache: "no-store", redirect: "error", signal: expect.any(AbortSignal) }));
    });
    it("aborts external requests after eight seconds", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        })));
        const result = expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("timeout");
        await vi.advanceTimersByTimeAsync(8000);
        await result;
    });
    it("keeps the timeout active while reading the body", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => Promise.resolve(new Response(new ReadableStream({ start(controller) {
            init.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
        } }), { headers: { "Content-Type": "text/calendar" } }))));
        const result = expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("timeout");
        await vi.advanceTimersByTimeAsync(8000);
        await result;
    });
    it("reports server and network failures separately from parsing and incomplete data", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("server error", 500)));
        await expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("network");
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network failed")));
        await expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("network");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("broken")));
        await expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("invalid-source");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(fixture.replaceAll("2026", "2025"))));
        await expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("incomplete");
    });
    it("enforces both content type and streaming response size limits", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(fixture)));
        await expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("invalid-source");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("a".repeat(512 * 1024 + 1))));
        await expect(fetchGoogleHolidayReference(2026)).rejects.toThrow("invalid-source");
    });
});
