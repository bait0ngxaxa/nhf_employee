import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HolidayCalendarPage } from "./HolidayCalendarPage";
import { loadCalendarImpact, loadHolidayCalendar, saveHolidayCalendar } from "./api";
import { formatHolidayDate, HolidayDraftEditor } from "./HolidayDraftEditor";
import type { ManagedHolidayCalendar } from "../../domain/holiday-calendar";

vi.mock("./api", () => ({ loadHolidayCalendar: vi.fn(), saveHolidayCalendar: vi.fn(), loadCalendarImpact: vi.fn().mockResolvedValue({ rows: [], addedHolidays: [], removedHolidays: [], year: 2027, proposedVersion: 1, activeVersion: null, nextCursor: null }), confirmCalendarReconciliation: vi.fn() }));

describe("organization calendar dashboard", () => {
    beforeEach(() => vi.clearAllMocks());

    it("shows published holidays to USER without administration controls", async () => {
        vi.mocked(loadHolidayCalendar).mockResolvedValue({ year: 2026, version: 1, days: [{ date: "2026-01-01", name: "วันหยุดทดสอบ", category: "ORGANIZATION" }] });
        render(<HolidayCalendarPage isAdmin={false} />);
        expect(await screen.findByText("วันหยุดทดสอบ")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "สร้างปฏิทินฉบับร่าง" })).not.toBeInTheDocument();
        expect(screen.queryByLabelText("แหล่งอ้างอิง / เลขที่ประกาศ / URL")).not.toBeInTheDocument();
        expect(formatHolidayDate("2026-01-01")).toContain("2569");
    });

    it("lets ADMIN prepare any future annual draft", async () => {
        vi.mocked(loadHolidayCalendar).mockResolvedValue({ year: 2027, activeVersionNumber: null, versions: [] });
        vi.mocked(saveHolidayCalendar).mockResolvedValue({ year: 2027, activeVersionNumber: null, versions: [{ id: "draft", number: 1, revision: 0, days: [], publishedAt: null, publicationNote: null }] });
        render(<HolidayCalendarPage isAdmin />);
        await screen.findByRole("button", { name: "สร้างปฏิทินฉบับร่าง" });
        fireEvent.change(screen.getByLabelText("ปี ค.ศ."), { target: { value: "2027" } });
        fireEvent.click(screen.getByRole("button", { name: "แสดงปีที่เลือก" }));
        await waitFor(() => expect(loadHolidayCalendar).toHaveBeenLastCalledWith(2027, true));
        fireEvent.click(await screen.findByRole("button", { name: "สร้างปฏิทินฉบับร่าง" }));
        expect(await screen.findByText("ฉบับร่าง 1 · ยังไม่เผยแพร่")).toBeInTheDocument();
        expect(saveHolidayCalendar).toHaveBeenCalledWith({ action: "create", year: 2027, expectedActiveVersion: null });
        fireEvent.click(screen.getByRole("button", { name: "ตรวจรายการก่อนเผยแพร่" }));
        expect(screen.getByRole("button", { name: "ยืนยันเผยแพร่ฉบับ 1" })).toBeDisabled();
    });

    const defaultVersion = {
        id: "default", number: 1, revision: 0, publishedAt: "2026-10-31T00:00:00.000Z",
        publicationNote: "SYSTEM: bot-2027-r1", defaultDatasetRevision: "bot-2027-r1",
        days: [{ date: "2027-01-01", name: "วันขึ้นปีใหม่", category: "OFFICIAL" as const, source: "https://app.bot.or.th/FIPCS/thai/PFIPCS_summary.aspx?packId=25690175" }],
    };

    it("shows the effective default and source without an annual publication or impact-review workflow", async () => {
        vi.mocked(loadHolidayCalendar).mockResolvedValue({ year: 2027, activeVersionNumber: 1, hasLeaveRequests: false, versions: [defaultVersion] });
        render(<HolidayCalendarPage isAdmin calendarEnforced />);
        expect(await screen.findByText("ใช้ปฏิทินค่าเริ่มต้น · ฉบับ 1")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "ดูประกาศต้นทาง ธปท." })).toHaveAttribute("href", defaultVersion.days[0].source);
        expect(screen.getByRole("button", { name: "ปรับแต่งวันหยุด" })).toBeInTheDocument();
        expect(screen.queryByText(/ฉบับร่าง/)).not.toBeInTheDocument();
        expect(screen.queryByText("ตรวจผลกระทบและปรับโควต้า")).not.toBeInTheDocument();
        expect(screen.queryByText("ประวัติการเผยแพร่")).not.toBeInTheDocument();
        expect(saveHolidayCalendar).not.toHaveBeenCalled();
        expect(loadCalendarImpact).not.toHaveBeenCalled();
    });

    it("allows USER to see default provenance without customization controls", async () => {
        vi.mocked(loadHolidayCalendar).mockResolvedValue({ year: 2027, version: 1, defaultDatasetRevision: "bot-2027-r1", source: defaultVersion.days[0].source, days: defaultVersion.days });
        render(<HolidayCalendarPage isAdmin={false} calendarEnforced />);
        expect(await screen.findByText("ใช้ปฏิทินค่าเริ่มต้น · ฉบับ 1")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ปรับแต่งวันหยุด" })).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "ดูประกาศต้นทาง ธปท." })).toBeInTheDocument();
    });

    it("starts revision editing only when ADMIN chooses customization", async () => {
        const draft = { ...defaultVersion, id: "draft", number: 2, publishedAt: null, defaultDatasetRevision: undefined };
        vi.mocked(loadHolidayCalendar).mockResolvedValue({ year: 2027, activeVersionNumber: 1, hasLeaveRequests: false, versions: [defaultVersion] });
        vi.mocked(saveHolidayCalendar).mockResolvedValue({ year: 2027, activeVersionNumber: 1, hasLeaveRequests: false, versions: [draft, defaultVersion] });
        render(<HolidayCalendarPage isAdmin calendarEnforced />);
        fireEvent.click(await screen.findByRole("button", { name: "ปรับแต่งวันหยุด" }));
        expect(await screen.findByText("ฉบับร่าง 2 · ยังไม่เผยแพร่")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ลบ วันขึ้นปีใหม่" })).toBeInTheDocument();
        expect(loadCalendarImpact).not.toHaveBeenCalled();
    });

    it("publishes a verified customization without pointless impact review when the server reports no requests", async () => {
        const draft = { ...defaultVersion, id: "draft", number: 2, publishedAt: null, defaultDatasetRevision: undefined };
        const calendar: ManagedHolidayCalendar = { year: 2027, activeVersionNumber: 1, hasLeaveRequests: false, versions: [draft, defaultVersion] };
        vi.mocked(saveHolidayCalendar).mockResolvedValue(calendar);
        render(<HolidayDraftEditor calendar={calendar} draft={draft} onSaved={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "ตรวจรายการก่อนเผยแพร่" }));
        expect(screen.getByText("ยังไม่มีคำขอลาในปีนี้ จึงไม่ต้องตรวจผลกระทบต่อคำขอเดิม")).toBeInTheDocument();
        expect(loadCalendarImpact).not.toHaveBeenCalled();
        fireEvent.click(screen.getByLabelText("ตรวจสอบวันที่ แหล่งอ้างอิง และยืนยันว่าทุกรายการเป็นวันหยุดขององค์กรแล้ว"));
        fireEvent.change(screen.getByLabelText("เหตุผล / บันทึกการเผยแพร่"), { target: { value: "ปรับแต่งวันหยุด NHF" } });
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันเผยแพร่ฉบับ 2" }));
        await waitFor(() => expect(saveHolidayCalendar).toHaveBeenCalledWith(expect.objectContaining({ action: "publish", versionId: "draft", expectedActiveVersion: 1, verified: true, skipImpactReview: true })));
    });

    it("keeps impact and reconciliation available when requests exist", async () => {
        vi.mocked(loadHolidayCalendar).mockResolvedValue({ year: 2027, activeVersionNumber: 1, hasLeaveRequests: true, versions: [defaultVersion] });
        render(<HolidayCalendarPage isAdmin calendarEnforced />);
        expect(await screen.findByText("ตรวจผลกระทบและปรับโควต้า")).toBeInTheDocument();
    });
});
