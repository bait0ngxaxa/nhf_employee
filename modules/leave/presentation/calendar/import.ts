import { holidayDaySchema, validateHolidayDays, type HolidayDayInput } from "../../domain/holiday-calendar";

/** TSV copied from a verified source; never activates dates without ADMIN publication. */
export function parseHolidayDateList(text: string, year: number): HolidayDayInput[] {
    const lines = text.trim().split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0 || lines.length > 366) throw new Error("กรุณาระบุ 1–366 รายการ");
    const days = lines.map((line, index) => {
        const cells = line.split("\t");
        if (cells.length < 4 || cells.length > 5) throw new Error(`บรรทัด ${index + 1}: ต้องมีวันที่ ชื่อ ประเภท และแหล่งอ้างอิง คั่นด้วย Tab`);
        const parsed = holidayDaySchema.safeParse({ date: cells[0].trim(), name: cells[1], category: cells[2].trim(), source: cells[3], note: cells[4] ?? "" });
        if (!parsed.success) throw new Error(`บรรทัด ${index + 1}: วันที่หรือข้อมูลไม่ถูกต้อง`);
        return parsed.data;
    });
    validateHolidayDays(year, days);
    return days;
}
