import { describe, expect, it } from "vitest";
import { classifyStockHealth } from "./analytics";
import { stockAnalyticsQuerySchema, stockReportingPeriod } from "../schemas/analytics";

describe("Stock analytics definitions", () => {
    it.each([[0, 0, "out"], [-1, 5, "out"], [1, 0, "healthy"], [2, 2, "low"], [3, 2, "healthy"]] as const)("classifies %s available, %s minimum", (available, minimum, expected) => {
        expect(classifyStockHealth(available, minimum)).toBe(expected);
    });
    it("uses half-open Bangkok month boundaries including leap February", () => {
        const period = stockReportingPeriod({ year: 2024, fromMonth: 2, toMonth: 2 });
        expect(period.start.toISOString()).toBe("2024-01-31T17:00:00.000Z");
        expect(period.end.toISOString()).toBe("2024-02-29T17:00:00.000Z");
        expect(stockReportingPeriod({ year: 2026, fromMonth: 1, toMonth: 12 }).end.toISOString()).toBe("2026-12-31T17:00:00.000Z");
    });
    it("rejects reversed months and quantities without a comparable unit", () => {
        expect(stockAnalyticsQuerySchema.safeParse({ fromMonth: 3, toMonth: 2 }).success).toBe(false);
        expect(stockAnalyticsQuerySchema.safeParse({ metric: "quantity" }).success).toBe(false);
        expect(stockAnalyticsQuerySchema.safeParse({ metric: "quantity", unit: "ชิ้น" }).success).toBe(true);
        expect(stockAnalyticsQuerySchema.safeParse({ year: "bad" }).success).toBe(false);
    });
});
