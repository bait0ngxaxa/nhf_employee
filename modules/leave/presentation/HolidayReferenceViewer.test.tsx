import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "@/lib/client/api-client";
import { LeaveRequestForm } from "./dashboard/LeaveRequestForm";
import { LiffLeaveRequestForm } from "./liff/LiffLeaveRequestForm";
import type { HolidayReference } from "../schemas/holiday-reference";
import { API_ROUTES } from "@/lib/ssot/routes";

vi.mock("@/lib/client/api-client", () => ({ apiGet: vi.fn() }));
vi.mock("./dashboard/api", () => ({ submitLeaveRequest: vi.fn() }));
vi.mock("./liff/api", () => ({ submitLiffLeaveRequest: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const data: HolidayReference = {
    year: 2026,
    events: [
        ...Array.from({ length: 12 }, (_, index) => ({
            date: `2026-${String(index + 1).padStart(2, "0")}-02`,
            name: `รายการเดือน ${index + 1}`,
            classification: "public-holiday" as const,
        })),
        { date: "2026-11-02", name: "อีกหนึ่งวันสำคัญ", classification: "observance" },
        { date: "2026-12-31", name: "วันหยุดอ้างอิง", classification: "unverified" },
    ],
};

function success() {
    return { success: true as const, data, status: 200, requestId: "test" };
}

describe.each(["dashboard", "liff"] as const)("%s holiday calendar integration", (channel) => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    function mount(): void {
        const quotas = [{ id: "quota", employeeId: 1, year: 2026, leaveType: "SICK" as const, totalDays: 30, usedDays: 0, carryBalanceDays: 0, effectiveTotalDays: 30, remainingDays: 30 }];
        render(<SWRConfig value={{ provider: () => new Map() }}>
            {channel === "dashboard"
                ? <LeaveRequestForm open quotas={quotas} onCancel={onClose} onSuccess={onSuccess} />
                : <LiffLeaveRequestForm open quotas={quotas} onOpenChange={onClose} onSuccess={onSuccess} />}
        </SWRConfig>);
    }
    function open(): void { fireEvent.click(screen.getByRole("button", { name: "ดูปฏิทินวันหยุด" })); }
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-31T18:00:00Z")); // November in Bangkok, October in UTC
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");
        vi.mocked(apiGet).mockResolvedValue(success());
    });
    afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

    it("loads lazily through the correct authenticated channel, defaults to Bangkok month and shows all annual events", async () => {
        mount();
        expect(apiGet).not.toHaveBeenCalled();
        open();
        const calendar = await screen.findByRole("table", { name: "พฤศจิกายน 2569" });
        expect(calendar).toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "ปฏิทินวันหยุดประจำปี 2569" })).toBeInTheDocument();
        const annual = screen.getByRole("region", { name: "รายการวันหยุดทั้งปี" });
        for (const event of data.events) expect(within(annual).getByText(event.name)).toBeInTheDocument();
        expect(apiGet).toHaveBeenCalledWith(channel === "liff" ? API_ROUTES.line.leaveHolidays : API_ROUTES.leave.holidays, expect.objectContaining(channel === "liff" ? { skipAuthRefresh: true } : { cache: "no-store" }));
        fireEvent.click(within(calendar).getByRole("button", { name: /^2 พฤศจิกายน 2569/ }));
        expect(screen.getAllByText("อีกหนึ่งวันสำคัญ")).toHaveLength(2);
        expect(screen.getAllByText("รายการเดือน 11")).toHaveLength(2);
        expect(within(calendar).getByRole("button", { name: /^2 พฤศจิกายน 2569/ })).toHaveAttribute("aria-pressed", "true");
        expect(within(calendar).getByRole("button", { name: /^1 พฤศจิกายน 2569/ })).toHaveAttribute("aria-current", "date");
    });

    it("bounds month navigation to the current year", async () => {
        mount(); open();
        await screen.findByRole("table");
        fireEvent.click(screen.getByRole("button", { name: "เดือนถัดไป" }));
        expect(screen.getByRole("table", { name: "ธันวาคม 2569" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "เดือนถัดไป" })).toBeDisabled();
        const previousMonth = screen.getByRole("button", { name: "เดือนก่อนหน้า" });
        for (let i = 0; i < 11; i++) fireEvent.click(previousMonth);
        expect(screen.getByRole("table", { name: "มกราคม 2569" })).toBeInTheDocument();
        expect(previousMonth).toBeDisabled();
    });

    it("refreshes reference data on opening after the 24-hour deduplication window", async () => {
        vi.useFakeTimers();
        mount(); open();
        await act(async () => { await vi.advanceTimersByTimeAsync(50); });
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(apiGet).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "กลับไปกรอกคำขอลา" }));
        await act(async () => { await vi.advanceTimersByTimeAsync(86400001); });
        open();
        await act(async () => { await vi.advanceTimersByTimeAsync(50); });
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(apiGet).toHaveBeenCalledTimes(2);
    });

    it.each([true, false])("closes only the calendar, restores focus and preserves values, duration, quota preview and Step 2 validity (available: %s)", async (available) => {
        if (!available) vi.mocked(apiGet).mockResolvedValue({ success: false, error: "Unavailable", errorThai: "Unavailable", code: "NETWORK_ERROR" });
        mount();
        fireEvent.change(screen.getByLabelText("วันที่ลา"), { target: { value: "2026-12-31" } });
        fireEvent.change(screen.getByLabelText("เหตุผลการลา"), { target: { value: "ตรวจสุขภาพ" } });
        const calculation = screen.getByText(/จำนวนวันตามปฏิทิน/).textContent;
        open();
        if (available) await screen.findByRole("table");
        else await screen.findByText("ไม่สามารถโหลดข้อมูลวันหยุดได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
        fireEvent.click(screen.getByRole("button", { name: "กลับไปกรอกคำขอลา" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "ดูปฏิทินวันหยุด" })).toHaveFocus());
        expect(screen.getByRole("dialog", { name: "ยื่นคำขอลา" })).toBeInTheDocument();
        expect(screen.getByLabelText("วันที่ลา")).toHaveValue("2026-12-31");
        expect(screen.getByLabelText("เหตุผลการลา")).toHaveValue("ตรวจสุขภาพ");
        expect(screen.getByText(/จำนวนวันตามปฏิทิน/)).toHaveTextContent(calculation ?? "");
        expect(onClose).not.toHaveBeenCalled();
        open();
        if (available) await screen.findByRole("table");
        else await screen.findByText("ไม่สามารถโหลดข้อมูลวันหยุดได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
        expect(apiGet).toHaveBeenCalledTimes(available ? 1 : 2);
        fireEvent.keyDown(screen.getByRole("dialog", { name: /ปฏิทินวันหยุดประจำปี/ }), { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog", { name: /ปฏิทินวันหยุดประจำปี/ })).not.toBeInTheDocument());
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบคำขอ" }));
        const review = await screen.findByRole("group", { name: "ตรวจสอบคำขอลา" });
        expect(review).toHaveTextContent("1 วัน");
        expect(review).toHaveTextContent("29 วัน");
        expect(screen.queryByRole("button", { name: "ดูปฏิทินวันหยุด" })).not.toBeInTheDocument();
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it("shows loading then an error, supports retry, and keeps invalid weekend selections invalid", async () => {
        let resolve: ((value: Awaited<ReturnType<typeof apiGet>>) => void) | undefined;
        vi.mocked(apiGet).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
        mount();
        fireEvent.change(screen.getByLabelText("วันที่ลา"), { target: { value: "2026-12-26" } });
        fireEvent.change(screen.getByLabelText("เหตุผลการลา"), { target: { value: "ตรวจสุขภาพ" } });
        const warning = screen.getByRole("alert").textContent;
        open();
        expect(await screen.findByText("กำลังโหลดข้อมูลวันหยุด...")).toBeInTheDocument();
        await act(async () => resolve?.({ success: false, error: "Failure", errorThai: "Failure", code: "NETWORK_ERROR" }));
        expect(await screen.findByText("ไม่สามารถโหลดข้อมูลวันหยุดได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
        await screen.findByRole("table");
        expect(apiGet).toHaveBeenCalledTimes(2);
        fireEvent.click(screen.getByRole("button", { name: "ปิดปฏิทินวันหยุด" }));
        expect(screen.getByRole("alert")).toHaveTextContent(warning ?? "");
        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบคำขอ" }));
        await waitFor(() => expect(screen.queryByRole("group", { name: "ตรวจสอบคำขอลา" })).not.toBeInTheDocument());
        expect(screen.getByText("ขั้นตอน 1 จาก 2 · กรอกข้อมูล")).toBeInTheDocument();
    });

    it("shows unavailable coverage instead of an empty calendar", async () => {
        vi.mocked(apiGet).mockResolvedValue({ success: false, error: "Unavailable", errorThai: "Unavailable", code: "INTERNAL_ERROR", details: { code: "HOLIDAY_DATA_INCOMPLETE" } });
        mount(); open();
        expect(await screen.findByText(/ข้อมูลวันหยุดปีนี้ยังไม่ครบถ้วน/)).toBeInTheDocument();
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ลองใหม่" })).toBeEnabled();
    });

    it.each([{ year: 2026, events: [] }, { ...data, year: 2025 }])("rejects empty or mismatched JSON instead of displaying an empty/current-year calendar", async (invalid) => {
        vi.mocked(apiGet).mockResolvedValue({ ...success(), data: invalid });
        mount(); open();
        await screen.findByRole("alert");
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("keeps the active form and calendar unavailable when Leave is disabled", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");
        mount();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ดูปฏิทินวันหยุด" })).not.toBeInTheDocument();
        expect(apiGet).not.toHaveBeenCalled();
    });
});
