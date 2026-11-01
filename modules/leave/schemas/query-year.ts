import { z } from "zod";

export const leaveQueryYearSchema = z.string().regex(/^\d{4}$/)
    .transform(Number).pipe(z.number().int().min(2000).max(2100));

export function parseLeaveQueryYear(params: URLSearchParams, name = "year"): number | null {
    if (params.getAll(name).length !== 1) return null;
    const result = leaveQueryYearSchema.safeParse(params.get(name));
    return result.success ? result.data : null;
}
