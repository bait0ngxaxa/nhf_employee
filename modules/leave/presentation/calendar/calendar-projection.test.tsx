import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { useLeaveRequestFormModel } from "../dashboard/hooks/useLeaveRequestFormModel";
import { LeaveRequestForm } from "../dashboard/LeaveRequestForm";
import { LiffLeaveRequestForm } from "../liff/LiffLeaveRequestForm";
import { fetchDashboardLeavePreview, fetchLiffLeavePreview } from "./leave-preview";

vi.mock("./leave-preview", () => ({ fetchDashboardLeavePreview: vi.fn(), fetchLiffLeavePreview: vi.fn() }));

describe("shared Dashboard/LIFF calendar projection", () => {
    afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

    it("does not request a Saturday preview when the form initializes in Bangkok", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-30T17:30:00Z")); // Saturday 00:30 in Bangkok
        const previewRequest = vi.fn();
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess: vi.fn(), previewRequest }), {
            wrapper: ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>,
        });
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
        expect(result.current.startDateValue).toBe("2026-10-31");
        expect(previewRequest).not.toHaveBeenCalled();
        expect(result.current.calculationNotice).toBe("วันที่ลาตรงกับวันหยุด");

        previewRequest.mockResolvedValue({ durationHalfDays: 2, calendarVersionId: "v1", calendarVersion: 1, mode: "PUBLISHED_CALENDAR", remainingHalfDays: 60, projectedRemainingHalfDays: 58, overQuotaHalfDays: 0 });
        act(() => {
            result.current.form.setValue("startDate", "2026-11-02");
            result.current.form.setValue("endDate", "2026-11-02");
        });
        await waitFor(() => expect(result.current.requestedDays).toBe(1));
        expect(result.current.calculationNotice).toBeNull();
        expect(previewRequest).toHaveBeenCalledExactlyOnceWith({ startDate: "2026-11-02", endDate: "2026-11-02", period: "FULL_DAY", leaveType: "SICK" });
    });

    it.each(["DASHBOARD", "LIFF"] as const)("shows the holiday warning in the %s form without requesting an invalid preview", async (channel) => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-30T17:30:00Z"));
        render(channel === "DASHBOARD"
            ? <LeaveRequestForm open onCancel={vi.fn()} onSuccess={vi.fn()} quotas={[]} />
            : <LiffLeaveRequestForm open onOpenChange={vi.fn()} onSuccess={vi.fn()} quotas={[]} />);
        expect(screen.getByRole("alert")).toHaveTextContent("วันที่ลาตรงกับวันหยุด");
        expect(screen.getByRole("alert")).toHaveClass("bg-status-warning-surface", "text-status-warning-foreground");
        expect(screen.queryByText("กรุณาเลือกวันทำงานเพื่อคำนวณวันลาและโควต้า")).not.toBeInTheDocument();
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
        expect(fetchDashboardLeavePreview).not.toHaveBeenCalled();
        expect(fetchLiffLeavePreview).not.toHaveBeenCalled();
    });

    it.each(["DASHBOARD", "LIFF"] as const)("does not calculate on page entry while the %s request dialog is closed", async (channel) => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-02T03:00:00Z"));
        render(channel === "DASHBOARD"
            ? <LeaveRequestForm open={false} onCancel={vi.fn()} onSuccess={vi.fn()} quotas={[]} />
            : <LiffLeaveRequestForm open={false} onOpenChange={vi.fn()} onSuccess={vi.fn()} quotas={[]} />);
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
        expect(fetchDashboardLeavePreview).not.toHaveBeenCalled();
        expect(fetchLiffLeavePreview).not.toHaveBeenCalled();
    });

    it.each(["DASHBOARD", "LIFF"] as const)("warns about a published holiday inside a valid %s leave range", async (channel) => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-02T03:00:00Z"));
        const preview = { durationHalfDays: 4, calendarVersionId: "v1", calendarVersion: 1, mode: "PUBLISHED_CALENDAR" as const, remainingHalfDays: 60, projectedRemainingHalfDays: 56, overQuotaHalfDays: 0, holidayDates: ["2026-11-03"] };
        const calculate = async (input: { endDate: string }) => ({ ...preview, holidayDates: input.endDate === "2026-11-04" ? preview.holidayDates : [] });
        vi.mocked(fetchDashboardLeavePreview).mockImplementation(calculate);
        vi.mocked(fetchLiffLeavePreview).mockImplementation(calculate);
        render(channel === "DASHBOARD"
            ? <LeaveRequestForm open onCancel={vi.fn()} onSuccess={vi.fn()} quotas={[]} />
            : <LiffLeaveRequestForm open onOpenChange={vi.fn()} onSuccess={vi.fn()} quotas={[]} />);
        fireEvent.click(screen.getByRole("button", { name: "หลายวัน" }));
        fireEvent.change(screen.getByLabelText("วันที่สิ้นสุด"), { target: { value: "2026-11-04" } });
        // The server reports configured holidays; no annual data or weekday inference lives in the UI.
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("ช่วงวันที่ลามีวันหยุด"));
        expect(screen.getByRole("alert")).toHaveClass("bg-status-warning-surface");
        expect(screen.queryByText(/คำนวณตามปฏิทิน/)).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("วันที่สิ้นสุด"), { target: { value: "2026-11-02" } });
        await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    });

    it.each(["DASHBOARD", "LIFF"] as const)("shows the server holiday warning for a single weekday holiday in %s", async (channel) => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-12-10T03:00:00Z"));
        vi.mocked(fetchDashboardLeavePreview).mockRejectedValue(new Error("วันที่ลาตรงกับวันหยุด"));
        vi.mocked(fetchLiffLeavePreview).mockRejectedValue(new Error("วันที่ลาตรงกับวันหยุด"));
        render(channel === "DASHBOARD"
            ? <LeaveRequestForm open onCancel={vi.fn()} onSuccess={vi.fn()} quotas={[]} />
            : <LiffLeaveRequestForm open onOpenChange={vi.fn()} onSuccess={vi.fn()} quotas={[]} />, {
            wrapper: ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>,
        });
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("วันที่ลาตรงกับวันหยุด"));
        expect(screen.getByRole("alert")).toHaveClass("bg-status-warning-surface");
    });

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
        expect(result.current.calculationNotice).toBeNull();
        expect(previewRequest).toHaveBeenCalledWith({ startDate: "2026-11-02", endDate: "2026-11-04", period: "FULL_DAY", leaveType: "VACATION" });
    });
});
