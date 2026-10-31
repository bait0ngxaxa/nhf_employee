import { z } from "zod";
import year2026 from "./2026.json";
import year2027 from "./2027.json";
import { calendarYearSchema, holidayDaySchema, validateHolidayDays } from "../holiday-calendar";

const datasetSchema = z.object({
    year: calendarYearSchema,
    revision: z.string().min(1).max(100),
    source: z.url(),
    verifiedOn: z.iso.date(),
    note: z.string().max(500),
    exclusions: z.array(z.object({ date: z.iso.date().optional(), source: z.url(), note: z.string() })),
    days: z.array(holidayDaySchema).min(1).max(366),
}).strict();

export type BuiltInHolidayCalendar = z.infer<typeof datasetSchema>;

// Add a verified annual data file and register it here; calculation logic never changes.
const datasets = [year2026, year2027].map((raw) => {
    const dataset = datasetSchema.parse(raw);
    validateHolidayDays(dataset.year, dataset.days);
    return dataset;
});
if (new Set(datasets.map((dataset) => dataset.year)).size !== datasets.length) {
    throw new Error("Duplicate built-in holiday calendar year");
}

export function getBuiltInHolidayCalendar(year: number): BuiltInHolidayCalendar | undefined {
    const dataset = datasets.find((entry) => entry.year === year);
    return dataset ? structuredClone(dataset) : undefined;
}
