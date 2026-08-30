import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LiffLeaveApprovals } from "@/components/liff/leave/LiffLeaveApprovals";
import { LiffLeaveDecisionSheet } from "@/components/liff/leave/LiffLeaveDecisionSheet";
import { LiffLeaveHistory } from "@/components/liff/leave/LiffLeaveHistory";
import { LiffLeaveQuotaCards } from "@/components/liff/leave/LiffLeaveQuotaCards";
import { LiffLeaveRequestDetail } from "@/components/liff/leave/LiffLeaveRequestDetail";
import type {
    LiffEmployeeLeaveRequest,
    LiffLeaveApprovalsResponse,
    LiffLeaveProfileResponse,
    LiffLeaveQuotaSummary,
} from "@/lib/types/leave";

const QUOTAS: LiffLeaveQuotaSummary[] = [
    {
        year: 2026,
        leaveType: "SICK",
        totalDays: 30,
        carryBalanceDays: 0,
        effectiveTotalDays: 30,
        usedDays: 2,
        remainingDays: 28,
    },
    {
        year: 2026,
        leaveType: "PERSONAL",
        totalDays: 6,
        carryBalanceDays: 0,
        effectiveTotalDays: 6,
        usedDays: 1,
        remainingDays: 5,
    },
    {
        year: 2026,
        leaveType: "VACATION",
        totalDays: 8,
        carryBalanceDays: 2,
        effectiveTotalDays: 10,
        usedDays: 3,
        remainingDays: 7,
    },
];

const HISTORY_ITEM: LiffEmployeeLeaveRequest = {
    id: "leave_1",
    leaveType: "SICK",
    startDate: "2026-09-01T00:00:00.000Z",
    endDate: "2026-09-01T00:00:00.000Z",
    period: "FULL_DAY",
    durationDays: 1,
    reason: "พักรักษาตัวตามคำแนะนำแพทย์",
    emergencyReason: null,
    specialReason: null,
    overQuotaDays: 0,
    status: "PENDING",
    approvedAt: null,
    rejectReason: null,
    notTakenReason: null,
    notTakenRequestedAt: null,
    notTakenConfirmedAt: null,
    cancellationReason: null,
    cancellationRequestedAt: null,
    cancellationConfirmedAt: null,
    attachments: [],
    createdAt: "2026-08-30T10:00:00.000Z",
    updatedAt: "2026-08-30T10:00:00.000Z",
    approver: { firstName: "หัวหน้า", lastName: "ทดสอบ", nickname: null },
    availableActions: ["CANCEL"],
};

const PROFILE: LiffLeaveProfileResponse = {
    quotas: QUOTAS,
    history: [HISTORY_ITEM],
    metadata: {
        currentPage: 1,
        totalPages: 2,
        totalItems: 11,
        itemsPerPage: 10,
        availableYears: [2026, 2025],
    },
};

const EMPTY_APPROVALS: LiffLeaveApprovalsResponse = {
    pending: [],
    notTakenPending: [],
    cancellationPending: [],
    metadata: {
        pending: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 },
        notTakenPending: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 },
        cancellationPending: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 },
    },
    hasActionableWork: false,
};

describe("LIFF Leave mobile components", () => {
    it("shows all quota cards with effective remaining and used amounts", () => {
        render(<LiffLeaveQuotaCards quotas={QUOTAS} />);

        expect(screen.getByRole("heading", { name: "สิทธิ์วันลาของฉัน" })).toBeInTheDocument();
        expect(screen.getByText("ลาป่วย")).toBeInTheDocument();
        expect(screen.getByText("ลากิจ")).toBeInTheDocument();
        expect(screen.getByText("ลาพักร้อน")).toBeInTheDocument();
        expect(screen.getByLabelText("ใช้แล้ว 3 จาก 10 วัน")).toBeInTheDocument();
    });

    it("renders history cards and only server-authorized employee actions", () => {
        const onAction = vi.fn();
        const onPageChange = vi.fn();
        render(
            <LiffLeaveHistory
                profile={PROFILE}
                filters={{}}
                isLoading={false}
                onApplyFilters={vi.fn()}
                onPageChange={onPageChange}
                onOpenDetail={vi.fn()}
                onAction={onAction}
            />,
        );

        expect(screen.getByText("พักรักษาตัวตามคำแนะนำแพทย์")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ยกเลิก" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "แจ้งไม่ได้ใช้วันลา" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
        expect(onAction).toHaveBeenCalledWith("CANCEL", HISTORY_ITEM);
        fireEvent.click(screen.getByRole("button", { name: "หน้าถัดไป" }));
        expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it("treats an empty approver queue as a healthy completed state", () => {
        render(
            <LiffLeaveApprovals
                approvals={EMPTY_APPROVALS}
                isLoading={false}
                onOpenDetail={vi.fn()}
                onAction={vi.fn()}
                onPageChange={vi.fn()}
            />,
        );

        expect(screen.getByRole("heading", { name: "ไม่มีรายการรอพิจารณา" }))
            .toBeInTheDocument();
    });

    it("requires a rejection reason and exposes a clear mutation busy state", () => {
        const onConfirm = vi.fn();
        const { rerender } = render(
            <LiffLeaveDecisionSheet
                intent={{
                    requestId: "leave_1",
                    action: "REJECT",
                    title: "ลาป่วย",
                    summary: "1 ก.ย. 2569",
                }}
                busy={false}
                error={null}
                onOpenChange={vi.fn()}
                onConfirm={onConfirm}
            />,
        );

        const confirm = screen.getByRole("button", { name: "ยืนยันไม่อนุมัติ" });
        expect(confirm).toBeDisabled();
        fireEvent.change(screen.getByPlaceholderText("ระบุเหตุผลให้พนักงานทราบ"), {
            target: { value: "ข้อมูลหลักฐานไม่ครบ" },
        });
        fireEvent.click(confirm);
        expect(onConfirm).toHaveBeenCalledWith("ข้อมูลหลักฐานไม่ครบ");

        rerender(
            <LiffLeaveDecisionSheet
                intent={{
                    requestId: "leave_1",
                    action: "REJECT",
                    title: "ลาป่วย",
                    summary: "1 ก.ย. 2569",
                }}
                busy
                error={null}
                onOpenChange={vi.fn()}
                onConfirm={onConfirm}
            />,
        );
        expect(screen.getByRole("button", { name: "กำลังดำเนินการ..." })).toBeDisabled();
    });

    it("does not turn approve deep-link intent into requester approval UI", () => {
        render(
            <LiffLeaveRequestDetail
                detail={{
                    ...HISTORY_ITEM,
                    viewerRole: "REQUESTER",
                    availableActions: ["CANCEL"],
                }}
                actionIntent="approve"
                onOpenChange={vi.fn()}
                onAction={vi.fn()}
            />,
        );

        expect(screen.getByRole("button", { name: "ยกเลิกคำขอลา" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "อนุมัติ" })).not.toBeInTheDocument();
        expect(screen.queryByText(/เปิดจากลิงก์เพื่อพิจารณา/)).not.toBeInTheDocument();
    });
});
