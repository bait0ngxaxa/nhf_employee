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
    toastInfo: vi.fn(),
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
        info: mocks.toastInfo,
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

function setupSWR(total = 1): void {
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
                        total,
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
            <output data-testid="is-exporting">{String(ui.isExporting)}</output>
            <button type="button" onClick={() => ui.setSearchTerm("สมชาย")}>search</button>
            <button type="button" onClick={() => ui.setStatusFilter("ACTIVE")}>status</button>
            <button type="button" onClick={() => void ui.handleExportXlsx()}>
                export
            </button>
            <button type="button" onClick={() => ui.handleEmployeeUpdate(employee)}>
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
        expect(mocks.toastSuccess).not.toHaveBeenCalled();
        expect(mocks.toastInfo).toHaveBeenCalledWith("ส่งคำขอดาวน์โหลดแล้ว", expect.any(Object));
        expect(screen.getByTestId("is-exporting")).toHaveTextContent("true");
        await waitFor(() => expect(screen.getByTestId("is-exporting")).toHaveTextContent("false"));
    });

    it("forwards search and status without UI pagination parameters", async () => {
        renderProvider(exportListCapabilities);
        fireEvent.click(screen.getByRole("button", { name: "search" }));
        fireEvent.click(screen.getByRole("button", { name: "status" }));
        await waitFor(() => expect(mocks.useSWR.mock.calls.at(-2)?.[0]).toContain(encodeURIComponent("สมชาย")));
        fireEvent.click(screen.getByRole("button", { name: "export" }));
        const url = new URL(mocks.triggerDownload.mock.calls[0][0], "http://localhost");
        expect([...url.searchParams]).toEqual([["search", "สมชาย"], ["status", "ACTIVE"]]);
    });

    it.each([0, 2001])("rejects export for %i matching employees", (total) => {
        setupSWR(total);
        renderProvider(exportListCapabilities);
        fireEvent.click(screen.getByRole("button", { name: "export" }));
        expect(mocks.triggerDownload).not.toHaveBeenCalled();
        expect(mocks.toastError).toHaveBeenCalled();
    });

    it("allows exactly 2000 matching employees", () => {
        setupSWR(2000);
        renderProvider(exportListCapabilities);
        fireEvent.click(screen.getByRole("button", { name: "export" }));
        expect(mocks.triggerDownload).toHaveBeenCalledWith(API_ROUTES.employees.export);
    });

    it("reports an error if initiating the download fails", () => {
        mocks.triggerDownload.mockImplementationOnce(() => { throw new Error("Download failed"); });
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        renderProvider(exportListCapabilities);
        fireEvent.click(screen.getByRole("button", { name: "export" }));
        expect(mocks.toastError).toHaveBeenCalledWith("เกิดข้อผิดพลาดในการดาวน์โหลด", expect.any(Object));
        consoleError.mockRestore();
    });

    it("does not refresh after an update without update capability", () => {
        renderProvider(listOnlyCapabilities);

        fireEvent.click(screen.getByRole("button", { name: "update" }));

        expect(mocks.listMutates.some((mutate) => mutate.mock.calls.length > 0))
            .toBe(false);
    });

    it("refreshes only the permitted list resource after an update", async () => {
        renderProvider(updateListCapabilities);

        fireEvent.click(screen.getByRole("button", { name: "update" }));

        await waitFor(() => {
            expect(mocks.listMutates.some((mutate) => mutate.mock.calls.length > 0))
                .toBe(true);
        });
        expect(mocks.statsMutates).toHaveLength(0);
    });
});
