import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmployeeDataContext, EmployeeUIContext } from "./context/EmployeeContext";
import type { EmployeeDataContextValue, EmployeeUIContextValue } from "./context/types";
import type { Employee } from "./types";
import { EmployeeList } from "./EmployeeList";

vi.mock("./EmployeeModals", () => ({
    EmployeeModals: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent aria-describedby={undefined}><DialogTitle>แก้ไขพนักงาน</DialogTitle></DialogContent>
        </Dialog>
    ),
}));

const employee: Employee = {
    id: 1,
    firstName: "นางสาวสมใจ",
    lastName: "นามสกุลยาวเพื่อทดสอบการแสดงผล",
    nickname: "สมใจ",
    phone: "0812345678",
    email: "somjai.long.employee.address@nhf.or.th",
    position: "เจ้าหน้าที่บริหารงานทั่วไป",
    affiliation: "มูลนิธิสาธารณสุขแห่งชาติ",
    hireDate: "2020-01-01",
    status: "ACTIVE",
    dept: { id: 1, name: "บริหาร", code: "ADMIN" },
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
};

const capabilities = {
    canReadEmployees: true, canReadStats: false, canCreateEmployees: false,
    canUpdateEmployees: true, canDeleteEmployees: false, canImportEmployees: false, canExportEmployees: true,
};

const data: EmployeeDataContextValue = {
    employees: [employee], currentEmployees: [employee],
    employeeStats: { total: 1, active: 1, admin: 1, academic: 0 },
    totalEmployees: 1, totalPages: 2, isLoading: false, error: "",
    fetchEmployees: async () => undefined, refreshTrigger: 0, triggerRefresh: async () => undefined,
};
const ui: EmployeeUIContextValue = {
    searchTerm: "", debouncedSearchTerm: "", setSearchTerm: vi.fn(),
    statusFilter: "all", setStatusFilter: vi.fn(), currentPage: 1, itemsPerPage: 20,
    handlePageChange: vi.fn(), handlePreviousPage: vi.fn(), handleNextPage: vi.fn(),
    isExporting: false, handleExportCSV: vi.fn(async () => undefined), handleEmployeeUpdate: vi.fn(),
};
function directory(overrides: Partial<EmployeeUIContextValue> = {}, canReadEmployees = true, canUpdateEmployees = true) {
    return (
        <EmployeeDataContext.Provider value={data}>
            <EmployeeUIContext.Provider value={{ ...ui, ...overrides }}>
                <EmployeeList employeeCapabilities={{ ...capabilities, canReadEmployees, canUpdateEmployees }} />
            </EmployeeUIContext.Provider>
        </EmployeeDataContext.Provider>
    );
}
function openDetails(): void {
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /ดูรายละเอียด/ }));
}

describe("EmployeeList details session", () => {
    it.each([
        { currentPage: 2 }, { debouncedSearchTerm: "สมใจ" }, { statusFilter: "ACTIVE" }, { itemsPerPage: 50 },
    ] satisfies Partial<EmployeeUIContextValue>[])("closes on view change %j even when the same employee remains", (change) => {
        const { rerender } = render(directory());
        openDetails();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        rerender(directory(change));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        rerender(directory());
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        openDetails();
        expect(screen.getByRole("dialog")).toHaveAccessibleName(`${employee.firstName} ${employee.lastName}`);
    });

    it("keeps details and the existing edit form mutually exclusive", async () => {
        render(directory());
        openDetails();
        expect(screen.getAllByRole("dialog")).toHaveLength(1);
        expect(within(screen.getByRole("dialog")).queryByRole("button", { name: /แก้ไข/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ปิดรายละเอียด" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /แก้ไขข้อมูล/ }));
        expect(screen.getAllByRole("dialog")).toHaveLength(1);
        expect(screen.getByRole("dialog", { name: "แก้ไขพนักงาน" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ปิดรายละเอียด" })).not.toBeInTheDocument();
    });

    it("allows read-only details and tears down the dialog when read permission is revoked", () => {
        const { rerender } = render(directory({}, true, false));
        expect(screen.queryByRole("button", { name: /แก้ไข/ })).not.toBeInTheDocument();
        openDetails();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        rerender(directory({}, false, false));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
});
