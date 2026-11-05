import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiPatch } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { EmployeeDataContext, EmployeeUIContext } from "./context/EmployeeContext";
import type { EmployeeDataContextValue, EmployeeUIContextValue } from "./context/types";
import type { Employee } from "./types";
import { EmployeeList } from "./EmployeeList";

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardDataContext: () => ({
        user: { departmentCapabilities: { canReadDepartments: false } },
    }),
}));
vi.mock("@/lib/client/api-client", () => ({ apiPatch: vi.fn() }));

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
function directory(overrides: Partial<EmployeeUIContextValue> = {}, canReadEmployees = true, canUpdateEmployees = true, dataOverrides: Partial<EmployeeDataContextValue> = {}) {
    return (
        <EmployeeDataContext.Provider value={{ ...data, ...dataOverrides }}>
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
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiPatch).mockResolvedValue({ success: true, data: {}, status: 200, requestId: "test" });
    });

    it.each([
        { currentPage: 2 }, { debouncedSearchTerm: "สมใจ" }, { statusFilter: "ACTIVE" }, { itemsPerPage: 50 },
    ] satisfies Partial<EmployeeUIContextValue>[])("preserves unsaved real edit form values on view change %j", (change) => {
        const { rerender } = render(directory({ searchTerm: "สมใจ" }));
        fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /แก้ไขข้อมูล/ }));
        const firstName = screen.getByRole("textbox", { name: /^ชื่อ$/ });
        fireEvent.change(firstName, { target: { value: "ข้อมูลที่ยังไม่บันทึก" } });
        rerender(directory({ searchTerm: "สมใจ", ...change }));
        expect(screen.getByRole("dialog", { name: "แก้ไขข้อมูลพนักงาน" })).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: /^ชื่อ$/ })).toBe(firstName);
        expect(firstName).toHaveValue("ข้อมูลที่ยังไม่บันทึก");
        expect(apiPatch).not.toHaveBeenCalled();
    });

    it("preserves the edit draft when a search returns no employees", () => {
        const { rerender } = render(directory());
        fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /แก้ไขข้อมูล/ }));
        fireEvent.change(screen.getByRole("textbox", { name: /^ชื่อ$/ }), { target: { value: "ข้อมูลที่ยังไม่บันทึก" } });
        rerender(directory({ debouncedSearchTerm: "ไม่มีผลลัพธ์" }, true, true, {
            employees: [], currentEmployees: [], totalEmployees: 0, totalPages: 0,
        }));
        expect(screen.getByRole("dialog", { name: "แก้ไขข้อมูลพนักงาน" })).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: /^ชื่อ$/ })).toHaveValue("ข้อมูลที่ยังไม่บันทึก");
        rerender(directory({}, true, true, {
            employees: [], currentEmployees: [], totalEmployees: 0, totalPages: 0, isLoading: true,
        }));
        expect(screen.getByRole("textbox", { name: /^ชื่อ$/ })).toHaveValue("ข้อมูลที่ยังไม่บันทึก");
        rerender(directory());
        expect(screen.getByRole("textbox", { name: /^ชื่อ$/ })).toHaveValue("ข้อมูลที่ยังไม่บันทึก");
    });

    it("saves the retained draft for the original employee after the visible page changes", async () => {
        const { rerender } = render(directory());
        fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /แก้ไขข้อมูล/ }));
        fireEvent.change(screen.getByRole("textbox", { name: /^ชื่อ$/ }), { target: { value: "ชื่อที่แก้ไข" } });
        const other = { ...employee, id: 2, firstName: "อีกคน" };
        rerender(directory({ currentPage: 2 }, true, true, { employees: [other], currentEmployees: [other] }));
        fireEvent.click(screen.getByRole("button", { name: "บันทึกการแก้ไข" }));
        await waitFor(() => expect(apiPatch).toHaveBeenCalledWith(
            API_ROUTES.employees.byId(employee.id), expect.objectContaining({ firstName: "ชื่อที่แก้ไข" }),
        ));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(ui.handleEmployeeUpdate).toHaveBeenCalledWith(employee);
    });

    it.each(["cancel", "revoke"])("discards the draft only on %s and does not revive it when reopened", async (reason) => {
        const { rerender } = render(directory());
        fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /แก้ไขข้อมูล/ }));
        fireEvent.change(screen.getByRole("textbox", { name: /^ชื่อ$/ }), { target: { value: "ข้อมูลที่ยังไม่บันทึก" } });
        if (reason === "cancel") fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
        else rerender(directory({}, true, false));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        rerender(directory());
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /แก้ไขข้อมูล/ }));
        expect(screen.getByRole("textbox", { name: /^ชื่อ$/ })).toHaveValue(employee.firstName);
        expect(apiPatch).not.toHaveBeenCalled();
    });

    it.each([true, false].flatMap((canUpdateEmployees) => [
        { canUpdateEmployees, view: { debouncedSearchTerm: "สมใจ" }, results: {} },
        { canUpdateEmployees, view: { currentPage: 2 }, results: {} },
        {
            canUpdateEmployees, view: { debouncedSearchTerm: "ไม่มีผลลัพธ์" },
            results: { employees: [], currentEmployees: [], totalEmployees: 0, totalPages: 0 },
        },
    ]))("returns focus to the directory when the details trigger disappears: %j", async ({ canUpdateEmployees, view, results }) => {
        const { rerender } = render(directory({}, true, canUpdateEmployees));
        openDetails();
        rerender(directory(view, true, canUpdateEmployees, results));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        await waitFor(() => expect(screen.getByRole("region", { name: "รายชื่อพนักงาน" })).toHaveFocus());
    });

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
        expect(screen.getByRole("dialog", { name: "แก้ไขข้อมูลพนักงาน" })).toBeInTheDocument();
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
