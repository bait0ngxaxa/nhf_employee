import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmployeeLeaveDashboardModel } from "./hooks/useEmployeeLeaveDashboardModel";
import { useEmployeeLeaveDashboardModel } from "./hooks/useEmployeeLeaveDashboardModel";
import type { LeaveRequest } from "./hooks/useLeaveProfile";

vi.mock("./hooks/useEmployeeLeaveDashboardModel", () => ({
    useEmployeeLeaveDashboardModel: vi.fn(),
}));

vi.mock("./LeaveRequestForm", () => ({
    LeaveRequestForm: ({ open }: { open: boolean }) => (
        <output data-testid="leave-request-form">{String(open)}</output>
    ),
}));

vi.mock("./components/LeaveQuotaCards", () => ({
    LeaveQuotaCards: () => <div data-testid="leave-quotas" />,
}));

vi.mock("./components/LeaveHistoryFilters", () => ({
    LeaveHistoryFilters: () => <div data-testid="leave-history-filters" />,
}));

vi.mock("./components/EmployeeLeaveHistoryList", () => ({
    EmployeeLeaveHistoryList: ({
        history,
        onCancelRequest,
        onNotTakenRequest,
    }: {
        history: LeaveRequest[];
        onCancelRequest: (request: LeaveRequest) => void;
        onNotTakenRequest: (leaveId: string) => void;
    }) => (
        <div>
            <button
                type="button"
                onClick={() => {
                    const request = history[0];
                    if (request) onCancelRequest(request);
                }}
            >
                เปิดยกเลิกคำขอลา
            </button>
            <button
                type="button"
                onClick={() => {
                    const request = history[1];
                    if (request) onNotTakenRequest(request.id);
                }}
            >
                เปิดไม่ได้ใช้วันลา
            </button>
        </div>
    ),
}));

vi.mock("./components/CancelLeaveDialog", () => ({
    CancelLeaveDialog: ({ open }: { open: boolean }) => (
        <output data-testid="cancel-dialog">{String(open)}</output>
    ),
}));

vi.mock("./components/NotTakenRequestDialog", () => ({
    NotTakenRequestDialog: ({ open }: { open: boolean }) => (
        <output data-testid="not-taken-dialog">{String(open)}</output>
    ),
}));

import { EmployeeLeaveDashboard } from "./EmployeeLeaveDashboard";

const requestHistory: LeaveRequest[] = [
    {
        id: "pending-leave",
        employeeId: 10,
        leaveType: "SICK",
        startDate: "2030-01-01T00:00:00.000Z",
        endDate: "2030-01-01T00:00:00.000Z",
        period: "FULL_DAY",
        durationDays: 1,
        reason: "ลาป่วย",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
        status: "PENDING",
        approverId: 20,
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
        attachments: [],
        createdAt: "2029-12-01T00:00:00.000Z",
        updatedAt: "2029-12-01T00:00:00.000Z",
    },
    {
        id: "approved-leave",
        employeeId: 10,
        leaveType: "VACATION",
        startDate: "2020-01-01T00:00:00.000Z",
        endDate: "2020-01-03T00:00:00.000Z",
        period: "FULL_DAY",
        durationDays: 3,
        reason: "พักผ่อน",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
        status: "APPROVED",
        approverId: 20,
        approvedAt: "2029-12-02T00:00:00.000Z",
        rejectReason: null,
        notTakenReason: null,
        notTakenRequestedAt: null,
        notTakenConfirmedAt: null,
        notTakenConfirmedById: null,
        cancellationReason: null,
        cancellationRequestedAt: null,
        cancellationConfirmedAt: null,
        cancellationConfirmedById: null,
        attachments: [],
        createdAt: "2029-12-01T00:00:00.000Z",
        updatedAt: "2029-12-01T00:00:00.000Z",
    },
];

const baseModel: EmployeeLeaveDashboardModel = {
    canReadOwnRequests: true,
    canCreateOwnRequests: false,
    canCancelOwnRequests: false,
    canRequestOwnNotTaken: false,
    isLoading: false,
    quotas: [],
    history: requestHistory,
    metadata: undefined,
    page: 1,
    isSubmitting: false,
    historyQuery: "",
    historyLeaveType: "",
    historyStatus: "",
    historyYear: "",
    historyFilters: {},
    hasHistoryFilters: false,
    sickQuota: {
        totalDays: 0,
        carryBalanceDays: 0,
        effectiveTotalDays: 0,
        usedDays: 0,
        remainingDays: 0,
    },
    personalQuota: {
        totalDays: 0,
        carryBalanceDays: 0,
        effectiveTotalDays: 0,
        usedDays: 0,
        remainingDays: 0,
    },
    vacationQuota: {
        totalDays: 0,
        carryBalanceDays: 0,
        effectiveTotalDays: 0,
        usedDays: 0,
        remainingDays: 0,
    },
    setPage: vi.fn(),
    setHistoryQuery: vi.fn(),
    setHistoryLeaveType: vi.fn(),
    setHistoryStatus: vi.fn(),
    setHistoryYear: vi.fn(),
    resetHistoryFilters: vi.fn(),
    onRequestSuccess: vi.fn(async () => undefined),
    confirmCancelLeave: vi.fn(async () => undefined),
    confirmNotTakenRequest: vi.fn(async () => undefined),
};

