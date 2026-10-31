import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarImpactReview } from "./CalendarImpactReview";
import { confirmCalendarReconciliation, loadCalendarImpact } from "./api";
import type { CalendarImpactReport } from "../../domain/calendar-reconciliation";

vi.mock("./api", () => ({ loadCalendarImpact: vi.fn(), confirmCalendarReconciliation: vi.fn() }));
const calendar = {
    year: 2026,
    activeVersionNumber: 2,
    versions: [
        {
            id: "v2",
            number: 2,
            revision: 1,
            publishedAt: "2026-10-01T00:00:00Z",
            publicationNote: "ตรวจแล้ว",
            days: [],
        },
    ],
};
const report: CalendarImpactReport = {
    year: 2026,
    activeVersionId: "v2",
    activeVersion: 2,
    proposedVersionId: "v2",
    proposedVersion: 2,
    proposedRevision: 1,
    proposedPublished: true,
    addedHolidays: [],
    removedHolidays: [],
    nextCursor: null,
    rows: [
        {
            id: "r1",
            employeeId: 1,
            employeeName: "พนักงาน ทดสอบ",
            leaveType: "VACATION",
            status: "APPROVED",
            startDate: "2026-11-02",
            endDate: "2026-11-03",
            period: "FULL_DAY",
            originalDurationHalfDays: 4,
            calculationCalendarVersionId: "v1",
            approvalCalendarVersionId: "v1",
            chargedHalfDays: 4,
            proposedChargeHalfDays: 2,
            proposedDurationHalfDays: 2,
            differenceHalfDays: -2,
            validForNewRequest: false,
            action: "RECONCILE",
            adjustments: [],
        },
    ],
};

describe("ADMIN impact and explicit reconciliation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(loadCalendarImpact).mockResolvedValue(report);
    });
    it("requires reason and confirmation for one immutable request, and passes the expected charge/version", async () => {
        vi.mocked(confirmCalendarReconciliation).mockResolvedValue({
            replayed: false,
            adjustment: {
                id: "a1",
                calendarVersionId: "v2",
                calendarVersion: 2,
                previousHalfDays: 4,
                resultingHalfDays: 2,
                reason: "วันหยุดเพิ่มขึ้น",
                overQuotaJustification: null,
                administratorId: 7,
                administratorName: "Admin",
                createdAt: "2026-10-01T00:00:00Z",
            },
        });
        render(<CalendarImpactReview calendar={calendar} />);
        fireEvent.click(screen.getByRole("button", { name: "ตรวจผลกระทบใหม่" }));
        expect(await screen.findByText("พนักงาน ทดสอบ · ลาพักร้อน")).toBeInTheDocument();
        fireEvent.click(screen.getByText("ตรวจและยืนยันปรับโควต้าคำขอนี้"));
        const button = screen.getByRole("button", { name: "ยืนยันปรับโควต้าเฉพาะคำขอนี้" });
        expect(button).toBeDisabled();
        fireEvent.change(screen.getByLabelText("เหตุผลการปรับโควต้า (อย่างน้อย 5 ตัวอักษร)"), {
            target: { value: "วันหยุดเพิ่มขึ้น" },
        });
        expect(button).toBeDisabled();
        fireEvent.click(
            screen.getByLabelText("ยืนยันปรับจาก 2 เป็น 1 วัน โดยคงรายละเอียดคำขอเดิม"),
        );
        fireEvent.click(button);
        await waitFor(() =>
            expect(confirmCalendarReconciliation).toHaveBeenCalledWith({
                year: 2026,
                leaveRequestId: "r1",
                calendarVersionId: "v2",
                expectedChargeHalfDays: 4,
                reason: "วันหยุดเพิ่มขึ้น",
                confirmed: true,
            }),
        );
    });
    it("offers no reconciliation mutation for drafts or affected pending requests", async () => {
        vi.mocked(loadCalendarImpact).mockResolvedValue({
            ...report,
            proposedPublished: false,
            proposedVersionId: "draft",
            rows: [
                {
                    ...report.rows[0],
                    status: "PENDING",
                    chargedHalfDays: 0,
                    proposedChargeHalfDays: 0,
                    differenceHalfDays: 0,
                    action: "CANCEL_AND_RESUBMIT",
                },
            ],
        });
        render(<CalendarImpactReview calendar={calendar} />);
        fireEvent.click(screen.getByRole("button", { name: "ตรวจผลกระทบใหม่" }));
        expect(
            await screen.findByText("เจ้าของต้องยกเลิกและยื่นใหม่ก่อนอนุมัติ"),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "ยืนยันปรับโควต้าเฉพาะคำขอนี้" }),
        ).not.toBeInTheDocument();
    });
});
