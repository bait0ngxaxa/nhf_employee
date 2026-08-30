import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManagerApprovalDashboard } from "@/components/dashboard/leave/ManagerApprovalDashboard";
import { useManagerApprovalModel } from "@/hooks/leave/useManagerApprovalModel";

vi.mock("@/hooks/leave/useManagerApprovalModel", () => ({
    useManagerApprovalModel: vi.fn(),
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

function createModel(overrides: Record<string, unknown> = {}) {
    return {
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
        selectedLeave: null,
        approvalConfirmLeave: null,
        isRejectDialogOpen: false,
        rejectReason: "",
        isProcessing: false,
        setRejectReason: vi.fn(),
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
        openRejectDialog: vi.fn(),
        closeRejectDialog: vi.fn(),
        approveLeave: vi.fn(),
        closeApprovalConfirmDialog: vi.fn(),
        confirmApproveLeave: vi.fn(),
        confirmNotTaken: vi.fn(),
        confirmCancellation: vi.fn(),
        rejectCancellation: vi.fn(),
        rejectLeave: vi.fn(),
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
});