function modelWith(overrides: Partial<EmployeeLeaveDashboardModel>): EmployeeLeaveDashboardModel {
    return { ...baseModel, ...overrides };
}

describe("EmployeeLeaveDashboard capability-owned workflows", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(modelWith({}));
    });

    it("destroys and recreates the request form session across capability loss", () => {
        const { rerender } = render(<EmployeeLeaveDashboard />);

        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(
            modelWith({ canCreateOwnRequests: true }),
        );
        rerender(<EmployeeLeaveDashboard />);
        fireEvent.click(screen.getByRole("button", { name: "ยื่นคำขอลา" }));
        expect(screen.getByTestId("leave-request-form")).toHaveTextContent("true");

        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(modelWith({}));
        rerender(<EmployeeLeaveDashboard />);
        expect(screen.queryByTestId("leave-request-form")).not.toBeInTheDocument();

        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(
            modelWith({ canCreateOwnRequests: true }),
        );
        rerender(<EmployeeLeaveDashboard />);
        expect(screen.getByTestId("leave-request-form")).toHaveTextContent("false");
    });

    it("destroys the cancel session without affecting the not-taken capability", () => {
        const { rerender } = render(<EmployeeLeaveDashboard />);

        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(
            modelWith({ canCancelOwnRequests: true }),
        );
        rerender(<EmployeeLeaveDashboard />);
        fireEvent.click(screen.getByRole("button", { name: "เปิดยกเลิกคำขอลา" }));
        expect(screen.getByTestId("cancel-dialog")).toHaveTextContent("true");

        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(modelWith({}));
        rerender(<EmployeeLeaveDashboard />);
        expect(screen.getByTestId("cancel-dialog")).toHaveTextContent("false");

        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(
            modelWith({ canCancelOwnRequests: true }),
        );
        rerender(<EmployeeLeaveDashboard />);
        expect(screen.getByTestId("cancel-dialog")).toHaveTextContent("false");
    });

    it("destroys the not-taken session without affecting the cancel capability", () => {
        const { rerender } = render(<EmployeeLeaveDashboard />);

        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(
            modelWith({ canRequestOwnNotTaken: true }),
        );
        rerender(<EmployeeLeaveDashboard />);
        fireEvent.click(screen.getByRole("button", { name: "เปิดไม่ได้ใช้วันลา" }));
        expect(screen.getByTestId("not-taken-dialog")).toHaveTextContent("true");

        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(modelWith({}));
        rerender(<EmployeeLeaveDashboard />);
        expect(screen.getByTestId("not-taken-dialog")).toHaveTextContent("false");

        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(
            modelWith({ canRequestOwnNotTaken: true }),
        );
        rerender(<EmployeeLeaveDashboard />);
        expect(screen.getByTestId("not-taken-dialog")).toHaveTextContent("false");
    });

    it("keeps each leave action session alive when the other capability changes", () => {
        const { rerender } = render(<EmployeeLeaveDashboard />);

        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(
            modelWith({
                canCancelOwnRequests: true,
                canRequestOwnNotTaken: true,
            }),
        );
        rerender(<EmployeeLeaveDashboard />);
        fireEvent.click(screen.getByRole("button", { name: "เปิดยกเลิกคำขอลา" }));
        fireEvent.click(screen.getByRole("button", { name: "เปิดไม่ได้ใช้วันลา" }));
        expect(screen.getByTestId("cancel-dialog")).toHaveTextContent("true");
        expect(screen.getByTestId("not-taken-dialog")).toHaveTextContent("true");

        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(
            modelWith({ canRequestOwnNotTaken: true }),
        );
        rerender(<EmployeeLeaveDashboard />);
        expect(screen.getByTestId("cancel-dialog")).toHaveTextContent("false");
        expect(screen.getByTestId("not-taken-dialog")).toHaveTextContent("true");

        vi.mocked(useEmployeeLeaveDashboardModel).mockReturnValue(
            modelWith({ canCancelOwnRequests: true }),
        );
        rerender(<EmployeeLeaveDashboard />);
        expect(screen.getByTestId("cancel-dialog")).toHaveTextContent("false");
        expect(screen.getByTestId("not-taken-dialog")).toHaveTextContent("false");
    });
});
