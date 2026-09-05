import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApprovalHistoryList } from "./ApprovalHistoryList";
import { EmployeeLeaveHistoryList } from "./EmployeeLeaveHistoryList";
import { NotTakenPendingList } from "./NotTakenPendingList";
import { PendingApprovalList } from "./PendingApprovalList";
import type { PendingLeave } from "../hooks/useLeaveApprovals";
import type { LeaveRequest } from "../hooks/useLeaveProfile";
import { fetchLeaveAttachmentImage } from "../api";
import type { LeaveAttachmentSummary } from "../../types";

vi.mock("../api", () => ({
    fetchLeaveAttachmentImage: vi.fn(),
}));

const attachment: LeaveAttachmentSummary = {
    id: "attachment-1",
    contentType: "image/webp",
    sizeBytes: 12_345,
    width: 1200,
    height: 800,
    viewUrl: "/api/leave/attachments/attachment-1",
};

function createEmployeeRequest(
    status: LeaveRequest["status"],
    attachments: LeaveAttachmentSummary[],
): LeaveRequest {
    return {
        id: `leave-${status}`,
        employeeId: 100,
        leaveType: "SICK",
        startDate: "2027-01-04T00:00:00.000Z",
        endDate: "2027-01-04T00:00:00.000Z",
        period: "FULL_DAY",
        durationDays: 1,
        reason: "พักรักษาตัว",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
        status,
        approverId: 200,
        approvedAt: null,
        rejectReason: null,
        notTakenReason: null,
        notTakenRequestedAt: null,
        notTakenConfirmedAt: null,
        notTakenConfirmedById: null,
        cancellationReason: null,
        cancellationRequestedAt: null,
        cancellationConfirmedAt: null,
        cancellationConfirmedById: null,
        attachments,
        createdAt: "2027-01-01T00:00:00.000Z",
        updatedAt: "2027-01-01T00:00:00.000Z",
    };
}

function createPendingLeave(): PendingLeave {
    return {
        id: "leave-pending",
        employeeId: 100,
        leaveType: "SICK",
        startDate: "2027-01-04T00:00:00.000Z",
        endDate: "2027-01-04T00:00:00.000Z",
        period: "FULL_DAY",
        durationDays: 1,
        reason: "พักรักษาตัว",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
        status: "PENDING",
        notTakenReason: null,
        notTakenRequestedAt: null,
        notTakenConfirmedAt: null,
        cancellationReason: null,
        cancellationRequestedAt: null,
        cancellationConfirmedAt: null,
        cancellationConfirmedById: null,
        createdAt: "2027-01-01T00:00:00.000Z",
        attachments: [attachment, { ...attachment, id: "attachment-2" }],
        employee: {
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: null,
            position: "เจ้าหน้าที่",
            departmentId: 1,
            dept: { name: "งานกลาง" },
        },
    };
}

describe("leave attachment list controls", () => {
    beforeEach(() => {
        vi.mocked(fetchLeaveAttachmentImage).mockImplementation(
            () => new Promise<Blob>(() => undefined),
        );
    });

    it("does not show an evidence button when a request has no attachments", () => {
        render(
            <EmployeeLeaveHistoryList
                history={[createEmployeeRequest("PENDING", [])]}
                isSubmitting={false}
                onCancelRequest={vi.fn()}
                onNotTakenRequest={vi.fn()}
                onPageChange={vi.fn()}
            />,
        );

        expect(
            screen.queryByRole("button", { name: /ไฟล์แนบ/ }),
        ).not.toBeInTheDocument();
    });

    it.each([
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        "NOT_TAKEN",
    ] as const)("lets the employee open evidence for %s history", (status) => {
        render(
            <EmployeeLeaveHistoryList
                history={[createEmployeeRequest(status, [attachment])]}
                isSubmitting={false}
                onCancelRequest={vi.fn()}
                onNotTakenRequest={vi.fn()}
                onPageChange={vi.fn()}
            />,
        );

        expect(
            screen.queryByAltText("ไฟล์แนบคำขอลา รูปที่ 1 จาก 1"),
        ).not.toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: "ไฟล์แนบ 1 รูป" }),
        );
        expect(
            screen.getByRole("dialog", { name: "ไฟล์แนบคำขอลา" }),
        ).toBeInTheDocument();
    });

    it("shows attachment count before the approver decision controls", () => {
        render(
            <PendingApprovalList
                pending={[createPendingLeave()]}
                isProcessing={false}
                onApprove={vi.fn()}
                onOpenReject={vi.fn()}
            />,
        );

        const evidenceButton = screen.getByRole("button", {
            name: "ไฟล์แนบ 2 รูป",
        });
        const approveButton = screen.getByRole("button", { name: "อนุมัติ" });

        expect(
            evidenceButton.compareDocumentPosition(approveButton)
            & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
            screen.queryByAltText("ไฟล์แนบคำขอลา รูปที่ 1 จาก 2"),
        ).not.toBeInTheDocument();
    });

    it("shows evidence in approval history", () => {
        const historyLeave = {
            ...createPendingLeave(),
            status: "APPROVED" as const,
        };

        render(<ApprovalHistoryList history={[historyLeave]} />);

        fireEvent.click(
            screen.getByRole("button", { name: "ไฟล์แนบ 2 รูป" }),
        );
        expect(
            screen.getByRole("dialog", { name: "ไฟล์แนบคำขอลา" }),
        ).toBeInTheDocument();
    });

    it("shows evidence before the not-taken confirmation action", () => {
        const notTakenLeave = {
            ...createPendingLeave(),
            status: "APPROVED" as const,
            notTakenReason: "ไม่ได้ลาเพราะมีงานด่วน",
            notTakenRequestedAt: "2027-01-05T00:00:00.000Z",
        };

        render(
            <NotTakenPendingList
                items={[notTakenLeave]}
                isProcessing={false}
                onConfirm={vi.fn()}
            />,
        );

        const evidenceButton = screen.getByRole("button", {
            name: "ไฟล์แนบ 2 รูป",
        });
        const confirmButton = screen.getByRole("button", {
            name: "ยืนยันคืนโควต้า",
        });
        expect(
            evidenceButton.compareDocumentPosition(confirmButton)
            & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });
});
