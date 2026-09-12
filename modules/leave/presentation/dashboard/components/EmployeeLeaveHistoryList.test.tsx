import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmployeeLeaveHistoryList } from "./EmployeeLeaveHistoryList";
import type { LeaveRequest } from "../hooks/useLeaveProfile";

function createLeaveRequest(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
    return {
        id: "leave-approved-cancellation-requested",
        employeeId: 10,
        leaveType: "VACATION",
        startDate: "2099-01-10T00:00:00.000Z",
        endDate: "2099-01-10T00:00:00.000Z",
        period: "FULL_DAY",
        durationDays: 1,
        reason: "พักร้อน",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
        status: "APPROVED",
        approverId: 20,
        approvedAt: "2098-12-20T00:00:00.000Z",
        rejectReason: null,
        notTakenReason: null,
        notTakenRequestedAt: null,
        notTakenConfirmedAt: null,
        notTakenConfirmedById: null,
        cancellationReason: "เปลี่ยนแผนการเดินทาง",
        cancellationRequestedAt: "2098-12-21T00:00:00.000Z",
        cancellationConfirmedAt: null,
        cancellationConfirmedById: null,
        attachments: [],
        createdAt: "2098-12-20T00:00:00.000Z",
        updatedAt: "2098-12-21T00:00:00.000Z",
        ...overrides,
    };
}

describe("EmployeeLeaveHistoryList", () => {
    it("does not show the cancellation request button when cancellation is already requested", () => {
        render(
            <EmployeeLeaveHistoryList
                history={[createLeaveRequest()]}
                isSubmitting={false}
                onCancelRequest={vi.fn()}
                onNotTakenRequest={vi.fn()}
                onPageChange={vi.fn()}
                canCancelOwnRequests
                canRequestOwnNotTaken
            />,
        );

        expect(
            screen.queryByRole("button", { name: "ขอยกเลิก" }),
        ).not.toBeInTheDocument();
        expect(screen.getByText("คำขอยกเลิกได้รับการพิจารณาแล้ว:")).toBeInTheDocument();
        expect(screen.getByText(
            "คำขอยกเลิกครั้งก่อนไม่ได้รับการอนุมัติ และไม่สามารถส่งคำขอยกเลิกซ้ำได้",
        )).toBeInTheDocument();
    });

    it("shows a filtered empty state instead of the initial empty state", () => {
        render(
            <EmployeeLeaveHistoryList
                history={[]}
                isFiltered
                isSubmitting={false}
                onCancelRequest={vi.fn()}
                onNotTakenRequest={vi.fn()}
                onPageChange={vi.fn()}
                canCancelOwnRequests
                canRequestOwnNotTaken
            />,
        );

        expect(
            screen.getByText("ไม่พบประวัติการลาตามตัวกรองที่เลือก"),
        ).toBeInTheDocument();
        expect(
            screen.getByText("ลองปรับหรือล้างตัวกรองเพื่อดูรายการอื่น"),
        ).toBeInTheDocument();
        expect(screen.queryByText("ยังไม่มีประวัติการยื่นคำขอลา")).not.toBeInTheDocument();
    });

    it("does not expose employee actions when their capabilities are absent", () => {
        render(
            <EmployeeLeaveHistoryList
                history={[
                    createLeaveRequest({
                        id: "leave-pending",
                        status: "PENDING",
                    }),
                    createLeaveRequest({
                        id: "leave-not-taken",
                        status: "APPROVED",
                        startDate: "2020-01-01T00:00:00.000Z",
                        endDate: "2020-01-01T00:00:00.000Z",
                    }),
                ]}
                isSubmitting={false}
                onCancelRequest={vi.fn()}
                onNotTakenRequest={vi.fn()}
                onPageChange={vi.fn()}
                canCancelOwnRequests={false}
                canRequestOwnNotTaken={false}
            />,
        );

        expect(screen.queryByRole("button", { name: "ยกเลิก" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "แจ้งไม่ได้ใช้วันลา" }))
            .not.toBeInTheDocument();
    });
});
