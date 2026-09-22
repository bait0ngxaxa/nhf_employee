import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManagerApprovalDashboard } from "./ManagerApprovalDashboard";
import { useManagerApprovalModel } from "./hooks/useManagerApprovalModel";
import type { PendingLeave } from "./hooks/useLeaveApprovals";

vi.mock("./hooks/useManagerApprovalModel", () => ({
    useManagerApprovalModel: vi.fn(),
    hasApprovalWarnings: (leave: PendingLeave) => Boolean(
        leave.emergencyReason || leave.specialReason || leave.overQuotaDays > 0,
    ),
}));

vi.mock("./components/PendingApprovalList", () => ({
    PendingApprovalList: ({
        pending,
        onApprove,
        onOpenReject,
    }: {
        pending: PendingLeave[];
        onApprove: (leave: PendingLeave) => Promise<void>;
        onOpenReject: (leave: PendingLeave) => void;
    }) => (
        <div>
            <button
                type="button"
                onClick={() => {
                    const leave = pending[0];
                    if (leave) void onApprove(leave);
                }}
            >
                เปิดยืนยันอนุมัติ
            </button>
            <button
                type="button"
                onClick={() => {
                    const leave = pending[0];
                    if (leave) onOpenReject(leave);
                }}
            >
                เปิดปฏิเสธ
            </button>
        </div>
    ),
}));

vi.mock("./components/RejectLeaveDialog", () => ({
    RejectLeaveDialog: ({ open }: { open: boolean }) => (
        <output data-testid="manager-reject-dialog">{String(open)}</output>
    ),
}));

vi.mock("./components/ApprovalConfirmDialog", () => ({
    ApprovalConfirmDialog: ({ leave }: { leave: PendingLeave | null }) => (
        <output data-testid="manager-approval-dialog">{String(leave !== null)}</output>
    ),
}));

function createMetadata() {
    return {
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: 10,
        availableYears: [2026],
    };
}

const pendingLeave: PendingLeave = {
    id: "leave-1",
    employeeId: 1,
    leaveType: "SICK",
    startDate: "2030-01-01",
    endDate: "2030-01-01",
    period: "FULL_DAY",
    durationDays: 1,
    reason: "test",
    emergencyReason: null,
    specialReason: "ต้องพิจารณาเป็นกรณีพิเศษ",
    overQuotaDays: 1,
    status: "PENDING",
    cancellationReason: null,
    cancellationRequestedAt: null,
    cancellationConfirmedAt: null,
    cancellationConfirmedById: null,
    notTakenReason: null,
    notTakenRequestedAt: null,
    notTakenConfirmedAt: null,
    createdAt: "2030-01-01",
    attachments: [],
    employee: {
        firstName: "A",
        lastName: "B",
        nickname: null,
        position: "Dev",
        departmentId: 1,
        dept: { name: "IT" },
    },
};

function createModel(overrides: Record<string, unknown> = {}) {
    return {
        canReadAssignedApprovals: true,
        canApproveAssignedRequests: true,
        canConfirmAssignedNotTaken: true,
        canDecideAssignedCancellations: true,
        hasApprovalRelationship: true,
        canShowApprovalSurface: true,
        pending: [],
        notTakenPending: [],
        history: [],
        cancellationPending: [],
        metadata: {
            pending: createMetadata(),
            notTakenPending: createMetadata(),
            history: createMetadata(),
            cancellationPending: createMetadata(),
        },
        isLoading: false,
        isProcessing: false,
        setPendingPage: vi.fn(),
        setNotTakenPage: vi.fn(),
        setHistoryPage: vi.fn(),
        setCancellationPage: vi.fn(),
        historyQuery: "",
        historyLeaveType: "",
        historyStatus: "",
        historyYear: "",
        historyFilters: {},
        hasHistoryFilters: false,
        setHistoryQuery: vi.fn(),
        setHistoryLeaveType: vi.fn(),
        setHistoryStatus: vi.fn(),
        setHistoryYear: vi.fn(),
        resetHistoryFilters: vi.fn(),
        approveLeave: vi.fn(async () => true),
        confirmNotTaken: vi.fn(),
        confirmCancellation: vi.fn(),
        rejectCancellation: vi.fn(),
        rejectLeave: vi.fn(async () => true),
        ...overrides,
    } as ReturnType<typeof useManagerApprovalModel>;
}

describe("ManagerApprovalDashboard history filters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useManagerApprovalModel).mockReturnValue(createModel());
    });

    it("renders filters only in the decision history section", () => {
        render(<ManagerApprovalDashboard />);

        expect(screen.getByRole("group", { name: "ตัวกรองประวัติการลา" })).toBeInTheDocument();
        expect(screen.getAllByRole("combobox")).toHaveLength(3);
        expect(screen.getByRole("searchbox", { name: "ค้นหาชื่อพนักงานในประวัติการพิจารณา" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "รายการรอพิจารณา" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "ประวัติการพิจารณา" })).toBeInTheDocument();
    });

    it("destroys the reject workflow when approval capability is revoked", () => {
        const { rerender } = render(<ManagerApprovalDashboard />);

        vi.mocked(useManagerApprovalModel).mockReturnValue(
            createModel({ pending: [pendingLeave] }),
        );
        rerender(<ManagerApprovalDashboard />);
        fireEvent.click(screen.getByRole("button", { name: "เปิดปฏิเสธ" }));
        expect(screen.getByTestId("manager-reject-dialog")).toHaveTextContent("true");

        vi.mocked(useManagerApprovalModel).mockReturnValue(
            createModel({
                canApproveAssignedRequests: false,
                pending: [pendingLeave],
            }),
        );
        rerender(<ManagerApprovalDashboard />);
        expect(screen.queryByTestId("manager-reject-dialog")).not.toBeInTheDocument();

        vi.mocked(useManagerApprovalModel).mockReturnValue(
            createModel({ pending: [pendingLeave] }),
        );
        rerender(<ManagerApprovalDashboard />);
        expect(screen.getByTestId("manager-reject-dialog")).toHaveTextContent("false");
    });

    it("destroys the approval warning workflow when approval capability is revoked", () => {
        const { rerender } = render(<ManagerApprovalDashboard />);

        vi.mocked(useManagerApprovalModel).mockReturnValue(
            createModel({ pending: [pendingLeave] }),
        );
        rerender(<ManagerApprovalDashboard />);
        fireEvent.click(screen.getByRole("button", { name: "เปิดยืนยันอนุมัติ" }));
        expect(screen.getByTestId("manager-approval-dialog")).toHaveTextContent("true");

        vi.mocked(useManagerApprovalModel).mockReturnValue(
            createModel({
                canApproveAssignedRequests: false,
                pending: [pendingLeave],
            }),
        );
        rerender(<ManagerApprovalDashboard />);
        expect(screen.queryByTestId("manager-approval-dialog")).not.toBeInTheDocument();

        vi.mocked(useManagerApprovalModel).mockReturnValue(
            createModel({ pending: [pendingLeave] }),
        );
        rerender(<ManagerApprovalDashboard />);
        expect(screen.getByTestId("manager-approval-dialog")).toHaveTextContent("false");
    });
});
