import { z } from "zod";
import { apiGet } from "@/lib/client/api-client";
import { LIFF_API_REQUEST_OPTIONS } from "@/modules/line/client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { holidayReferenceSchema, type HolidayReference } from "../schemas/holiday-reference";

export type HolidayReferenceChannel = "dashboard" | "liff";

export class HolidayReferenceClientError extends Error {
    constructor(public readonly incomplete: boolean) {
        super("Holiday reference unavailable");
    }
}

export async function fetchHolidayReference(channel: HolidayReferenceChannel): Promise<HolidayReference> {
    const response = await apiGet<unknown>(
        channel === "liff" ? API_ROUTES.line.leaveHolidays : API_ROUTES.leave.holidays,
        { ...(channel === "liff" ? LIFF_API_REQUEST_OPTIONS : {}), cache: "no-store", retryCount: 0 },
    );
    if (!response.success) {
        const detail = z.object({ code: z.literal("HOLIDAY_DATA_INCOMPLETE") }).safeParse(response.details);
        throw new HolidayReferenceClientError(detail.success);
    }
    return holidayReferenceSchema.parse(response.data);
}
