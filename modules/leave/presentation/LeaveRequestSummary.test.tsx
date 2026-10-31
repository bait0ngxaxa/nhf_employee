import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { submitLeaveRequestMock, submitLiffLeaveRequestMock } = vi.hoisted(() => ({
    submitLeaveRequestMock: vi.fn(),
    submitLiffLeaveRequestMock: vi.fn(),
}));

vi.mock("./dashboard/api", () => ({
    submitLeaveRequest: submitLeaveRequestMock,
}));
vi.mock("./liff/api", () => ({
    submitLiffLeaveRequest: submitLiffLeaveRequestMock,
}));
vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

import { LeaveRequestForm } from "./dashboard/LeaveRequestForm";
import { LiffLeaveRequestForm } from "./liff/LiffLeaveRequestForm";
import { LeaveRequestSummary } from "./LeaveRequestSummary";

describe("Leave request summary", () => {
    it("does not display an unknown quota as zero", () => {
        render(
            <LeaveRequestSummary
                leaveType="SICK"
                requestedDays={1}
                remainingQuota={null}
                projectedRemainingQuota={null}
                overQuotaDays={0}
                isDateRangeValid
            />,
        );

        const summary = screen.getByRole("region", { name: "สรุปคำขอลา" });
        expect(summary).toHaveTextContent("ไม่ทราบยอดคงเหลือของปีที่เลือก");
        expect(summary).toHaveTextContent("ยังคำนวณไม่ได้");
        expect(summary).not.toHaveTextContent("0 วัน");
    });

    it("shows quota impact and special-reason review guidance when over quota", () => {
        render(
            <LeaveRequestSummary
                leaveType="PERSONAL"
                requestedDays={2}
                remainingQuota={1}
                projectedRemainingQuota={-1}
                overQuotaDays={1}
                isDateRangeValid
            />,
        );

        const summary = screen.getByRole("region", { name: "สรุปคำขอลา" });
        expect(summary).toHaveTextContent("คำขอนี้เกินสิทธิ์ 1 วัน");
        expect(summary).toHaveTextContent("ผู้อนุมัติจะพิจารณาจากเหตุผลพิเศษที่ระบุ");
        expect(summary).not.toHaveTextContent("จำนวนวันคำนวณจาก");
    });

    it("keeps the summary for the review step and shows the same summary in Dashboard and LIFF", async () => {
        const dashboardView = render(
            <LeaveRequestForm
                open
                onCancel={vi.fn()}
                onSuccess={vi.fn()}
                quotas={[{
                    id: "quota-1",
                    year: 2031,
                    employeeId: 1,
                    leaveType: "SICK",
                    totalDays: 10,
                    carryBalanceDays: 0,
                    effectiveTotalDays: 10,
                    usedDays: 2,
                    remainingDays: 8,
                }]}
            />,
        );
        const dashboardSummary = await reviewSummary();
        expect(dashboardSummary).toContain("1 วัน");
        expect(dashboardSummary).toContain("8 วัน");
        expect(dashboardSummary).toContain("7 วัน");
        dashboardView.unmount();

        render(
            <LiffLeaveRequestForm
                open
                quotas={[{
                    year: 2031,
                    leaveType: "SICK",
                    totalDays: 10,
                    carryBalanceDays: 0,
                    effectiveTotalDays: 10,
                    usedDays: 2,
                    remainingDays: 8,
                }]}
                onOpenChange={vi.fn()}
                onSuccess={vi.fn()}
            />,
        );
        const liffSummary = await reviewSummary();

        expect(liffSummary).toBe(dashboardSummary);
        expect(liffSummary).not.toContain("ยังไม่ตัดวันหยุดนักขัตฤกษ์ออก");
    });
});

async function reviewSummary(): Promise<string | null> {
    fireEvent.change(screen.getByLabelText("วันที่ลา"), {
        target: { value: "2031-01-06" },
    });
    fireEvent.change(screen.getByLabelText("เหตุผลการลา"), {
        target: { value: "พักรักษาตัวตามคำแนะนำแพทย์" },
    });
    expect(screen.queryByRole("region", { name: "สรุปคำขอลา" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบคำขอ" }));

    const summary = await screen.findByRole("region", { name: "สรุปคำขอลา" });
    expect(screen.getByRole("button", { name: "ยืนยันส่งคำขอลา" })).toBeInTheDocument();
    return summary.textContent;
}
