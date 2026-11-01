import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "@/lib/client/api-client";
import { chooseLeaveDate } from "@/__tests__/helpers/leave-calendar";
import { LeaveRequestForm } from "./dashboard/LeaveRequestForm";
import { LiffLeaveRequestForm } from "./liff/LiffLeaveRequestForm";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { HolidayReference } from "../schemas/holiday-reference";

vi.mock("@/lib/client/api-client", () => ({ apiGet: vi.fn() }));
vi.mock("./dashboard/api", () => ({ submitLeaveRequest: vi.fn() }));
vi.mock("./liff/api", () => ({ submitLiffLeaveRequest: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const data: HolidayReference = { year: 2026, events: [
    { date: "2026-11-02", name: "วันหยุดทดสอบ", classification: "public-holiday" },
    { date: "2026-11-02", name: "อีกหนึ่งวันสำคัญ", classification: "observance" },
    { date: "2026-11-07", name: "วันสำคัญสุดสัปดาห์", classification: "unverified" },
] };
const success = (): Awaited<ReturnType<typeof apiGet>> => ({ success: true, data, status: 200, requestId: "test" });
const originalScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");

describe.each(["dashboard", "liff"] as const)("%s primary date calendar", (channel) => {
    const onClose = vi.fn();
    function mount(): void {
        const quotas = [{ id: "quota", employeeId: 1, year: 2026, leaveType: "SICK" as const, totalDays: 30, usedDays: 0, carryBalanceDays: 0, effectiveTotalDays: 30, remainingDays: 30 }];
        render(<SWRConfig value={{ provider: () => new Map() }}>
            {channel === "dashboard" ? <LeaveRequestForm open quotas={quotas} onCancel={onClose} onSuccess={vi.fn()} />
                : <LiffLeaveRequestForm open quotas={quotas} onOpenChange={onClose} onSuccess={vi.fn()} />}
        </SWRConfig>);
    }
    beforeEach(() => {
        vi.clearAllMocks(); vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-31T18:00:00Z"));
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");
        Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
        vi.mocked(apiGet).mockResolvedValue(success());
    });
    afterEach(() => {
        vi.useRealTimers(); vi.unstubAllEnvs();
        if (originalScrollIntoView) Object.defineProperty(Element.prototype, "scrollIntoView", originalScrollIntoView);
        else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    });

    it("renders directly in Bangkok month with Thai BE caption and the authenticated reference channel", async () => {
        mount();
        expect(screen.getByText("พฤศจิกายน 2569")).toBeInTheDocument();
        expect(screen.queryByText("ดูปฏิทินวันหยุด")).not.toBeInTheDocument();
        expect(document.querySelector('input[type="date"]')).toBeNull();
        await screen.findByText(/รายการวันหยุดทั้งปี/);
        expect(apiGet).toHaveBeenCalledWith(`${channel === "liff" ? API_ROUTES.line.leaveHolidays : API_ROUTES.leave.holidays}?year=2026`, expect.objectContaining(channel === "liff" ? { skipAuthRefresh: true } : { cache: "no-store" }));
        const annual = document.querySelector("details");
        expect(annual).not.toHaveAttribute("open");
    });

    it("selects holiday weekdays and shows multiple events without committing or blocking rapid range selection", async () => {
        mount(); await screen.findByText(/รายการวันหยุดทั้งปี/);
        fireEvent.click(screen.getByRole("button", { name: "หลายวัน" }));
        chooseLeaveDate("2026-11-02", false);
        const details = await screen.findByRole("dialog", { name: "ข้อมูลวันหยุด" });
        expect(within(details).getByText("วันหยุดทดสอบ")).toBeInTheDocument();
        expect(within(details).getByText("อีกหนึ่งวันสำคัญ")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ยืนยันวันที่ลา" })).toBeDisabled();
        chooseLeaveDate("2026-11-06", false);
        expect(screen.getByText(/กำลังเลือก:/)).toHaveTextContent("2 พฤศจิกายน 2569 – 6 พฤศจิกายน 2569");
        expect(screen.queryByRole("dialog", { name: "ข้อมูลวันหยุด" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^4 พฤศจิกายน/ })).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันวันที่ลา" }));
        expect(screen.getByText(/จำนวนวันตามปฏิทิน 5 วัน/)).toHaveTextContent("ขอลา 5 วัน");
        expect(onClose).not.toHaveBeenCalled();
    });

    it("allows inspecting weekend holidays without selecting them, and Escape closes only details", async () => {
        mount(); await screen.findByText(/รายการวันหยุดทั้งปี/);
        chooseLeaveDate("2026-11-02");
        chooseLeaveDate("2026-11-07", false);
        const weekend = screen.getByRole("button", { name: /^7 พฤศจิกายน/ });
        expect(weekend).toHaveAttribute("aria-disabled", "true");
        expect(weekend).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByText(/วันที่ในคำขอ:/)).toHaveTextContent("2 พฤศจิกายน 2569");
        const details = await screen.findByRole("dialog", { name: "ข้อมูลวันหยุด" });
        fireEvent.keyDown(details, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "ข้อมูลวันหยุด" })).toBeNull());
        expect(weekend).toHaveFocus(); expect(onClose).not.toHaveBeenCalled();
    });

    it("closes details on navigation and ordinary selection; browsing annual data preserves dates", async () => {
        mount(); await screen.findByText(/รายการวันหยุดทั้งปี/);
        chooseLeaveDate("2026-11-02", false);
        fireEvent.click(screen.getByRole("button", { name: "เดือนถัดไป" }));
        expect(screen.queryByRole("dialog", { name: "ข้อมูลวันหยุด" })).toBeNull();
        expect(screen.getByText(/กำลังเลือก:/)).toHaveTextContent("2 พฤศจิกายน");
        fireEvent.click(screen.getByText(/รายการวันหยุดทั้งปี/));
        expect(screen.getByText(/กำลังเลือก:/)).toHaveTextContent("2 พฤศจิกายน");
        chooseLeaveDate("2026-11-02", false);
        chooseLeaveDate("2026-11-03", false);
        expect(screen.queryByRole("dialog", { name: "ข้อมูลวันหยุด" })).toBeNull();
    });

    it("highlights Friday through Monday including weekends, charges two days and preserves Step 2 round trip", async () => {
        mount();
        fireEvent.change(screen.getByLabelText("เหตุผลการลา"), { target: { value: "พักรักษาตัว" } });
        fireEvent.click(screen.getByRole("button", { name: "หลายวัน" }));
        chooseLeaveDate("2026-11-06", false); chooseLeaveDate("2026-11-09", false);
        expect(screen.getByRole("button", { name: /^7 พฤศจิกายน/ })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: /^8 พฤศจิกายน/ })).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบคำขอ" }));
        expect(await screen.findByText(/กรุณายืนยันวันที่ลา หรือ/)).toBeInTheDocument();
        expect(screen.queryByRole("group", { name: "ตรวจสอบคำขอลา" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันวันที่ลา" }));
        expect(screen.getByText(/จำนวนวันตามปฏิทิน 4 วัน/)).toHaveTextContent("วันทำงาน 2 วัน · ขอลา 2 วัน");
        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบคำขอ" }));
        const review = await screen.findByRole("group", { name: "ตรวจสอบคำขอลา" });
        expect(review).toHaveTextContent("28 วัน");
        fireEvent.click(screen.getByRole("button", { name: "แก้ไข" }));
        expect(screen.getByRole("button", { name: /^6 พฤศจิกายน/ })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByLabelText("เหตุผลการลา")).toHaveValue("พักรักษาตัว");
        chooseLeaveDate("2026-11-10", false);
        expect(screen.getByRole("button", { name: "ยืนยันวันที่ลา" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "ยกเลิกวันที่ที่กำลังเลือก" }));
        expect(screen.getByText(/กำลังเลือก:/)).toHaveTextContent("6 พฤศจิกายน 2569 – 9 พฤศจิกายน 2569");
    });

    it("rejects cross-year drafts while allowing navigation beyond supported reference years", async () => {
        mount(); fireEvent.click(screen.getByRole("button", { name: "หลายวัน" }));
        chooseLeaveDate("2026-12-31", false); chooseLeaveDate("2027-01-04", false);
        expect(screen.getByText(/ไม่สามารถลาข้ามปี/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ยืนยันวันที่ลา" })).toBeDisabled();
        chooseLeaveDate("2029-01-01", false);
        expect(screen.getByText(/ไม่มีข้อมูลวันหยุดอ้างอิงสำหรับปีนี้/)).toBeInTheDocument();
        expect(vi.mocked(apiGet).mock.calls.every(([url]) => !String(url).includes("year=2029"))).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "วันเดียว" }));
        chooseLeaveDate("2029-01-01");
        expect(screen.getByText(/วันที่ในคำขอ:/)).toHaveTextContent("1 มกราคม 2572");
    }, 20000);

    it.each([false, true])("keeps selection operational during unavailable/incomplete reference data (%s), with retry", async (incomplete) => {
        vi.mocked(apiGet).mockResolvedValueOnce({ success: false, error: "Unavailable", errorThai: "Unavailable", code: "NETWORK_ERROR", ...(incomplete ? { details: { code: "HOLIDAY_DATA_INCOMPLETE" } } : {}) });
        mount(); await screen.findByText(/ยังเลือกวันที่ลาได้ตามปกติ/);
        chooseLeaveDate("2026-11-02");
        expect(screen.getByText(/จำนวนวันตามปฏิทิน 1 วัน/)).toHaveTextContent("ขอลา 1 วัน");
        fireEvent.change(screen.getByLabelText("เหตุผลการลา"), { target: { value: "พักรักษาตัว" } });
        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบคำขอ" }));
        expect(await screen.findByRole("group", { name: "ตรวจสอบคำขอลา" })).toHaveTextContent("29 วัน");
        fireEvent.click(screen.getByRole("button", { name: "แก้ไข" }));
        fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
        await screen.findByText(/รายการวันหยุดทั้งปี/);
        expect(apiGet).toHaveBeenCalledTimes(2);
        expect(screen.getByText(/จำนวนวันตามปฏิทิน 1 วัน/)).toHaveTextContent("ขอลา 1 วัน");
    });

    it.each(["ครึ่งวันเช้า", "ครึ่งวันบ่าย"])("keeps the existing %s control and quota preview functional", async (period) => {
        mount(); chooseLeaveDate("2026-11-03");
        fireEvent.keyDown(screen.getByRole("combobox", { name: "ช่วงเวลา" }), { key: "ArrowDown" });
        fireEvent.click(await screen.findByRole("option", { name: period }));
        expect(screen.getByText(/จำนวนวันตามปฏิทิน 1 วัน/)).toHaveTextContent("ขอลา 0.5 วัน");
        fireEvent.change(screen.getByLabelText("เหตุผลการลา"), { target: { value: "พักรักษาตัว" } });
        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบคำขอ" }));
        const review = await screen.findByRole("group", { name: "ตรวจสอบคำขอลา" });
        expect(review).toHaveTextContent(period);
        expect(review).toHaveTextContent("29.5 วัน");
    });

    it("shows backdated requirements only after confirmation and clears them when corrected", async () => {
        mount(); chooseLeaveDate("2026-10-30", false);
        expect(screen.queryByLabelText("เหตุผลในการลาย้อนหลัง")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันวันที่ลา" }));
        expect(screen.getByLabelText("เหตุผลในการลาย้อนหลัง")).toBeInTheDocument();
        chooseLeaveDate("2026-11-02");
        await waitFor(() => expect(screen.queryByLabelText("เหตุผลในการลาย้อนหลัง")).toBeNull());
    });

    it("keeps an unresolved holiday request independent from local date selection", async () => {
        let resolve: ((value: Awaited<ReturnType<typeof apiGet>>) => void) | undefined;
        vi.mocked(apiGet).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
        mount(); expect(screen.getByText("กำลังโหลดข้อมูลวันหยุด...")).toBeInTheDocument();
        chooseLeaveDate("2026-11-03");
        expect(screen.getByText(/วันที่ในคำขอ:/)).toHaveTextContent("3 พฤศจิกายน");
        await act(async () => resolve?.(success()));
        expect(screen.getByText(/จำนวนวันตามปฏิทิน 1 วัน/)).toHaveTextContent("ขอลา 1 วัน");
    });
});
