import { render, screen, waitFor } from "@testing-library/react";
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
    },
    capabilities: {
        canRequestStock: true,
        canProcessStockRequests: false,
        canRequestLeave: false,
        canApproveLeave: false,
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
            canManageImports: false,
        },
    },
};

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
        expect(screen.getByText("บริการนี้ยังไม่เปิดใช้งานสำหรับบัญชีของคุณ")).toBeInTheDocument();
        expect(screen.getByText("บริการของฉัน")).toBeInTheDocument();
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
});
