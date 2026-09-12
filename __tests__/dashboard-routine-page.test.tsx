// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUserProjection: vi.fn(),
    redirect: vi.fn((target: string): never => {
        throw new Error(`NEXT_REDIRECT:${target}`);
    }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/_lib/auth/current-user", () => ({
    getCurrentUserProjection: mocks.getCurrentUserProjection,
}));
vi.mock("@/modules/routine/client", () => ({
    RoutineSection: () => null,
    RoutineSectionSkeleton: () => null,
}));

import RoutineDashboardPage from "@/app/dashboard/routine/page";

const originalRoutineFlag = process.env.NEXT_PUBLIC_FEATURE_ROUTINE;

const routineUser = {
    id: "41",
    role: "USER",
    email: "account@test.com",
    routineCapabilities: {
        canReadTasks: true,
        canCreateTasks: false,
        canUpdateTasks: false,
        canDeleteTasks: false,
        canReadOccurrences: false,
        canOverrideOccurrences: false,
        canReassignOccurrences: false,
        canChangeOccurrenceDueDate: false,
        canManageImports: false,
    },
};

describe("Routine Dashboard route access", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "true";
        mocks.getCurrentUserProjection.mockResolvedValue(routineUser);
    });

    afterEach(() => {
        if (originalRoutineFlag === undefined) {
            delete process.env.NEXT_PUBLIC_FEATURE_ROUTINE;
        } else {
            process.env.NEXT_PUBLIC_FEATURE_ROUTINE = originalRoutineFlag;
        }
    });

    it("redirects to Dashboard when the Routine feature is disabled", async () => {
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "false";

        await expect(RoutineDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/dashboard",
        );
        expect(mocks.getCurrentUserProjection).not.toHaveBeenCalled();
    });

    it("preserves normal login behavior for an unauthenticated actor", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue(null);

        await expect(RoutineDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/login",
        );
    });

    it("redirects an authenticated actor without Routine task read access", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...routineUser,
            routineCapabilities: {
                ...routineUser.routineCapabilities,
                canReadTasks: false,
            },
        });

        await expect(RoutineDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
    });

    it("renders when the feature and server-derived read capability are available", async () => {
        const page = await RoutineDashboardPage();

        expect(page).toBeTruthy();
        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(mocks.getCurrentUserProjection).toHaveBeenCalledTimes(1);
    });
});
