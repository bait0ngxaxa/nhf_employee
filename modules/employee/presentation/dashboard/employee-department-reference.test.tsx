import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import { API_ROUTES } from "@/lib/ssot/routes";
import { apiPatch, apiPost } from "@/lib/client/api-client";
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

function EditHookProbe({
    canReadDepartments,
    hireDate = employee.hireDate,
}: {
    canReadDepartments: boolean;
    hireDate?: string | null;
}): ReactElement {
    const result = useEditEmployee({
        employee: { ...employee, hireDate },
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
            <output data-testid="edit-hire-date">
                {result.formData.hireDate}
            </output>
            <form onSubmit={result.handleSubmit}>
                <button
                    type="button"
                    onClick={() => result.handleFieldChange("hireDate", "")}
                >
                    ล้างวันที่ในแบบทดสอบ
                </button>
                <button type="submit">บันทึก</button>
            </form>
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
    hireDate: "",
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

    it("initializes an edit hire date from the saved date and leaves null dates empty", () => {
        const { unmount } = render(<EditHookProbe canReadDepartments={false} />);
        expect(screen.getByTestId("edit-hire-date")).toHaveTextContent("2020-01-01");
        unmount();

        render(<EditHookProbe canReadDepartments={false} hireDate={null} />);
        expect(screen.getByTestId("edit-hire-date")).toBeEmptyDOMElement();
    });

    it("submits a cleared hire date as explicit null in the edit request", async () => {
        vi.mocked(apiPatch).mockResolvedValue({
            success: true,
            data: {},
            status: 200,
            requestId: "test-request",
        });
        render(<EditHookProbe canReadDepartments={false} />);

        fireEvent.click(screen.getByRole("button", { name: "ล้างวันที่ในแบบทดสอบ" }));
        fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

        await waitFor(() => {
            expect(apiPatch).toHaveBeenCalledWith(
                API_ROUTES.employees.byId(employee.id),
                expect.objectContaining({ hireDate: null }),
            );
        });
    });

    it("renders the optional hire date and exposes an explicit clear action", () => {
        const onFieldChange = vi.fn();
        const { rerender } = render(
            <EmployeeFormFields
                formData={{ ...emptyFormData, hireDate: "2023-04-01" }}
                fieldErrors={{}}
                departments={[]}
                canReadDepartments={false}
                onFieldChange={onFieldChange}
            />,
        );

        expect(screen.getByLabelText("วันที่เริ่มงาน (ไม่บังคับ)")).toHaveValue("2023-04-01");
        fireEvent.click(screen.getByRole("button", { name: "ล้างวันที่เริ่มงาน" }));
        expect(onFieldChange).toHaveBeenCalledWith("hireDate", "");

        rerender(
            <EmployeeFormFields
                formData={emptyFormData}
                fieldErrors={{}}
                departments={[]}
                canReadDepartments={false}
                onFieldChange={onFieldChange}
            />,
        );
        expect(screen.getByLabelText("วันที่เริ่มงาน (ไม่บังคับ)")).toHaveValue("");
        expect(screen.queryByRole("button", { name: "ล้างวันที่เริ่มงาน" })).not.toBeInTheDocument();
    });

    it("submits a blank hire date as null when creating an employee", async () => {
        vi.mocked(apiPost).mockResolvedValue({
            success: true,
            data: {},
            status: 201,
            requestId: "test-request",
        });
        function CreateSubmitProbe(): ReactElement {
            const result = useAddEmployee({ canReadDepartments: true });

            return (
                <form onSubmit={result.handleSubmit}>
                    <button
                        type="button"
                        onClick={() => {
                            result.handleFieldChange("firstName", "สมใจ");
                            result.handleFieldChange("lastName", "ใจดี");
                            result.handleFieldChange("email", "somjai@example.com");
                            result.handleFieldChange("position", "เจ้าหน้าที่");
                            result.handleFieldChange("departmentId", "1");
                        }}
                    >
                        กรอกข้อมูลที่จำเป็น
                    </button>
                    <button type="submit">เพิ่ม</button>
                </form>
            );
        }

        render(<CreateSubmitProbe />);
        fireEvent.click(screen.getByRole("button", { name: "กรอกข้อมูลที่จำเป็น" }));
        fireEvent.click(screen.getByRole("button", { name: "เพิ่ม" }));

        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledWith(
                API_ROUTES.employees.list,
                expect.objectContaining({ hireDate: null }),
            );
        });
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
