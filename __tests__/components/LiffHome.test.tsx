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
        leave: { enabled: true, status: "available" as const },
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
            canReadReports: false,
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

    it("renders exactly four shortcuts in the approved order with their original routes", async () => {
        const { container } = render(<LiffHomeApp />);

        expect(await screen.findByRole("heading", { name: "สวัสดี พนักงาน ทดสอบ" })).toBeInTheDocument();

        const grid = container.querySelector<HTMLElement>("[data-shortcut-grid]");
        const shortcuts = Array.from(
            grid?.querySelectorAll<HTMLElement>("[data-shortcut-id]") ?? [],
        );
        expect(grid).toHaveClass("grid", "grid-cols-4");
        expect(shortcuts.map((shortcut) => shortcut.dataset.shortcutId)).toEqual([
            "stock",
            "leave",
            "routine",
            "it",
        ]);
        expect(shortcuts).toHaveLength(4);

        expect(screen.getByRole("link", { name: "เบิกวัสดุ" })).toHaveAttribute("href", "/liff/stock");
        expect(screen.getByRole("link", { name: "วันลา" })).toHaveAttribute("href", "/liff/leave");
        expect(screen.getByRole("link", { name: "งานประจำ" })).toHaveAttribute("href", "/liff/routine");
        expect(screen.getByRole("link", { name: "บริการ IT" })).toHaveAttribute("href", "/liff/it");
        expect(screen.queryByText(/เพิ่มเติม|ทั้งหมด|more|all services/i)).not.toBeInTheDocument();
        expect(screen.getByText("บริการของฉัน")).toBeInTheDocument();
    });

    it("keeps labels outside transparent shortcut wrappers and preserves module tiles and icons", async () => {
        const { container } = render(<LiffHomeApp />);
        await screen.findByRole("link", { name: "เบิกวัสดุ" });

        const shortcutStyles = [
            ["stock", "bg-module-stock-dashboard-surface", "lucide-boxes"],
            ["leave", "bg-module-leave-dashboard-surface", "lucide-calendar-range"],
            ["routine", "bg-module-routine-dashboard-surface", "lucide-clipboard-check"],
            ["it", "bg-module-it-dashboard-surface", "lucide-headset"],
        ] as const;

        for (const [key, surfaceClassName, iconClassName] of shortcutStyles) {
            const shortcut = container.querySelector<HTMLElement>(`[data-shortcut-id="${key}"]`);
            const tile = shortcut?.querySelector<HTMLElement>("[data-shortcut-icon]");
            const label = shortcut?.querySelector<HTMLElement>("[data-shortcut-label]");

            expect(shortcut).toHaveClass("bg-transparent", "min-h-28", "focus-visible:ring-2");
            expect(shortcut?.className).not.toMatch(/\b(?:border|shadow|bg-module)-/);
            expect(shortcut?.children).toHaveLength(2);
            expect(tile?.parentElement).toBe(shortcut);
            expect(tile).toHaveClass("size-16", "rounded-2xl", surfaceClassName, "text-content-on-brand");
            expect(tile?.querySelector("svg")).toHaveClass("size-7", iconClassName);
            expect(label?.parentElement).toBe(shortcut);
            expect(label).toHaveClass("line-clamp-2", "h-10");
            expect(tile?.textContent).not.toContain(label?.textContent ?? "");
        }
    });

    it("renders an unavailable module visibly without making it interactive", async () => {
        mocks.fetchLiffHome.mockResolvedValueOnce({
            ...HOME,
            modules: {
                ...HOME.modules,
                leave: { enabled: false as const, status: "unavailable" as const },
            },
        });

        const { container } = render(<LiffHomeApp />);
        await screen.findByRole("link", { name: "เบิกวัสดุ" });

        const leave = container.querySelector<HTMLElement>('[data-shortcut-id="leave"]');
        expect(leave?.tagName).toBe("DIV");
        expect(leave).toHaveAttribute("aria-disabled", "true");
        expect(leave).toHaveAttribute("data-module-enabled", "false");
        expect(leave?.querySelector("[data-shortcut-label]")).toHaveTextContent("วันลา");
        expect(leave?.querySelector("[data-shortcut-status]")).toHaveTextContent("ยังไม่พร้อม");
        expect(leave?.querySelector("[data-shortcut-icon]")).toHaveClass(
            "bg-surface-raised",
            "text-content-muted",
        );
        expect(screen.queryByRole("link", { name: "วันลา" })).not.toBeInTheDocument();
    });

    it("preserves the coming-soon classification with a visible Thai status", async () => {
        mocks.fetchLiffHome.mockResolvedValueOnce({
            ...HOME,
            modules: {
                ...HOME.modules,
                leave: { enabled: false as const, status: "coming-soon" as const },
            },
        });

        const { container } = render(<LiffHomeApp />);
        await screen.findByRole("link", { name: "เบิกวัสดุ" });

        const leave = container.querySelector<HTMLElement>('[data-shortcut-id="leave"]');
        expect(leave?.tagName).toBe("DIV");
        expect(leave?.querySelector("[data-shortcut-status]")).toHaveTextContent("เร็ว ๆ นี้");
        expect(screen.queryByRole("link", { name: "วันลา" })).not.toBeInTheDocument();
    });

    it("uses the bootstrap workforce name when the Home response has no name", async () => {
        mocks.useLiffWorkforce.mockReturnValue({
            ...HOME.workforce,
            name: "ชื่อจาก LIFF",
        });
        mocks.fetchLiffHome.mockResolvedValueOnce({
            ...HOME,
            workforce: { ...HOME.workforce, name: null },
        });

        render(<LiffHomeApp />);

        expect(await screen.findByRole("heading", { name: "สวัสดี ชื่อจาก LIFF" })).toBeInTheDocument();
    });

    it("falls back to the employee label when both workforce names are blank", async () => {
        mocks.useLiffWorkforce.mockReturnValue({
            ...HOME.workforce,
            name: "   ",
        });
        mocks.fetchLiffHome.mockResolvedValueOnce({
            ...HOME,
            workforce: { ...HOME.workforce, name: "  " },
        });

        render(<LiffHomeApp />);

        expect(await screen.findByRole("heading", { name: "สวัสดี พนักงาน" })).toBeInTheDocument();
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

        const { container } = render(<LiffHomeApp />);

        await waitFor(() => {
            expect(screen.queryByRole("link", { name: "บริการ IT" })).not.toBeInTheDocument();
        });
        const itShortcut = container.querySelector<HTMLElement>('[data-shortcut-id="it"]');
        expect(itShortcut?.tagName).toBe("DIV");
        expect(itShortcut).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByText("บริการ IT")).toBeInTheDocument();
        expect(screen.getByText("ยังไม่พร้อม")).toBeInTheDocument();
    });

    it("keeps the Routine shortcut navigable for a read-only actor", async () => {
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

        expect(await screen.findByRole("link", { name: "งานประจำ" })).toHaveAttribute(
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
            expect(screen.queryByRole("link", { name: "งานประจำ" })).not.toBeInTheDocument();
        });
        expect(screen.getByText("ยังไม่พร้อม")).toBeInTheDocument();
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
