import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
    EmployeeDataContextValue,
    EmployeeUIContextValue,
} from "./context/types";
import { EmployeeDataContext, EmployeeUIContext } from "./context/EmployeeContext";
import type { Employee } from "./types";

const mocks = vi.hoisted(() => ({
    employee: {
        id: 1,
        firstName: "สมใจ",
        lastName: "ใจดี",
        nickname: null,
        phone: null,
        email: "somjai@example.com",
        position: "เจ้าหน้าที่",
        affiliation: null,
        hireDate: "2020-01-01",
        status: "ACTIVE",
        dept: { id: 1, name: "บริหาร", code: "ADMIN" },
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
    } as Employee,
    handleEmployeeUpdate: vi.fn(),
}));

vi.mock("./EmployeeTable", () => ({
    EmployeeTable: ({
        canUpdateEmployees,
        onEditEmployee,
    }: {
        canUpdateEmployees: boolean;
        onEditEmployee?: (employee: Employee) => void;
    }) => (
        <button
            type="button"
            disabled={!canUpdateEmployees}
            onClick={() => onEditEmployee?.(mocks.employee)}
        >
            แก้ไขพนักงาน
        </button>
    ),
}));

vi.mock("./EmployeeModals", () => ({
    EmployeeModals: ({ isOpen }: { isOpen: boolean }) => (
        <output data-testid="employee-edit-open">{String(isOpen)}</output>
    ),
}));

import { EmployeeList } from "./EmployeeList";

const baseCapabilities = {
    canReadEmployees: true,
    canReadStats: false,
    canCreateEmployees: false,
    canUpdateEmployees: false,
    canDeleteEmployees: false,
    canImportEmployees: false,
    canExportEmployees: false,
} as const;

function renderEmployeeList(canUpdateEmployees: boolean) {
    const dataValue: EmployeeDataContextValue = {
        employees: [mocks.employee],
        currentEmployees: [mocks.employee],
        employeeStats: { total: 0, active: 0, admin: 0, academic: 0 },
        totalEmployees: 1,
        totalPages: 1,
        isLoading: false,
        error: "",
        fetchEmployees: async () => undefined,
        refreshTrigger: 0,
        triggerRefresh: async () => undefined,
    };
    const uiValue: EmployeeUIContextValue = {
        searchTerm: "",
        debouncedSearchTerm: "",
        setSearchTerm: vi.fn(),
        statusFilter: "all",
        setStatusFilter: vi.fn(),
        currentPage: 1,
        itemsPerPage: 20,
        handlePageChange: vi.fn(),
        handlePreviousPage: vi.fn(),
        handleNextPage: vi.fn(),
        isExporting: false,
        handleExportCSV: async () => undefined,
        handleEmployeeUpdate: mocks.handleEmployeeUpdate,
    };

    return render(
        <EmployeeDataContext.Provider value={dataValue}>
            <EmployeeUIContext.Provider value={uiValue}>
                <EmployeeList
                    employeeCapabilities={{
                        ...baseCapabilities,
                        canUpdateEmployees,
                    }}
                />
            </EmployeeUIContext.Provider>
        </EmployeeDataContext.Provider>,
    );
}

describe("EmployeeList capability-owned edit session", () => {
    it("destroys the edit session on revoke and does not reopen it on re-grant", () => {
        const { rerender } = renderEmployeeList(true);

        fireEvent.click(screen.getByRole("button", { name: "แก้ไขพนักงาน" }));
        expect(screen.getByTestId("employee-edit-open")).toHaveTextContent("true");

        rerender(
            <EmployeeDataContext.Provider
                value={{
                    employees: [mocks.employee],
                    currentEmployees: [mocks.employee],
                    employeeStats: { total: 0, active: 0, admin: 0, academic: 0 },
                    totalEmployees: 1,
                    totalPages: 1,
                    isLoading: false,
                    error: "",
                    fetchEmployees: async () => undefined,
                    refreshTrigger: 0,
                    triggerRefresh: async () => undefined,
                }}
            >
                <EmployeeUIContext.Provider
                    value={{
                        searchTerm: "",
                        debouncedSearchTerm: "",
                        setSearchTerm: vi.fn(),
                        statusFilter: "all",
                        setStatusFilter: vi.fn(),
                        currentPage: 1,
                        itemsPerPage: 20,
                        handlePageChange: vi.fn(),
                        handlePreviousPage: vi.fn(),
                        handleNextPage: vi.fn(),
                        isExporting: false,
                        handleExportCSV: async () => undefined,
                        handleEmployeeUpdate: mocks.handleEmployeeUpdate,
                    }}
                >
                    <EmployeeList
                        employeeCapabilities={{
                            ...baseCapabilities,
                            canUpdateEmployees: false,
                        }}
                    />
                </EmployeeUIContext.Provider>
            </EmployeeDataContext.Provider>,
        );

        expect(screen.queryByTestId("employee-edit-open")).not.toBeInTheDocument();

        rerender(
            <EmployeeDataContext.Provider
                value={{
                    employees: [mocks.employee],
                    currentEmployees: [mocks.employee],
                    employeeStats: { total: 0, active: 0, admin: 0, academic: 0 },
                    totalEmployees: 1,
                    totalPages: 1,
                    isLoading: false,
                    error: "",
                    fetchEmployees: async () => undefined,
                    refreshTrigger: 0,
                    triggerRefresh: async () => undefined,
                }}
            >
                <EmployeeUIContext.Provider
                    value={{
                        searchTerm: "",
                        debouncedSearchTerm: "",
                        setSearchTerm: vi.fn(),
                        statusFilter: "all",
                        setStatusFilter: vi.fn(),
                        currentPage: 1,
                        itemsPerPage: 20,
                        handlePageChange: vi.fn(),
                        handlePreviousPage: vi.fn(),
                        handleNextPage: vi.fn(),
                        isExporting: false,
                        handleExportCSV: async () => undefined,
                        handleEmployeeUpdate: mocks.handleEmployeeUpdate,
                    }}
                >
                    <EmployeeList
                        employeeCapabilities={{
                            ...baseCapabilities,
                            canUpdateEmployees: true,
                        }}
                    />
                </EmployeeUIContext.Provider>
            </EmployeeDataContext.Provider>,
        );

        expect(screen.getByTestId("employee-edit-open")).toHaveTextContent("false");
        fireEvent.click(screen.getByRole("button", { name: "แก้ไขพนักงาน" }));
        expect(screen.getByTestId("employee-edit-open")).toHaveTextContent("true");
    });
});
