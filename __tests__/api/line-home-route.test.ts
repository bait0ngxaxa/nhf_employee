// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
    requireLiffWorkforceSessionMock,
    getLiffCapabilitiesMock,
    getLiffHomeModulesMock,
} = vi.hoisted(() => ({
    requireLiffWorkforceSessionMock: vi.fn(),
    getLiffCapabilitiesMock: vi.fn(),
    getLiffHomeModulesMock: vi.fn(),
}));

vi.mock("@/lib/auth/liff", () => ({
    requireLiffWorkforceSession: requireLiffWorkforceSessionMock,
    getLiffCapabilities: getLiffCapabilitiesMock,
}));

vi.mock("@/lib/line/liff-home", () => ({
    getLiffHomeModules: getLiffHomeModulesMock,
}));

import { GET } from "@/app/api/line/home/route";

const AUTH = {
    ok: true as const,
    user: {
        id: 10,
        role: "USER",
        email: "employee@example.com",
        name: "พนักงาน ทดสอบ",
    },
    employeeId: 20,
};

const MODULES = {
    stock: { enabled: true, status: "coming-soon" as const },
    leave: { enabled: true, status: "coming-soon" as const },
    routine: { enabled: true, status: "available" as const },
};

const CAPABILITIES = {
    canRequestStock: true,
    canProcessStockRequests: false,
    canRequestLeave: true,
    canApproveLeave: false,
    canCreateOwnRoutine: true,
};

describe("LIFF home API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireLiffWorkforceSessionMock.mockResolvedValue(AUTH);
        getLiffHomeModulesMock.mockReturnValue(MODULES);
        getLiffCapabilitiesMock.mockResolvedValue(CAPABILITIES);
    });

    it("returns only the server-derived workforce, module, and capability contract", async () => {
        const response = await GET();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            workforce: {
                userId: 10,
                employeeId: 20,
                name: "พนักงาน ทดสอบ",
            },
            modules: MODULES,
            capabilities: CAPABILITIES,
        });
        expect(getLiffCapabilitiesMock).toHaveBeenCalledWith(AUTH);
    });

    it("returns the existing LIFF session failure without querying capabilities", async () => {
        requireLiffWorkforceSessionMock.mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });

        const response = await GET();

        expect(response.status).toBe(401);
        expect(getLiffCapabilitiesMock).not.toHaveBeenCalled();
        expect(getLiffHomeModulesMock).not.toHaveBeenCalled();
    });
});
