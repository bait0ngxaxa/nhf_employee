import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    fetchLiffHome: vi.fn(),
    useLiffWorkforce: vi.fn(),
    MockLiffApiError: class MockLiffApiError extends Error {
        readonly status: number | undefined;

        constructor(message: string, status?: number) {
            super(message);
            this.name = "LiffApiError";
            this.status = status;
        }
    },
}));

vi.mock("@/modules/line/client", () => ({
    fetchLiffHome: mocks.fetchLiffHome,
    LiffApiError: mocks.MockLiffApiError,
    useLiffWorkforce: mocks.useLiffWorkforce,
}));

import { LiffHomeApp } from "@/components/liff/home/LiffHomeApp";

const HOME = {
    workforce: {
        userId: 10,
        employeeId: 20,
        name: "พนักงาน ทดสอบ",
    },
    modules: {
        stock: { enabled: true, status: "available" as const },
        leave: { enabled: false, status: "unavailable" as const },
        routine: { enabled: true, status: "available" as const },
        it: { enabled: true, status: "available" as const },
    },
    capabilities: {
        stockCapabilities: {
            canReadCatalog: true,
            canReadOwnRequests: true,
            canReadAllRequests: false,
            canCreateRequests: true,
            canCancelOwnRequests: true,
            canCancelAnyRequests: false,
            canProcessRequests: false,
            canManageInventory: false,
            canExportReports: false,
        },
        canRequestStock: true,
        canProcessStockRequests: false,
        canRequestLeave: false,
        canApproveLeave: false,
        leaveCapabilities: {
            canReadOwnRequests: false,
            canReadAssignedApprovals: false,
            canCreateOwnRequests: false,
            canCancelOwnRequests: false,
            canApproveAssignedRequests: false,
            canDecideAssignedCancellations: false,
            canRequestOwnNotTaken: false,
            canConfirmAssignedNotTaken: false,
            canManageApprovers: false,
            canManageRecovery: false,
        },
        canCreateOwnRoutine: true,
        routineCapabilities: {
            canReadTasks: true,
            canCreateTasks: true,
            canUpdateTasks: true,
            canDeleteTasks: true,
            canReadOccurrences: false,
            canOverrideOccurrences: false,
            canReassignOccurrences: false,
            canChangeOccurrenceDueDate: false,
            canExportTasks: false,
            canReadSummary: true,
            canReadAllSummary: false,
            canReadReference: true,
        },
        itCapabilities: {
            canReadOwnTickets: true,
            canReadAllTickets: false,
            canCreateOwnTickets: true,
            canCommentOwnTickets: true,
            canCommentAllTickets: false,
            canManageTickets: false,
            canReadAnalytics: false,
        },
    },
};

function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
} {
    let resolvePromise: (value: T) => void = () => undefined;
    const promise = new Promise<T>((resolve) => {
        resolvePromise = resolve;
    });

    return { promise, resolve: resolvePromise };
}

