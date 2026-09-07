import { beforeEach, describe, expect, it, vi } from "vitest";

const { currentUserProjectionMock } = vi.hoisted(() => ({
    currentUserProjectionMock: vi.fn(),
}));

vi.mock("@/app/_lib/auth/current-user", () => ({
    getCurrentUserProjection: currentUserProjectionMock,
}));

import { GET } from "@/app/api/auth/me/route";

describe("GET /api/auth/me", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when no eligible current-user projection exists", async () => {
        currentUserProjectionMock.mockResolvedValue(null);

        const response = await GET();

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            error: "Unauthorized",
        });
    });

    it("returns the composed current-user projection unchanged", async () => {
        const user = {
            id: "1",
            role: "ADMIN",
            email: "admin@test.com",
            name: "สมชาย ใจดี",
            department: "วิชาการ",
            isManager: true,
            canApproveLeave: true,
            canViewLeaveReports: true,
        };
        currentUserProjectionMock.mockResolvedValue(user);

        const response = await GET();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ user });
    });
});
