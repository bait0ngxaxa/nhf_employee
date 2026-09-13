import { render, screen, fireEvent } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmployeePresentationCapabilities } from "../../application/types";

const mocks = vi.hoisted(() => ({
    handleMenuClick: vi.fn(),
    user: undefined as {
        id: string;
        role: string;
        employeeCapabilities?: EmployeePresentationCapabilities;
    } | undefined,
}));

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardUIContext: () => ({
        handleMenuClick: mocks.handleMenuClick,
    }),
    useDashboardDataContext: () => ({
        user: mocks.user,
    }),
}));

vi.mock("./context/EmployeeProvider", () => ({
    EmployeeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("./context/EmployeeContext", () => ({
    useEmployeeDataContext: () => ({
        employeeStats: {
            total: 12,
            active: 10,
            admin: 2,
            academic: 8,
        },
        refreshTrigger: 0,
    }),
}));

vi.mock("./EmployeeList", () => ({
    EmployeeList: ({
        employeeCapabilities,
    }: {
        employeeCapabilities?: EmployeePresentationCapabilities;
    }) => (
        <div data-testid="employee-list">
            รายชื่อพนักงาน
            <output data-testid="list-capabilities">
                {String(employeeCapabilities?.canReadEmployees === true)}
            </output>
        </div>
    ),
}));

vi.mock("./EmployeeStatsCards", () => ({
    EmployeeStatsCards: () => <div data-testid="employee-stats">สถิติ</div>,
}));

import { EmployeeManagementSection } from "./EmployeeManagementSection";

const noEmployeeCapabilities: EmployeePresentationCapabilities = {
    canReadEmployees: false,
    canReadStats: false,
    canCreateEmployees: false,
    canUpdateEmployees: false,
    canDeleteEmployees: false,
    canImportEmployees: false,
    canExportEmployees: false,
};

const readEmployeeCapabilities: EmployeePresentationCapabilities = {
    ...noEmployeeCapabilities,
    canReadEmployees: true,
};

const statsEmployeeCapabilities: EmployeePresentationCapabilities = {
    ...noEmployeeCapabilities,
    canReadStats: true,
};

const allEmployeeCapabilities: EmployeePresentationCapabilities = {
    canReadEmployees: true,
    canReadStats: true,
    canCreateEmployees: true,
    canUpdateEmployees: true,
    canDeleteEmployees: true,
    canImportEmployees: true,
    canExportEmployees: true,
};

describe("EmployeeManagementSection presentation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user = {
            id: "41",
            role: "ADMIN",
        };
    });

    it("does not expose Employee surfaces from ADMIN role alone", () => {
        render(<EmployeeManagementSection />);

        expect(screen.getByRole("heading", { name: "ข้อมูลพนักงาน" })).toBeInTheDocument();
        expect(screen.queryByTestId("employee-stats")).not.toBeInTheDocument();
        expect(screen.queryByTestId("employee-list")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "เพิ่มพนักงาน" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "นำเข้า CSV" })).not.toBeInTheDocument();
    });

    it("keeps ADMIN compatibility controls while projecting delete without adding delete UI", () => {
        mocks.user = {
            id: "41",
            role: "ADMIN",
            employeeCapabilities: allEmployeeCapabilities,
        };

        render(<EmployeeManagementSection />);

        expect(screen.getByRole("heading", { name: "จัดการพนักงาน" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "เพิ่มพนักงาน" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "นำเข้า CSV" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /ลบ/ })).not.toBeInTheDocument();
    });

    it("renders only the Employee list surface when list read is granted", () => {
        mocks.user = {
            id: "41",
            role: "USER",
            employeeCapabilities: readEmployeeCapabilities,
        };

        render(<EmployeeManagementSection />);

        expect(screen.getByTestId("employee-list")).toBeInTheDocument();
        expect(screen.queryByTestId("employee-stats")).not.toBeInTheDocument();
    });

    it("renders only statistics when stats read is granted", () => {
        mocks.user = {
            id: "41",
            role: "USER",
            employeeCapabilities: statsEmployeeCapabilities,
        };

        render(<EmployeeManagementSection />);

        expect(screen.getByTestId("employee-stats")).toBeInTheDocument();
        expect(screen.queryByTestId("employee-list")).not.toBeInTheDocument();
    });

    it("gates Add Employee and CSV import actions independently", () => {
        mocks.user = {
            id: "41",
            role: "USER",
            employeeCapabilities: {
                ...noEmployeeCapabilities,
                canCreateEmployees: true,
            },
        };

        const { rerender } = render(<EmployeeManagementSection />);

        expect(screen.getByRole("heading", { name: "จัดการพนักงาน" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "เพิ่มพนักงาน" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "นำเข้า CSV" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มพนักงาน" }));
        expect(mocks.handleMenuClick).toHaveBeenCalledWith("add-employee");

        mocks.handleMenuClick.mockReset();
        mocks.user = {
            id: "41",
            role: "USER",
            employeeCapabilities: {
                ...noEmployeeCapabilities,
                canImportEmployees: true,
            },
        };
        rerender(<EmployeeManagementSection />);

        expect(screen.getByRole("button", { name: "นำเข้า CSV" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "เพิ่มพนักงาน" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "นำเข้า CSV" }));
        expect(mocks.handleMenuClick).toHaveBeenCalledWith("import-employee");
    });
});