describe("LIFF home", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useLiffWorkforce.mockReturnValue(HOME.workforce);
        mocks.fetchLiffHome.mockResolvedValue(HOME);
    });

    it("renders the server-available modules and safely identifies the workforce", async () => {
        render(<LiffHomeApp />);

        expect(await screen.findByRole("heading", { name: "สวัสดี พนักงาน ทดสอบ" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /เบิกวัสดุและติดตามคำขอ/ })).toHaveAttribute(
            "href",
            "/liff/stock",
        );
        expect(screen.getByRole("link", { name: /ดูงานประจำของฉัน/ })).toHaveAttribute(
            "href",
            "/liff/routine",
        );
        expect(screen.getByRole("link", { name: /แจ้งปัญหา IT/ })).toHaveAttribute(
            "href",
            "/liff/it",
        );
        expect(screen.getByText("บริการนี้ยังไม่เปิดใช้งานสำหรับบัญชีของคุณ")).toBeInTheDocument();
        expect(screen.getByText("บริการของฉัน")).toBeInTheDocument();
    });

    it("renders IT as a disabled non-link when requester entry is unavailable", async () => {
        mocks.fetchLiffHome.mockResolvedValueOnce({
            ...HOME,
            modules: {
                ...HOME.modules,
                it: { enabled: false as const, status: "unavailable" as const },
            },
            capabilities: {
                ...HOME.capabilities,
                itCapabilities: {
                    ...HOME.capabilities.itCapabilities,
                    canReadOwnTickets: false,
                    canCreateOwnTickets: false,
                },
            },
        });

        render(<LiffHomeApp />);

        await waitFor(() => {
            expect(screen.queryByRole("link", { name: /แจ้งปัญหา IT/ })).not.toBeInTheDocument();
        });
        expect(screen.getByText("แจ้งปัญหา IT")).toBeInTheDocument();
        expect(screen.getAllByText("บริการนี้ยังไม่เปิดใช้งานสำหรับบัญชีของคุณ")).toHaveLength(2);
    });

    it("keeps the Routine card navigable for a read-only actor", async () => {
        const readOnlyHome = {
            ...HOME,
            capabilities: {
                ...HOME.capabilities,
                canCreateOwnRoutine: false,
                routineCapabilities: {
                    ...HOME.capabilities.routineCapabilities,
                    canCreateTasks: false,
                    canUpdateTasks: false,
                    canDeleteTasks: false,
                },
            },
        };
        mocks.fetchLiffHome.mockResolvedValueOnce(readOnlyHome);

        render(<LiffHomeApp />);

        expect(await screen.findByRole("link", { name: /ดูงานประจำของฉัน/ })).toHaveAttribute(
            "href",
            "/liff/routine",
        );
    });

    it("renders Routine as a disabled non-link when the server denies task reads", async () => {
        const unavailableRoutineHome = {
            ...HOME,
            modules: {
                ...HOME.modules,
                routine: { enabled: false as const, status: "unavailable" as const },
            },
            capabilities: {
                ...HOME.capabilities,
                canCreateOwnRoutine: false,
                routineCapabilities: {
                    ...HOME.capabilities.routineCapabilities,
                    canReadTasks: false,
                    canCreateTasks: false,
                    canUpdateTasks: false,
                    canDeleteTasks: false,
                },
            },
        };
        mocks.fetchLiffHome.mockResolvedValueOnce(unavailableRoutineHome);

        render(<LiffHomeApp />);

        await waitFor(() => {
            expect(screen.queryByRole("link", { name: /ดูงานประจำของฉัน/ })).not.toBeInTheDocument();
        });
        expect(screen.getAllByText("บริการนี้ยังไม่เปิดใช้งานสำหรับบัญชีของคุณ")).toHaveLength(2);
    });

    it("shows a safe retryable error instead of backend details", async () => {
        mocks.fetchLiffHome.mockRejectedValueOnce(new Error("provider details"));

        render(<LiffHomeApp />);

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "โหลดบริการของฉันไม่สำเร็จ" })).toBeInTheDocument();
        });
        expect(
            screen.getByText("ไม่สามารถโหลดบริการของคุณได้ กรุณาลองใหม่อีกครั้ง"),
        ).toBeInTheDocument();
        expect(screen.queryByText("provider details")).not.toBeInTheDocument();
    });

    it("starts in loading while the initial request is unresolved", () => {
        mocks.fetchLiffHome.mockReturnValueOnce(new Promise(() => undefined));

        render(<LiffHomeApp />);

        expect(screen.getByText("กำลังโหลดบริการของคุณ…")).toBeInTheDocument();
        expect(screen.queryByRole("main")).not.toBeInTheDocument();
    });

    it("uses the safe LiffApiError message", async () => {
        mocks.fetchLiffHome.mockRejectedValueOnce(
            new mocks.MockLiffApiError("ข้อความที่ปลอดภัย", 503),
        );

        render(<LiffHomeApp />);

        expect(await screen.findByText("ข้อความที่ปลอดภัย")).toBeInTheDocument();
        expect(screen.queryByText("provider details")).not.toBeInTheDocument();
    });

    it("starts a new loading request when retry is clicked", async () => {
        const retryRequest = createDeferred<typeof HOME>();
        mocks.fetchLiffHome
            .mockRejectedValueOnce(new Error("first request failed"))
            .mockReturnValueOnce(retryRequest.promise);

        render(<LiffHomeApp />);

        fireEvent.click(await screen.findByRole("button", { name: "ลองใหม่" }));

        expect(screen.getByText("กำลังโหลดบริการของคุณ…")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "โหลดบริการของฉันไม่สำเร็จ" })).not.toBeInTheDocument();

        await act(async () => {
            retryRequest.resolve(HOME);
        });

        expect(await screen.findByRole("heading", { name: "สวัสดี พนักงาน ทดสอบ" })).toBeInTheDocument();
    });

    it("keeps the newest StrictMode mount request when responses resolve out of order", async () => {
        const olderRequest = createDeferred<typeof HOME>();
        const newerRequest = createDeferred<typeof HOME>();
        const newerHome = {
            ...HOME,
            workforce: { ...HOME.workforce, name: "ผลลัพธ์ล่าสุด" },
        };
        mocks.fetchLiffHome
            .mockReturnValueOnce(olderRequest.promise)
            .mockReturnValueOnce(newerRequest.promise);

        render(
            <StrictMode>
                <LiffHomeApp />
            </StrictMode>,
        );

        await waitFor(() => expect(mocks.fetchLiffHome).toHaveBeenCalledTimes(2));
        await act(async () => {
            newerRequest.resolve(newerHome);
        });
        expect(await screen.findByRole("heading", { name: "สวัสดี ผลลัพธ์ล่าสุด" })).toBeInTheDocument();

        await act(async () => {
            olderRequest.resolve(HOME);
        });

        expect(screen.getByRole("heading", { name: "สวัสดี ผลลัพธ์ล่าสุด" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "สวัสดี พนักงาน ทดสอบ" })).not.toBeInTheDocument();
    });

    it("ignores a late request after unmount", async () => {
        const request = createDeferred<typeof HOME>();
        mocks.fetchLiffHome.mockReturnValueOnce(request.promise);

        const { unmount } = render(<LiffHomeApp />);
        unmount();

        await act(async () => {
            request.resolve(HOME);
        });

        expect(screen.queryByRole("main")).not.toBeInTheDocument();
    });
});
