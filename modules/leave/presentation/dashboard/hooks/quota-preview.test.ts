import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLeaveRequestFormModel } from "./useLeaveRequestFormModel";
import { fetchLeaveQuotaProjection, type LeaveQuotaSnapshot } from "../../quota-client";

vi.mock("../../quota-client", () => ({ fetchLeaveQuotaProjection: vi.fn() }));
vi.mock("../api", () => ({ submitLeaveRequest: vi.fn() }));

describe.each(["dashboard", "liff"] as const)("%s selected-year preview", (quotaChannel) => {
    it("blocks unknown quota, drops stale responses and exposes an over-quota reason", async () => {
        const pending = new Map<number, (value: LeaveQuotaSnapshot[]) => void>();
        vi.mocked(fetchLeaveQuotaProjection).mockImplementation((_channel, year) => new Promise((resolve) => { pending.set(year, resolve); }));
        const submitRequest = vi.fn();
        const { result } = renderHook(() => useLeaveRequestFormModel({ quotaChannel, onSuccess: vi.fn(), submitRequest }));
        const choose = (year: number): void => {
            act(() => {
                result.current.form.setValue("startDate", `${year}-01-06`);
                result.current.form.setValue("endDate", `${year}-01-06`);
                result.current.form.setValue("reason", "เหตุผลเดิมต้องไม่หาย");
            });
        };
        choose(2031);
        expect(result.current.quotaStatus).toBe("loading");
        expect(result.current.overQuotaDays).toBeNull();
        await act(async () => { await result.current.submit(result.current.form.getValues()); });
        expect(submitRequest).not.toHaveBeenCalled();
        choose(2032);
        await act(async () => { pending.get(2031)?.([{ year: 2031, leaveType: "SICK", effectiveTotalDays: 30, usedDays: 0, remainingDays: 30 }]); });
        expect(result.current.remainingQuota).toBeNull();
        await act(async () => { pending.get(2032)?.([{ year: 2032, leaveType: "SICK", effectiveTotalDays: 30, usedDays: 30, remainingDays: 0 }]); });
        expect(result.current.quotaStatus).toBe("available");
        expect(result.current.needsSpecialReason).toBe(true);
        expect(result.current.form.getValues("reason")).toBe("เหตุผลเดิมต้องไม่หาย");
        expect(fetchLeaveQuotaProjection).toHaveBeenCalledWith(quotaChannel, 2032);
        choose(2031);
        choose(2032);
        // Returning while another year is loading must not revive the old balance.
        expect(result.current.remainingQuota).toBeNull();
        expect(result.current.quotaStatus).toBe("loading");
    });

    it("distinguishes calculation failure and unavailable data, with retry", async () => {
        vi.mocked(fetchLeaveQuotaProjection).mockRejectedValue(new Error("offline"));
        const { result } = renderHook(() => useLeaveRequestFormModel({ quotaChannel, onSuccess: vi.fn() }));
        await act(async () => undefined);
        expect(result.current.quotaStatus).toBe("error");
        expect(result.current.overQuotaDays).toBeNull();
        vi.mocked(fetchLeaveQuotaProjection).mockResolvedValue([]);
        await act(async () => result.current.retryQuota());
        expect(result.current.quotaStatus).toBe("unavailable");
    });
});
