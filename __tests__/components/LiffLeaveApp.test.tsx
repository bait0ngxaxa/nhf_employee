import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    search: "",
    fetchProfile: vi.fn(),
    fetchApprovals: vi.fn(),
    fetchRequest: vi.fn(),
    cancelLeave: vi.fn(),
    confirmNotTaken: vi.fn(),
    decideCancellation: vi.fn(),
    requestNotTaken: vi.fn(),
    submitDecision: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/lib/client/liff-leave", () => ({
    fetchLiffLeaveProfile: mocks.fetchProfile,
    fetchLiffLeaveApprovals: mocks.fetchApprovals,
    fetchLiffLeaveRequest: mocks.fetchRequest,
    cancelLiffLeave: mocks.cancelLeave,
    confirmLiffLeaveNotTaken: mocks.confirmNotTaken,
    decideLiffLeaveCancellation: mocks.decideCancellation,
    requestLiffLeaveNotTaken: mocks.requestNotTaken,
    submitLiffLeaveDecision: mocks.submitDecision,
}));

vi.mock("@/components/liff/leave/LiffLeaveOverview", () => ({
    LiffLeaveOverview: ({ onCreateRequest }: { onCreateRequest: () => void }) => (
        <section>
            <h1>Leave</h1>
            <button type="button" onClick={onCreateRequest}>ยื่นลา</button>
            <p>สิทธิ์วันลาของฉัน</p>
        </section>
    ),
}));
vi.mock("@/components/liff/leave/LiffLeaveHistory", () => ({
    LiffLeaveHistory: () => <section>คำขอลาของฉัน</section>,
}));
vi.mock("@/components/liff/leave/LiffLeaveApprovals", () => ({
    LiffLeaveApprovals: () => <section>ไม่มีรายการรอพิจารณา</section>,
}));
vi.mock("@/components/liff/leave/LiffLeaveRequestForm", () => ({
    LiffLeaveRequestForm: ({ open }: { open: boolean }) => open
        ? <div>แบบฟอร์มยื่นลา</div>
        : null,
}));
vi.mock("@/components/liff/leave/LiffLeaveRequestDetail", () => ({
    LiffLeaveRequestDetail: ({
        detail,
        actionIntent,
    }: {
        detail: { id: string } | null;
        actionIntent: string | null;
    }) => detail
        ? <div>รายละเอียด {detail.id} intent {actionIntent ?? "none"}</div>
        : null,
}));
vi.mock("@/components/liff/leave/LiffLeaveDecisionSheet", () => ({
    LiffLeaveDecisionSheet: () => null,
}));

import { LiffLeaveApp } from "@/components/liff/leave/LiffLeaveApp";
import { LiffApiError } from "@/lib/client/liff";

const PROFILE = {
    quotas: [],
    history: [],
    metadata: {
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: 10,
        availableYears: [],
    },
};

function approvals(hasActionableWork: boolean) {
    return {
        pending: [],
        notTakenPending: [],
        cancellationPending: [],
        metadata: {
            pending: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 },
            notTakenPending: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 },
            cancellationPending: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 },
        },
        hasActionableWork,
    };
}

describe("LIFF Leave app orchestration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.search = "";
        mocks.fetchProfile.mockResolvedValue(PROFILE);
        mocks.fetchApprovals.mockResolvedValue(approvals(false));
    });

    it("shows the employee experience and hides an empty approver tab", async () => {
        render(<LiffLeaveApp />);

        expect(await screen.findByRole("heading", { name: "Leave" })).toBeInTheDocument();
        expect(screen.getByText("สิทธิ์วันลาของฉัน")).toBeInTheDocument();
        expect(screen.getByText("คำขอลาของฉัน")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ยื่นลา" })).toBeInTheDocument();
        expect(screen.queryByRole("tab", { name: /รอพิจารณา/ })).not.toBeInTheDocument();
    });

    it("shows the approver tab only for server-derived actionable workload", async () => {
        mocks.fetchApprovals.mockResolvedValueOnce(approvals(true));

        render(<LiffLeaveApp />);

        expect(await screen.findByRole("tab", { name: /รอพิจารณา/ })).toBeInTheDocument();
    });

    it("opens a deep-linked request as presentation intent without mutating", async () => {
        mocks.search = "requestId=leave_1&action=approve";
        mocks.fetchRequest.mockResolvedValueOnce({
            id: "leave_1",
            viewerRole: "APPROVER",
            availableActions: ["APPROVE", "REJECT"],
        });

        render(<LiffLeaveApp />);

        expect(await screen.findByText("รายละเอียด leave_1 intent approve"))
            .toBeInTheDocument();
        expect(mocks.fetchRequest).toHaveBeenCalledWith("leave_1");
        expect(mocks.submitDecision).not.toHaveBeenCalled();
        expect(mocks.cancelLeave).not.toHaveBeenCalled();
        expect(mocks.confirmNotTaken).not.toHaveBeenCalled();
        expect(mocks.decideCancellation).not.toHaveBeenCalled();
    });

    it("fails an inaccessible deep link safely without revealing its request", async () => {
        mocks.search = "requestId=private_leave&action=approve";
        mocks.fetchRequest.mockRejectedValueOnce(new LiffApiError("private", 404));

        render(<LiffLeaveApp />);

        await waitFor(() => {
            expect(screen.getByText("ไม่พบคำขอลานี้ หรือคุณไม่มีสิทธิ์ดูรายการดังกล่าว"))
                .toBeInTheDocument();
        });
        expect(screen.queryByText(/รายละเอียด private_leave/)).not.toBeInTheDocument();
        expect(mocks.submitDecision).not.toHaveBeenCalled();
    });

    it("rejects malformed deep-link IDs without calling the detail API", async () => {
        mocks.search = "requestId=..%2Fprivate&action=approve";

        render(<LiffLeaveApp />);

        expect(await screen.findByText("ลิงก์คำขอลาไม่ถูกต้อง กำลังแสดงรายการของคุณตามปกติ"))
            .toBeInTheDocument();
        expect(mocks.fetchRequest).not.toHaveBeenCalled();
    });
});
