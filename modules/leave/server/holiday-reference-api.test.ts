import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HolidayReferenceError } from "../infrastructure/holidays/google-holiday-reference";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../application/queries/holiday-reference", () => ({ getHolidayReference: mocks.get }));
import { getHolidayReferenceResponse } from "./holiday-reference-api";

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T18:00:00Z"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("holiday reference HTTP response", () => {
    it("uses the Bangkok year and returns only normalized reference data with private no-store delivery", async () => {
        const data = { year: 2027, events: [{ date: "2027-01-01", name: "New Year", classification: "public-holiday" }] };
        mocks.get.mockResolvedValue(data);
        const result = await getHolidayReferenceResponse();
        expect(mocks.get).toHaveBeenCalledWith(2027);
        expect(await result.json()).toEqual(data);
        expect(result.headers.get("cache-control")).toBe("private, no-store");
    });
    it.each(["incomplete", "timeout", "network", "invalid-source"] as const)("sanitizes %s with an explicit unavailable code", async (reason) => {
        mocks.get.mockRejectedValue(new HolidayReferenceError(reason));
        const result = await getHolidayReferenceResponse();
        expect(result.status).toBe(503);
        expect(await result.json()).toEqual({
            error: "ไม่สามารถโหลดข้อมูลวันหยุดได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
            code: reason === "incomplete" ? "HOLIDAY_DATA_INCOMPLETE" : "HOLIDAY_SOURCE_UNAVAILABLE",
        });
        expect(result.headers.get("cache-control")).toBe("private, no-store");
    });
});
