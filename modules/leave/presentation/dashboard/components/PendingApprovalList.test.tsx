import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PendingApprovalList } from "./PendingApprovalList";
import type { PendingLeave } from "../hooks/useLeaveApprovals";

const leave: PendingLeave = {
    id: "leave-1", employeeId: 1, leaveType: "SICK",
    startDate: "2030-05-09", endDate: "2030-05-13", period: "FULL_DAY", durationDays: 3,
    reason: "พักรักษาตัว", emergencyReason: null, specialReason: "เหตุผลพิเศษ", overQuotaDays: 1,
    status: "PENDING", cancellationReason: null, cancellationRequestedAt: null,
    cancellationConfirmedAt: null, cancellationConfirmedById: null,
    notTakenReason: null, notTakenRequestedAt: null, notTakenConfirmedAt: null,
    createdAt: "2030-05-01", attachments: [],
    employee: { firstName: "ทดสอบ", lastName: "พนักงาน", nickname: null, position: "เจ้าหน้าที่", departmentId: 1, dept: null },
};

it("shows the explanation before approval without altering stored duration or warnings", () => {
    const onApprove = vi.fn(async () => undefined);
    const onOpenReject = vi.fn();
    const renderList = (item: PendingLeave) => <PendingApprovalList pending={[item]} isProcessing={false} onApprove={onApprove} onOpenReject={onOpenReject} canApproveAssignedRequests />;
    const { rerender } = render(renderList(leave));
    expect(screen.getByText(/จำนวนวันตามปฏิทิน 5 วัน/)).toHaveTextContent("วันเสาร์–อาทิตย์ 2 วัน = วันลาที่นับ 3 วัน");
    expect(screen.getByText(/เกินสิทธิ์ 1 วัน/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "อนุมัติ" }));
    fireEvent.click(screen.getByRole("button", { name: "ไม่อนุมัติ" }));
    expect(onApprove).toHaveBeenCalledWith(leave);
    expect(onOpenReject).toHaveBeenCalledWith(leave);
    rerender(renderList({ ...leave, durationDays: 4 }));
    expect(screen.getByText(/เต็มวัน \(4 วัน\)/)).toBeInTheDocument();
    expect(screen.queryByText(/จำนวนวันตามปฏิทิน/)).not.toBeInTheDocument();
    rerender(renderList({ ...leave, endDate: leave.startDate, period: "MORNING", durationDays: 0.5 }));
    expect(screen.getByText(/เช้า \(0.5 วัน\)/)).toBeInTheDocument();
    expect(screen.queryByText(/จำนวนวันตามปฏิทิน/)).not.toBeInTheDocument();
});
