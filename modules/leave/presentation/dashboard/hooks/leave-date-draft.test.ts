import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeaveRequestFormModel } from "./useLeaveRequestFormModel";

vi.mock("../api", () => ({ submitLeaveRequest: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-02T12:00:00+07:00")); });
afterEach(() => vi.useRealTimers());

function setup() {
    return renderHook(() => useLeaveRequestFormModel({ onSuccess: vi.fn(), quotas: [{ year: 2026, leaveType: "SICK", effectiveTotalDays: 30, usedDays: 0, remainingDays: 30 }] }));
}

describe("date drafts in the authoritative form model", () => {
    it.each(["FULL_DAY", "MORNING", "AFTERNOON"] as const)("commits single-day %s with dirty/touched state and quota recalculation", async (period) => {
        const { result } = setup();
        act(() => { result.current.form.setValue("period", period); result.current.selectDraftDate("2026-11-03"); });
        expect(result.current.form.getValues("startDate")).toBe("2026-11-02");
        act(() => result.current.confirmDraftDates());
        await waitFor(() => expect(result.current.hasPendingDates).toBe(false));
        expect(result.current.form.getValues()).toMatchObject({ startDate: "2026-11-03", endDate: "2026-11-03", period });
        const duration = period === "FULL_DAY" ? 1 : 0.5;
        expect(result.current.requestedDays).toBe(duration);
        expect(result.current.projectedRemainingQuota).toBe(30 - duration);
        expect(result.current.form.formState.touchedFields).toMatchObject({ startDate: true, endDate: true });
        expect(result.current.isDirty).toBe(true);
    });

    it("never submits or reviews an unconfirmed or incomplete draft even when invoked directly", async () => {
        const submitRequest = vi.fn();
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess: vi.fn(), submitRequest }));
        act(() => result.current.switchToMultiDay());
        act(() => result.current.selectDraftDate("2026-11-06"));
        act(() => result.current.confirmDraftDates());
        expect(result.current.form.getValues("startDate")).toBe("2026-11-02");
        act(() => result.current.goToReview(result.current.form.getValues()));
        await act(async () => result.current.submit(result.current.form.getValues()));
        expect(result.current.step).toBe("edit"); expect(submitRequest).not.toHaveBeenCalled();
        act(() => result.current.selectDraftDate("2026-11-09"));
        act(() => result.current.goToReview(result.current.form.getValues()));
        expect(result.current.step).toBe("edit");
        act(() => result.current.confirmDraftDates());
        expect(result.current.requestedDays).toBe(2);
        expect(result.current.breakdown).toMatchObject({ calendarDays: 4, weekendDays: 2, workingDays: 2 });
    });

    it.each(["2026-11-07", "2026-11-08"])("rejects weekend %s as either boundary", (date) => {
        const { result } = setup();
        act(() => result.current.selectDraftDate(date));
        expect(result.current.hasPendingDates).toBe(false);
        act(() => result.current.switchToMultiDay());
        act(() => result.current.selectDraftDate(date));
        expect(result.current.draftDates).toEqual({ start: "", end: "" });
        act(() => result.current.selectDraftDate("2026-11-06"));
        act(() => result.current.selectDraftDate(date));
        expect(result.current.draftDates).toEqual({ start: "2026-11-06", end: "" });
    });

    it("preserves unrelated fields, reasons, attachments and period through draft changes/discard/mode switches", async () => {
        const { result } = setup();
        const file = new File(["proof"], "proof.jpg", { type: "image/jpeg" });
        act(() => {
            result.current.form.setValue("reason", "พักรักษาตัว");
            result.current.form.setValue("emergencyReason", "มีเหตุฉุกเฉิน");
            result.current.form.setValue("specialReason", "เหตุผลพิเศษ");
            result.current.form.setValue("period", "AFTERNOON");
            result.current.addAttachments([file]);
            result.current.selectDraftDate("2026-10-30");
        });
        expect(result.current.needsEmergencyReason).toBe(false);
        act(() => result.current.confirmDraftDates());
        expect(result.current.needsEmergencyReason).toBe(true);
        act(() => result.current.switchToMultiDay());
        expect(result.current.form.getValues("period")).toBe("FULL_DAY");
        act(() => result.current.selectDraftDate("2026-11-06"));
        act(() => result.current.discardDraftDates());
        act(() => result.current.switchToSingleDay());
        expect(result.current.form.getValues()).toMatchObject({ startDate: "2026-10-30", endDate: "2026-10-30", reason: "พักรักษาตัว", emergencyReason: "มีเหตุฉุกเฉิน", specialReason: "เหตุผลพิเศษ" });
        expect(result.current.attachments).toEqual([file]);
        act(() => result.current.selectDraftDate("2026-11-03"));
        act(() => result.current.confirmDraftDates());
        await waitFor(() => expect(result.current.needsEmergencyReason).toBe(false));
        act(() => result.current.resetForm());
        expect(result.current.hasPendingDates).toBe(false); expect(result.current.attachments).toEqual([]);
    });

    it("rejects cross-year ranges with the domain message and restarts a completed range", () => {
        const { result } = setup();
        act(() => result.current.switchToMultiDay());
        act(() => result.current.selectDraftDate("2026-12-31"));
        act(() => result.current.selectDraftDate("2027-01-04"));
        expect(result.current.draftDateWarning).toContain("ไม่สามารถลาข้ามปี");
        act(() => result.current.confirmDraftDates());
        expect(result.current.form.getValues("startDate")).toBe("2026-11-02");
        act(() => result.current.selectDraftDate("2027-01-05"));
        expect(result.current.draftDates).toEqual({ start: "2027-01-05", end: "" });
    });
});
