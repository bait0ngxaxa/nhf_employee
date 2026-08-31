import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeaveHistoryFilters } from "@/lib/services/leave/history-filters";
import type {
    ApproverLeaveAction,
    LiffLeaveRequestDetail as LiffLeaveRequestDetailData,
} from "@/lib/types/leave";

const mocks = vi.hoisted(() => ({
    search: "",
    fetchHome: vi.fn(),
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

vi.mock("@/lib/client/liff-home", () => ({
    fetchLiffHome: mocks.fetchHome,
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
    LiffLeaveHistory: ({
        profile,
        onApplyFilters,
        onPageChange,
        onOpenDetail,
    }: {
        profile: { history: Array<{ id: string }> };
        onApplyFilters: (filters: LeaveHistoryFilters) => void;
        onPageChange: (page: number) => void;
        onOpenDetail: (requestId: string) => void;
    }) => (
        <section>
            คำขอลาของฉัน
            <span data-testid="history-current">
                {profile.history[0]?.id ?? "none"}
            </span>
            <button
                type="button"
                data-testid="history-filter-old"
                onClick={() => onApplyFilters({ query: "old" })}
            >
                filter-old
            </button>
            <button
                type="button"
                data-testid="history-filter-new"
                onClick={() => onApplyFilters({ query: "new" })}
            >
                filter-new
            </button>
            <button
                type="button"
                data-testid="history-page-two"
                onClick={() => onPageChange(2)}
            >
                page-two
            </button>
            <button
                type="button"
                data-testid="history-detail-a"
                onClick={() => onOpenDetail("leave-a")}
            >
                detail-a
            </button>
            <button
                type="button"
                data-testid="history-detail-b"
                onClick={() => onOpenDetail("leave-b")}
            >
                detail-b
            </button>
        </section>
    ),
}));
vi.mock("@/components/liff/leave/LiffLeaveApprovals", () => ({
    LiffLeaveApprovals: ({
        approvals,
        onPageChange,
    }: {
        approvals: {
            metadata: { pending: { currentPage: number } };
        };
        onPageChange: (
            category: "pending" | "notTakenPending" | "cancellationPending",
            page: number,
        ) => void;
    }) => (
        <section>
            ไม่มีรายการรอพิจารณา
            <span data-testid="approval-current-page">
                {approvals.metadata.pending.currentPage}
            </span>
            <button
                type="button"
                data-testid="approval-page-two"
                onClick={() => onPageChange("pending", 2)}
            >
                approval-page-two
            </button>
            <button
                type="button"
                data-testid="approval-page-three"
                onClick={() => onPageChange("pending", 3)}
            >
                approval-page-three
            </button>
        </section>
    ),
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
        onOpenChange,
        onAction,
    }: {
        detail: LiffLeaveRequestDetailData | null;
        actionIntent: string | null;
        onOpenChange: (open: boolean) => void;
        onAction: (
            action: ApproverLeaveAction,
            detail: LiffLeaveRequestDetailData,
        ) => void;
    }) => detail
        ? (
            <div>
                รายละเอียด {detail.id} intent {actionIntent ?? "none"}
                {detail.availableActions?.includes("APPROVE") ? (
                    <button
                        type="button"
                        data-testid="detail-approve"
                        onClick={() => onAction("APPROVE", detail)}
                    >
                        detail-approve
                    </button>
                ) : null}
                <button
                    type="button"
                    data-testid="close-detail"
                    onClick={() => onOpenChange(false)}
                >
                    close-detail
                </button>
            </div>
        )
        : null,
}));
vi.mock("@/components/liff/leave/LiffLeaveDecisionSheet", () => ({
    LiffLeaveDecisionSheet: ({
        intent,
        onConfirm,
        onOpenChange,
        error,
    }: {
        intent: { action: string } | null;
        onConfirm: (reason: string | undefined) => void | Promise<void>;
        onOpenChange: (open: boolean) => void;
        error: string | null;
    }) => intent
        ? (
            <div>
                {error ? <div role="alert">{error}</div> : null}
                <button type="button" onClick={() => void onConfirm(undefined)}>
                    ยืนยันการทดสอบ
                </button>
                <button type="button" onClick={() => onOpenChange(false)}>
                    ปิดการทดสอบ
                </button>
            </div>
        )
        : null,
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

function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
} {
    let resolvePromise: (value: T) => void = () => undefined;
    let rejectPromise: (reason?: unknown) => void = () => undefined;
    const promise = new Promise<T>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });
    return { promise, resolve: resolvePromise, reject: rejectPromise };
}

describe("LIFF Leave app orchestration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.search = "";
        mocks.fetchHome.mockResolvedValue({
            workforce: { userId: 1, employeeId: 1, name: "พนักงาน ทดสอบ" },
            modules: {},
            capabilities: { canApproveLeave: false },
        });
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
        expect(mocks.fetchApprovals).not.toHaveBeenCalled();
    });

    it("loads approvals and shows the approver tab for a capable approver", async () => {
        mocks.fetchHome.mockResolvedValueOnce({
            workforce: { userId: 1, employeeId: 1, name: "หัวหน้า ทดสอบ" },
            modules: {},
            capabilities: { canApproveLeave: true },
        });
        mocks.fetchApprovals.mockResolvedValueOnce(approvals(true));

        render(<LiffLeaveApp />);

        expect(await screen.findByRole("tab", { name: /รอพิจารณา/ })).toBeInTheDocument();
        expect(mocks.fetchApprovals).toHaveBeenCalledWith({
            pendingPage: 1,
            notTakenPage: 1,
            cancellationPage: 1,
        });
    });

    it("keeps employee Leave usable and localizes an approval loading failure", async () => {
        mocks.fetchHome.mockResolvedValueOnce({
            workforce: { userId: 1, employeeId: 1, name: "หัวหน้า ทดสอบ" },
            modules: {},
            capabilities: { canApproveLeave: true },
        });
        mocks.fetchApprovals.mockRejectedValueOnce(new Error("approval unavailable"));

        render(<LiffLeaveApp />);

        expect(await screen.findByRole("heading", { name: "Leave" })).toBeInTheDocument();
        expect(screen.getByText("สิทธิ์วันลาของฉัน")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "เปิด Leave ไม่สำเร็จ" }))
            .not.toBeInTheDocument();
        const approvalsTab = screen.getByRole("tab", { name: /รอพิจารณา/ });
        expect(approvalsTab).toBeInTheDocument();
        fireEvent.mouseDown(approvalsTab, { button: 0, ctrlKey: false });
        expect(await screen.findByText("โหลดรายการรอพิจารณาไม่สำเร็จ"))
            .toBeInTheDocument();
        expect(await screen.findByRole("button", { name: "ลองโหลดรายการอีกครั้ง" }))
            .toBeInTheDocument();
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
        expect(mocks.fetchApprovals).not.toHaveBeenCalled();
        expect(screen.getByRole("tab", { name: /รอพิจารณา/ })).toBeInTheDocument();
        expect(mocks.submitDecision).not.toHaveBeenCalled();
        expect(mocks.cancelLeave).not.toHaveBeenCalled();
        expect(mocks.confirmNotTaken).not.toHaveBeenCalled();
        expect(mocks.decideCancellation).not.toHaveBeenCalled();
    });

    it("refreshes approval state after recovered decision ambiguity without deciding twice", async () => {
        mocks.search = "requestId=leave-1&action=approve";
        mocks.fetchHome.mockResolvedValueOnce({
            workforce: { userId: 1, employeeId: 1, name: "หัวหน้า ทดสอบ" },
            modules: {},
            capabilities: { canApproveLeave: true },
        });
        const detail = {
            id: "leave-1",
            viewerRole: "APPROVER" as const,
            availableActions: ["APPROVE"] as const,
            leaveType: "SICK" as const,
            startDate: "2031-01-01",
            endDate: "2031-01-01",
            overQuotaDays: 0,
            emergencyReason: null,
            specialReason: null,
        } as unknown as LiffLeaveRequestDetailData;
        mocks.fetchRequest
            .mockResolvedValueOnce(detail)
            .mockResolvedValueOnce({ ...detail, availableActions: [] });
        mocks.submitDecision.mockRejectedValueOnce(
            new LiffApiError(
                "เชื่อมต่อกับ LINE ใหม่เรียบร้อยแล้ว",
                401,
                undefined,
                { recovered: true, replayed: false },
            ),
        );

        render(<LiffLeaveApp />);
        expect(await screen.findByTestId("detail-approve")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("detail-approve"));
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันการทดสอบ" }));

        await waitFor(() => {
            expect(mocks.submitDecision).toHaveBeenCalledTimes(1);
            expect(mocks.fetchApprovals).toHaveBeenCalledTimes(2);
            expect(mocks.fetchRequest).toHaveBeenCalledTimes(2);
        });
        expect(screen.getByText(
            "เชื่อมต่อกับ LINE ใหม่เรียบร้อยแล้ว กรุณาตรวจสอบสถานะล่าสุดก่อนลองดำเนินการอีกครั้ง",
        )).toBeInTheDocument();
        expect(screen.queryByTestId("detail-approve")).not.toBeInTheDocument();
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

    it("keeps the newest history response when filters change quickly", async () => {
        type ProfileWithHistory = Omit<typeof PROFILE, "history"> & {
            history: Array<{ id: string }>;
        };
        const oldProfile = deferred<ProfileWithHistory>();
        const newProfile = deferred<ProfileWithHistory>();
        mocks.fetchProfile.mockImplementation((input: { filters?: LeaveHistoryFilters }) => {
            if (input.filters?.query === "old") return oldProfile.promise;
            if (input.filters?.query === "new") return newProfile.promise;
            return Promise.resolve(PROFILE);
        });

        render(<LiffLeaveApp />);
        await screen.findByRole("heading", { name: "Leave" });
        fireEvent.click(screen.getByTestId("history-filter-old"));
        fireEvent.click(screen.getByTestId("history-filter-new"));

        newProfile.resolve({ ...PROFILE, history: [{ id: "new" }] });
        expect(await screen.findByTestId("history-current")).toHaveTextContent("new");
        oldProfile.resolve({ ...PROFILE, history: [{ id: "old" }] });
        await waitFor(() => {
            expect(screen.getByTestId("history-current")).toHaveTextContent("new");
        });
    });

    it("does not let an older Leave detail replace the selected request", async () => {
        type TestDetail = {
            id: string;
            viewerRole: "REQUESTER";
            availableActions: [];
        };
        const detailA = deferred<TestDetail>();
        const detailB = deferred<TestDetail>();
        mocks.fetchRequest.mockImplementation((requestId: string) =>
            requestId === "leave-a" ? detailA.promise : detailB.promise,
        );

        render(<LiffLeaveApp />);
        await screen.findByRole("heading", { name: "Leave" });
        fireEvent.click(screen.getByTestId("history-detail-a"));
        fireEvent.click(screen.getByTestId("history-detail-b"));

        detailB.resolve({ id: "leave-b", viewerRole: "REQUESTER", availableActions: [] });
        expect(await screen.findByText("รายละเอียด leave-b intent none")).toBeInTheDocument();
        detailA.resolve({ id: "leave-a", viewerRole: "REQUESTER", availableActions: [] });
        await waitFor(() => {
            expect(screen.getByText("รายละเอียด leave-b intent none")).toBeInTheDocument();
        });
        expect(screen.queryByText("รายละเอียด leave-a intent none")).not.toBeInTheDocument();
    });

    it("keeps the current approver page when an older page response arrives late", async () => {
        const pageTwo = deferred<ReturnType<typeof approvals>>();
        const pageThree = deferred<ReturnType<typeof approvals>>();
        mocks.fetchHome.mockResolvedValueOnce({
            workforce: { userId: 1, employeeId: 1, name: "หัวหน้า ทดสอบ" },
            modules: {},
            capabilities: { canApproveLeave: true },
        });
        mocks.fetchApprovals.mockResolvedValue(approvals(true));

        render(<LiffLeaveApp />);
        const approvalsTab = await screen.findByRole("tab", { name: /รอพิจารณา/ });
        fireEvent.mouseDown(approvalsTab, { button: 0, ctrlKey: false });
        expect(await screen.findByTestId("approval-current-page")).toHaveTextContent("1");

        mocks.fetchApprovals.mockImplementation((pages: { pendingPage: number }) =>
            pages.pendingPage === 2 ? pageTwo.promise : pageThree.promise,
        );
        fireEvent.click(screen.getByTestId("approval-page-two"));
        fireEvent.click(screen.getByTestId("approval-page-three"));

        pageThree.resolve({
            ...approvals(true),
            metadata: {
                ...approvals(true).metadata,
                pending: { ...approvals(true).metadata.pending, currentPage: 3 },
            },
        });
        expect(await screen.findByTestId("approval-current-page")).toHaveTextContent("3");
        pageTwo.resolve({
            ...approvals(true),
            metadata: {
                ...approvals(true).metadata,
                pending: { ...approvals(true).metadata.pending, currentPage: 2 },
            },
        });
        await waitFor(() => {
            expect(screen.getByTestId("approval-current-page")).toHaveTextContent("3");
        });
    });

    it("clears a deep-link action intent before opening another Leave request", async () => {
        mocks.search = "requestId=leave-a&action=approve";
        mocks.fetchRequest
            .mockResolvedValueOnce({
                id: "leave-a",
                viewerRole: "APPROVER",
                availableActions: ["APPROVE"],
            })
            .mockResolvedValueOnce({
                id: "leave-b",
                viewerRole: "REQUESTER",
                availableActions: [],
            });

        render(<LiffLeaveApp />);
        expect(await screen.findByText("รายละเอียด leave-a intent approve")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("close-detail"));
        fireEvent.mouseDown(screen.getByRole("tab", { name: "วันลาของฉัน" }), {
            button: 0,
            ctrlKey: false,
        });
        fireEvent.click(screen.getByTestId("history-detail-b"));

        expect(await screen.findByText("รายละเอียด leave-b intent none")).toBeInTheDocument();
    });
});
