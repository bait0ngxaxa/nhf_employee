import { z } from "zod";
import { getBangkokYear, createBangkokYearRange } from "@/lib/helpers/bangkok-time";

export const stockAnalyticsQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100).default(() => getBangkokYear(new Date())),
    fromMonth: z.coerce.number().int().min(1).max(12).default(1),
    toMonth: z.coerce.number().int().min(1).max(12).default(12),
    categoryId: z.coerce.number().int().positive().optional(),
    projectCode: z.string().trim().min(1).max(100).optional(),
    metric: z.enum(["frequency", "quantity"]).default("frequency"),
    unit: z.string().min(1).max(100).optional(),
    itemId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
}).refine((query) => query.fromMonth <= query.toMonth, { message: "เดือนเริ่มต้นต้องไม่เกินเดือนสิ้นสุด" })
    .refine((query) => query.metric !== "quantity" || query.unit !== undefined, { message: "กรุณาเลือกหน่วยเพื่อเปรียบเทียบปริมาณ" });

export type StockAnalyticsQuery = z.infer<typeof stockAnalyticsQuerySchema>;

/** Half-open Bangkok calendar boundaries, shared by analytics and raw exports. */
export function stockReportingPeriod(query: Pick<StockAnalyticsQuery, "year" | "fromMonth" | "toMonth">): { start: Date; end: Date } {
    const { startOfYear } = createBangkokYearRange(query.year);
    const origin = Date.UTC(query.year, 0, 1);
    const start = new Date(startOfYear.getTime() + Date.UTC(query.year, query.fromMonth - 1, 1) - origin);
    const end = new Date(startOfYear.getTime() + Date.UTC(query.year, query.toMonth, 1) - origin);
    return { start, end };
}
