import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_ROUTES } from "@/lib/ssot/routes";
import type { EmployeePresentationCapabilities } from "../../../application/types";
import type { Employee } from "../types";
import {
    useEmployeeDataContext,
    useEmployeeUIContext,
} from "./EmployeeContext";

const mocks = vi.hoisted(() => ({
    useSWR: vi.fn(),
    triggerDownload: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    listMutates: [] as Array<ReturnType<typeof vi.fn>>,
    statsMutates: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("swr", () => ({
    default: mocks.useSWR,
}));
vi.mock("@/lib/helpers/download", () => ({
    triggerDownload: mocks.triggerDownload,
}));
vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
        success: mocks.toastSuccess,
    },
}));

import { EmployeeProvider } from "./EmployeeProvider";

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

const noCapabilities: EmployeePresentationCapabilities = {
    canReadEmployees: false,
    canReadStats: false,
    canCreateEmployees: false,
    canUpdateEmployees: false,
    canDeleteEmployees: false,
    canImportEmployees: false,
    canExportEmployees: false,
};

const listOnlyCapabilities: EmployeePresentationCapabilities = {
    ...noCapabilities,
    canReadEmployees: true,
};

const exportListCapabilities: EmployeePresentationCapabilities = {
    ...listOnlyCapabilities,
    canExportEmployees: true,
};

const statsOnlyCapabilities: EmployeePresentationCapabilities = {
    ...noCapabilities,
    canReadStats: true,
};

const updateListCapabilities: EmployeePresentationCapabilities = {
    ...listOnlyCapabilities,
    canUpdateEmployees: true,
};

function setupSWR(): void {
    mocks.useSWR.mockImplementation((key: string | null) => {
        const mutate = vi.fn(async () => undefined);
        if (key === API_ROUTES.employees.stats) {
            mocks.statsMutates.push(mutate);
            return {
                data: {
                    stats: { total: 12, active: 10, admin: 2, academic: 8 },
                },
                mutate,
            };
        }

        if (key !== null) {
            mocks.listMutates.push(mutate);
            return {
                data: {
                    employees: [employee],
                    pagination: {
                        page: 1,
                        limit: 20,
                        total: 1,
                        totalPages: 1,
                    },
                },
                mutate,
                isLoading: false,
            };
        }

        return {
            data: undefined,
            mutate,
            isLoading: false,
        };
    });
}

function ProviderProbe(): ReactElement {
    const data = useEmployeeDataContext();
    const ui = useEmployeeUIContext();

    return (
        <>
            <output data-testid="employee-count">{data.employees.length}</output>
            <output data-testid="stats-total">{data.employeeStats.total}</output>
            <output data-testid="is-loading">{String(data.isLoading)}</output>
            <output data-testid="edit-open">{String(ui.isEditFormOpen)}</output>
            <button type="button" onClick={() => void ui.handleExportCSV()}>
                export
            </button>
            <button type="button" onClick={() => ui.handleEditEmployee(employee)}>
                edit
            </button>
            <button type="button" onClick={ui.handleEmployeeUpdate}>
                update
            </button>
            <button type="button" onClick={() => void data.triggerRefresh()}>
                refresh
            </button>
        </>
    );
}

function renderProvider(
    employeeCapabilities: EmployeePresentationCapabilities,
) {
    return render(
        <EmployeeProvider employeeCapabilities={employeeCapabilities}>
            <ProviderProbe />
        </EmployeeProvider>,
    );
}

describe("EmployeeProvider capability-aware presentation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.listMutates.length = 0;
        mocks.statsMutates.length = 0;
        setupSWR();
    });

    it("disables both SWR resources and data surfaces without read capabilities", () => {
        renderProvider(noCapabilities);

        expect(mocks.useSWR.mock.calls[0]?.[0]).toBeNull();
        expect(mocks.useSWR.mock.calls[1]?.[0]).toBeNull();
        expect(screen.getByTestId("employee-count")).toHaveTextContent("0");
        expect(screen.getByTestId("stats-total")).toHaveTextContent("0");
        expect(screen.getByTestId("is-loading")).toHaveTextContent("false");

        fireEvent.click(screen.getByRole("button", { name: "refresh" }));
        expect(mocks.listMutates).toHaveLength(0);
        expect(mocks.statsMutates).toHaveLength(0);
    });

    it("enables only list SWR when Employee list read is available", () => {
        renderProvider(listOnlyCapabilities);

        expect(mocks.useSWR.mock.calls[0]?.[0]).toContain(API_ROUTES.employees.list);
        expect(mocks.useSWR.mock.calls[1]?.[0]).toBeNull();
        expect(screen.getByTestId("employee-count")).toHaveTextContent("1");
        expect(screen.getByTestId("stats-total")).toHaveTextContent("0");
    });

    it("enables only stats SWR when Employee stats read is available", () => {
        renderProvider(statsOnlyCapabilities);

        expect(mocks.useSWR.mock.calls[0]?.[0]).toBeNull();
        expect(mocks.useSWR.mock.calls[1]?.[0]).toBe(API_ROUTES.employees.stats);
        expect(screen.getByTestId("employee-count")).toHaveTextContent("0");
        expect(screen.getByTestId("stats-total")).toHaveTextContent("12");
    });

    it("does not initiate export without export capability", () => {
        renderProvider(listOnlyCapabilities);

        fireEvent.click(screen.getByRole("button", { name: "export" }));

        expect(mocks.triggerDownload).not.toHaveBeenCalled();
    });

    it("initiates export when the independent export capability is available", async () => {
        renderProvider(exportListCapabilities);

        fireEvent.click(screen.getByRole("button", { name: "export" }));

        await waitFor(() => {
            expect(mocks.triggerDownload).toHaveBeenCalledWith(
                API_ROUTES.employees.export,
            );
        });
    });

    it("does not open edit UI without update capability", () => {
        renderProvider(listOnlyCapabilities);

        fireEvent.click(screen.getByRole("button", { name: "edit" }));

        expect(screen.getByTestId("edit-open")).toHaveTextContent("false");
    });

    it("closes a stale edit surface when update capability is revoked", async () => {
        const { rerender } = render(
            <EmployeeProvider employeeCapabilities={updateListCapabilities}>
                <ProviderProbe />
            </EmployeeProvider>,
        );

        fireEvent.click(screen.getByRole("button", { name: "edit" }));
        expect(screen.getByTestId("edit-open")).toHaveTextContent("true");

        rerender(
            <EmployeeProvider employeeCapabilities={listOnlyCapabilities}>
                <ProviderProbe />
            </EmployeeProvider>,
        );

        await waitFor(() => {
            expect(screen.getByTestId("edit-open")).toHaveTextContent("false");
        });
    });

    it("refreshes only the permitted list resource after an update", async () => {
        renderProvider(updateListCapabilities);

        fireEvent.click(screen.getByRole("button", { name: "edit" }));
        expect(screen.getByTestId("edit-open")).toHaveTextContent("true");
        fireEvent.click(screen.getByRole("button", { name: "update" }));

        await waitFor(() => {
            expect(mocks.listMutates.some((mutate) => mutate.mock.calls.length > 0))
                .toBe(true);
        });
        expect(mocks.statsMutates).toHaveLength(0);
    });
});
