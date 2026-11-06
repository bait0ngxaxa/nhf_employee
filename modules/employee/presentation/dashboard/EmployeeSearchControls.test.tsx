import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmployeeDataContext, EmployeeUIContext } from "./context/EmployeeContext";
import type {
    EmployeeDataContextValue,
    EmployeeUIContextValue,
} from "./context/types";
import { EmployeeSearchControls } from "./EmployeeSearchControls";
import type { Employee } from "./types";

const employee: Employee = {
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
};

function renderControls(canExportEmployees: boolean, isExporting = false) {
    const onExportClick = vi.fn();
    const dataValue: EmployeeDataContextValue = {
        employees: [employee],
        currentEmployees: [employee],
        employeeStats: { total: 1, active: 1, admin: 0, academic: 0 },
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
        isExporting,
        handleExportXlsx: async () => undefined,
        handleEmployeeUpdate: vi.fn(),
    };

    render(
        <EmployeeDataContext.Provider value={dataValue}>
            <EmployeeUIContext.Provider value={uiValue}>
                <EmployeeSearchControls
                    canExportEmployees={canExportEmployees}
                    onExportClick={onExportClick}
                />
            </EmployeeUIContext.Provider>
        </EmployeeDataContext.Provider>,
    );

    return onExportClick;
}

describe("EmployeeSearchControls presentation", () => {
    it("does not render or initiate export without export capability", () => {
        renderControls(false);

        expect(screen.queryByRole("button", { name: /ดาวน์โหลด Excel/ }))
            .not.toBeInTheDocument();
    });

    it("renders and delegates export only with export capability", () => {
        const onExportClick = renderControls(true);
        const exportButton = screen.getByRole("button", {
            name: /ดาวน์โหลด Excel/,
        });

        fireEvent.click(exportButton);

        expect(exportButton).toHaveTextContent("ดาวน์โหลด Excel (1 คน)");
        expect(onExportClick).toHaveBeenCalledTimes(1);
    });

    it("disables the export button while preparing the download", () => {
        const onExportClick = renderControls(true, true);
        const button = screen.getByRole("button", { name: "กำลังเตรียม…" });
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(onExportClick).not.toHaveBeenCalled();
    });
});
