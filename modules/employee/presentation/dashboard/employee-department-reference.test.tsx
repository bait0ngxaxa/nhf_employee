import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import { API_ROUTES } from "@/lib/ssot/routes";
import { EmployeeFormFields } from "./shared/EmployeeFormFields";
import { useAddEmployee } from "./add-employee/useAddEmployee";
import { useEditEmployee } from "./edit-employee/useEditEmployee";
import type { Employee, EmployeeFormData } from "./types";

const mocks = vi.hoisted(() => ({
    useSWR: vi.fn(),
}));

vi.mock("swr", () => ({ default: mocks.useSWR }));
vi.mock("@/lib/client/api-client", () => ({
    apiPatch: vi.fn(),
    apiPost: vi.fn(),
}));
vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

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

function AddHookProbe({ canReadDepartments }: { canReadDepartments: boolean }): ReactElement {
    const result = useAddEmployee({
        canReadDepartments,
    });

    return (
        <>
            <output data-testid="add-department-access">
                {String(result.canReadDepartments)}
            </output>
            <output data-testid="add-department-count">
                {result.departments.length}
            </output>
        </>
    );
}

function EditHookProbe({ canReadDepartments }: { canReadDepartments: boolean }): ReactElement {
    const result = useEditEmployee({
        employee,
        isOpen: true,
        canReadDepartments,
        onClose: vi.fn(),
    });

    return (
        <>
            <output data-testid="edit-department-access">
                {String(result.canReadDepartments)}
            </output>
            <output data-testid="edit-department-count">
                {result.departments.length}
            </output>
        </>
    );
}

const emptyFormData: EmployeeFormData = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    position: "",
    affiliation: "",
    departmentId: "",
};

describe("Employee Department reference presentation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useSWR.mockImplementation((key: string | null) => ({
            data: key
                ? { departments: [{ id: 1, name: "บริหาร", code: "ADMIN" }] }
                : undefined,
        }));
    });

    it("does not request Department data for Add Employee without read capability", () => {
        render(<AddHookProbe canReadDepartments={false} />);

        expect(mocks.useSWR).toHaveBeenCalledWith(null);
        expect(screen.getByTestId("add-department-access")).toHaveTextContent("false");
        expect(screen.getByTestId("add-department-count")).toHaveTextContent("0");
    });

    it("preserves the existing Add Employee Department request when read is available", () => {
        render(<AddHookProbe canReadDepartments />);

        expect(mocks.useSWR).toHaveBeenCalledWith(API_ROUTES.employees.departments);
        expect(screen.getByTestId("add-department-access")).toHaveTextContent("true");
        expect(screen.getByTestId("add-department-count")).toHaveTextContent("1");
    });

    it("does not request Department data for an open Edit Employee form without read capability", () => {
        render(<EditHookProbe canReadDepartments={false} />);

        expect(mocks.useSWR).toHaveBeenCalledWith(null);
        expect(screen.getByTestId("edit-department-access")).toHaveTextContent("false");
    });

    it("preserves the existing Edit Employee Department request when read is available", () => {
        render(<EditHookProbe canReadDepartments />);

        expect(mocks.useSWR).toHaveBeenCalledWith(API_ROUTES.employees.departments);
        expect(screen.getByTestId("edit-department-access")).toHaveTextContent("true");
        expect(screen.getByTestId("edit-department-count")).toHaveTextContent("1");
    });

    it("distinguishes unauthorized Department data from an authorized empty dataset", () => {
        const onFieldChange = vi.fn();
        const { rerender } = render(
            <EmployeeFormFields
                formData={emptyFormData}
                fieldErrors={{}}
                departments={[]}
                canReadDepartments={false}
                onFieldChange={onFieldChange}
            />,
        );

        expect(screen.getByRole("status")).toHaveTextContent(
            "ไม่มีสิทธิ์เข้าถึงข้อมูลอ้างอิง",
        );
        expect(screen.queryByText("ไม่พบข้อมูลแผนก")).not.toBeInTheDocument();

        rerender(
            <EmployeeFormFields
                formData={emptyFormData}
                fieldErrors={{}}
                departments={[]}
                canReadDepartments
                onFieldChange={onFieldChange}
            />,
        );

        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
});
