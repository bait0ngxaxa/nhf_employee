import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HolidayCalendarPage } from "./HolidayCalendarPage";
import { loadHolidayCalendar, saveHolidayCalendar } from "./api";
import { formatHolidayDate } from "./HolidayDraftEditor";

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
});
