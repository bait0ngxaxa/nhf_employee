import { z } from "zod";
import { isValidDateOnly } from "./business-date";

export class HolidayCalendarError extends Error {
    constructor(message: string, public readonly statusCode: number = 409) {
        super(message);
        this.name = "HolidayCalendarError";
    }
}

export const calendarYearSchema = z.coerce.number().int().min(1900).max(9999);
export const holidayDaySchema = z.object({
    date: z.string().refine(isValidDateOnly, "วันที่ไม่ถูกต้อง"),
    name: z.string().trim().min(1).max(200),
    category: z.enum(["OFFICIAL", "ORGANIZATION"]),
    source: z.string().trim().min(1).max(1000),
    note: z.string().trim().max(1000).optional(),
}).strict();

export const calendarMutationSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("create"), year: calendarYearSchema, expectedActiveVersion: z.number().int().positive().nullable() }).strict(),
    z.object({ action: z.literal("save"), year: calendarYearSchema, versionId: z.string().min(1).max(191), revision: z.number().int().nonnegative(), days: z.array(holidayDaySchema).max(366) }).strict(),
    z.object({ action: z.literal("publish"), year: calendarYearSchema, versionId: z.string().min(1).max(191), revision: z.number().int().nonnegative(), expectedActiveVersion: z.number().int().positive().nullable(), verified: z.literal(true), confirmEmpty: z.boolean(), note: z.string().trim().min(1).max(1000) }).strict(),
]);

export type HolidayDayInput = z.infer<typeof holidayDaySchema>;
export type CalendarMutation = z.infer<typeof calendarMutationSchema>;

export function validateHolidayDays(year: number, days: readonly HolidayDayInput[]): void {
    const dates = new Set<string>();
    for (const day of days) {
        if (!holidayDaySchema.safeParse(day).success) {
            throw new HolidayCalendarError("ข้อมูลวันหยุดไม่ถูกต้อง กรุณาตรวจชื่อ ประเภท และแหล่งอ้างอิง", 400);
        }
        if (!isValidDateOnly(day.date) || Number(day.date.slice(0, 4)) !== year) {
            throw new HolidayCalendarError("วันที่ต้องถูกต้องและอยู่ในปีปฏิทินที่เลือก", 400);
        }
        if (dates.has(day.date)) throw new HolidayCalendarError("มีวันหยุดวันที่ซ้ำกัน", 400);
        dates.add(day.date);
    }
}

export interface HolidayVersionView {
    id: string;
    number: number;
    revision: number;
    publishedAt: string | null;
    publicationNote: string | null;
    days: HolidayDayInput[];
}

export interface ManagedHolidayCalendar {
    year: number;
    activeVersionNumber: number | null;
    versions: HolidayVersionView[];
}

export interface PublishedHolidayCalendar {
    year: number;
    version: number | null;
    days: Pick<HolidayDayInput, "date" | "name" | "category">[];
}
