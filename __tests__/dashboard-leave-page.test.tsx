// @vitest-environment node
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUserProjection: vi.fn(),
    leaveSection: vi.fn(() => null),
    redirect: vi.fn((target: string): never => {
        throw new Error(`NEXT_REDIRECT:${target}`);
    }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/_lib/auth/current-user", () => ({
    getCurrentUserProjection: mocks.getCurrentUserProjection,
}));
vi.mock("@/modules/leave/client", () => ({
    LeaveManagementSection: mocks.leaveSection,
    LeaveManagementSectionSkeleton: () => null,
}));

import LeaveDashboardPage from "@/app/dashboard/leave/page";

const originalLeaveFlag = process.env.NEXT_PUBLIC_FEATURE_LEAVE;

const noLeaveCapabilities = {
    canReadOwnRequests: false,
    canReadAssignedApprovals: false,
    canCreateOwnRequests: false,
    canCancelOwnRequests: false,
    canApproveAssignedRequests: false,
    canDecideAssignedCancellations: false,
    canRequestOwnNotTaken: false,
    canConfirmAssignedNotTaken: false,
    canManageApprovers: false,
} as const;

const ownLeaveCapabilities = {
    ...noLeaveCapabilities,
    canReadOwnRequests: true,
} as const;

const assignedLeaveCapabilities = {
    ...noLeaveCapabilities,
    canReadAssignedApprovals: true,
} as const;

const user = {
    id: "41",
    role: "USER",
    email: "account@test.com",
};

function getRenderedLeaveSectionProps(page: ReactElement): { defaultTab?: string } {
    const suspenseProps = page.props as {
        children: ReactElement<{ defaultTab?: string }>;
    };
    return suspenseProps.children.props;
}

describe("Leave Dashboard route access", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_FEATURE_LEAVE = "true";
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            role: "USER",
            leaveCapabilities: ownLeaveCapabilities,
            canApproveLeave: false,
            canViewLeaveReports: false,
        });
    });

    afterEach(() => {
        if (originalLeaveFlag === undefined) {
            delete process.env.NEXT_PUBLIC_FEATURE_LEAVE;
        } else {
            process.env.NEXT_PUBLIC_FEATURE_LEAVE = originalLeaveFlag;
        }
    });

    it("checks the Leave feature before loading the user projection", async () => {
        process.env.NEXT_PUBLIC_FEATURE_LEAVE = "false";

        await expect(LeaveDashboardPage({ searchParams: Promise.resolve({}) }))
            .rejects.toThrow("NEXT_REDIRECT:/dashboard");
        expect(mocks.getCurrentUserProjection).not.toHaveBeenCalled();
    });

    it("redirects an unauthenticated actor to login", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue(null);

        await expect(LeaveDashboardPage({ searchParams: Promise.resolve({}) }))
            .rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("denies an authenticated actor without a usable Leave surface", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            leaveCapabilities: noLeaveCapabilities,
            canApproveLeave: false,
            canViewLeaveReports: false,
        });

        await expect(LeaveDashboardPage({ searchParams: Promise.resolve({}) }))
            .rejects.toThrow("NEXT_REDIRECT:/access-denied");
        expect(mocks.leaveSection).not.toHaveBeenCalled();
    });

    it("does not expose approvals from assigned-read capability alone", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            leaveCapabilities: assignedLeaveCapabilities,
            canApproveLeave: false,
        });

        await expect(LeaveDashboardPage({ searchParams: Promise.resolve({}) }))
            .rejects.toThrow("NEXT_REDIRECT:/access-denied");
    });

    it("renders the own Leave surface for a normal compatible workforce user", async () => {
        const page = await LeaveDashboardPage({ searchParams: Promise.resolve({}) });

        expect(getRenderedLeaveSectionProps(page).defaultTab).toBe("my-leave");
        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(mocks.getCurrentUserProjection).toHaveBeenCalledTimes(1);
    });

    it("renders approvals only when assigned-read and the existing relationship both exist", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            leaveCapabilities: assignedLeaveCapabilities,
            canApproveLeave: true,
        });

        const page = await LeaveDashboardPage({
            searchParams: Promise.resolve({ leaveTab: "approvals" }),
        });

        expect(getRenderedLeaveSectionProps(page).defaultTab).toBe("approvals");
    });

    it("allows a report-only deferred Leave surface", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            leaveCapabilities: noLeaveCapabilities,
            canViewLeaveReports: true,
        });

        const page = await LeaveDashboardPage({
            searchParams: Promise.resolve({ leaveTab: "reports" }),
        });

        expect(getRenderedLeaveSectionProps(page).defaultTab).toBe("reports");
    });

    it("keeps Dashboard Admin recovery separate from normal approval", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            role: "ADMIN",
            leaveCapabilities: noLeaveCapabilities,
            canApproveLeave: false,
            canViewLeaveReports: false,
        });

        const page = await LeaveDashboardPage({
            searchParams: Promise.resolve({ leaveTab: "recovery" }),
        });

        expect(getRenderedLeaveSectionProps(page).defaultTab).toBe("recovery");
    });

    it("allows an explicit USER approver-management grant without recovery", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            role: "USER",
            leaveCapabilities: {
                ...noLeaveCapabilities,
                canManageApprovers: true,
            },
        });

        const page = await LeaveDashboardPage({
            searchParams: Promise.resolve({ leaveTab: "recovery" }),
        });

        expect(getRenderedLeaveSectionProps(page).defaultTab).toBe("approver-settings");
    });

    it("normalizes a valid but unavailable tab before rendering", async () => {
        const page = await LeaveDashboardPage({
            searchParams: Promise.resolve({ leaveTab: "approvals" }),
        });

        expect(getRenderedLeaveSectionProps(page).defaultTab).toBe("my-leave");
    });
});
