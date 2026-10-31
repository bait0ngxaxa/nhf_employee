import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { useLeaveRequestFormModel } from "../dashboard/hooks/useLeaveRequestFormModel";

describe("shared Dashboard/LIFF calendar projection", () => {
    it("replaces weekday estimates and quota with the authoritative server result", async () => {
        const previewRequest = vi.fn().mockResolvedValue({ durationHalfDays: 4, calendarVersionId: "v2", calendarVersion: 2, mode: "PUBLISHED_CALENDAR", remainingHalfDays: 6, projectedRemainingHalfDays: 2, overQuotaHalfDays: 0 });
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess: vi.fn(), previewRequest }), {
            wrapper: ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>,
        });
        act(() => {
            result.current.form.setValue("startDate", "2026-11-02");
            result.current.form.setValue("endDate", "2026-11-04");
            result.current.form.setValue("leaveType", "VACATION");
        });
        await waitFor(() => expect(result.current.requestedDays).toBe(2));
        expect(result.current.remainingQuota).toBe(3);
        expect(result.current.projectedRemainingQuota).toBe(1);
        expect(result.current.calculationNotice).toContain("ฉบับ 2");
        expect(previewRequest).toHaveBeenCalledWith({ startDate: "2026-11-02", endDate: "2026-11-04", period: "FULL_DAY", leaveType: "VACATION" });
    });
});
