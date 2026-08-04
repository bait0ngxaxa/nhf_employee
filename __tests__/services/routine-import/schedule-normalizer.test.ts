import { describe, expect, it } from "vitest";

import { normalizeRoutineSchedule } from "@/lib/services/routine-import";

describe("routine import schedule normalization", () => {
    it("normalizes monthly day and next-month schedules", () => {
        expect(normalizeRoutineSchedule("วันที่ 10 ของเดือน")).toEqual({
            normalizedSchedule: {
                scheduleType: "MONTHLY_DAY",
                scheduleConfig: { day: 10, monthOffset: 0 },
                businessDayPolicy: "NONE",
            },
            reviewReasons: [],
        });
        expect(normalizeRoutineSchedule("ภายในวันที่ 15 ของเดือนถัดไป").normalizedSchedule)
            .toEqual({
                scheduleType: "MONTHLY_DAY",
                scheduleConfig: { day: 15, monthOffset: 1 },
                businessDayPolicy: "NONE",
            });
    });

    it("normalizes month end, yearly dates, and anchored intervals", () => {
        expect(normalizeRoutineSchedule("สิ้นเดือน").normalizedSchedule).toEqual({
            scheduleType: "MONTH_END",
            scheduleConfig: {},
            businessDayPolicy: "NONE",
        });
        expect(normalizeRoutineSchedule("ภายใน 31 มีนาคม ของทุกปี").normalizedSchedule)
            .toEqual({
                scheduleType: "YEARLY_DATE",
                scheduleConfig: { month: 3, day: 31 },
                businessDayPolicy: "NONE",
            });
        expect(normalizeRoutineSchedule("ทุกรอบ 3 ปี", "2024-09-06").normalizedSchedule)
            .toEqual({
                scheduleType: "INTERVAL_MONTHS",
                scheduleConfig: { intervalMonths: 36, anchorDate: "2024-09-06" },
                businessDayPolicy: "NONE",
            });
    });

    it("keeps ambiguous and event-driven schedules manual without blocking import", () => {
        const ambiguous = normalizeRoutineSchedule("วันที่ 16 หรือ 23 ของเดือนถัดไป");
        expect(ambiguous.normalizedSchedule).toEqual({
            scheduleType: "MANUAL",
            scheduleConfig: {},
            businessDayPolicy: "NONE",
        });
        expect(ambiguous.reviewReasons).toEqual([]);

        const eventDriven = normalizeRoutineSchedule("เมื่อแจ้งหนี้ครบทุกเบอร์");
        expect(eventDriven.normalizedSchedule?.scheduleType).toBe("MANUAL");
        expect(eventDriven.reviewReasons).toEqual([]);
    });

    it("normalizes explicit Thai and ISO one-time dates", () => {
        expect(normalizeRoutineSchedule("21 ก.ค. 2569").normalizedSchedule).toEqual({
            scheduleType: "ONE_TIME",
            scheduleConfig: { date: "2026-07-21" },
            businessDayPolicy: "NONE",
        });
        expect(normalizeRoutineSchedule("2026-07-21").normalizedSchedule).toEqual({
            scheduleType: "ONE_TIME",
            scheduleConfig: { date: "2026-07-21" },
            businessDayPolicy: "NONE",
        });
    });

    it("normalizes an explicit one-time deadline with ภายใน", () => {
        expect(normalizeRoutineSchedule("ภายใน 31 มีนาคม 2559").normalizedSchedule).toEqual({
            scheduleType: "ONE_TIME",
            scheduleConfig: { date: "2016-03-31" },
            businessDayPolicy: "NONE",
        });
    });

    it("keeps holiday wording as a manual schedule without blocking import", () => {
        const result = normalizeRoutineSchedule(
            "วันที่ 25 ของเดือน (หรือก่อน ถ้า 25 ตรงวันหยุด)",
        );
        expect(result.normalizedSchedule?.scheduleType).toBe("MANUAL");
        expect(result.normalizedSchedule?.businessDayPolicy).toBe("NONE");
        expect(result.reviewReasons).toEqual([]);
    });
});
