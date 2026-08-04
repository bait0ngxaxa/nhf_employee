import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAdminSession: vi.fn(),
    createRoutineImportPreview: vi.fn(),
    createRoutineCommandActor: vi.fn(),
    enforceAuthenticatedMutationRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/services/routine-import", () => ({
    createRoutineImportPreview: mocks.createRoutineImportPreview,
    ROUTINE_IMPORT_MAX_FILE_BYTES: 10 * 1024 * 1024,
}));

vi.mock("@/lib/server/routine-command-actor", () => ({
    createRoutineCommandActor: mocks.createRoutineCommandActor,
}));

vi.mock("@/lib/security/mutation-rate-limit", () => ({
    enforceAuthenticatedMutationRateLimit: mocks.enforceAuthenticatedMutationRateLimit,
}));

vi.mock("@/lib/server/routine-api", () => ({
    routineFeatureGuard: () => null,
    routineErrorResponse: (error: unknown) => NextResponse.json(
        { error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" },
        { status: 500 },
    ),
}));

import { POST } from "@/app/api/routines/imports/preview/route";

const admin = {
    ok: true,
    user: { id: 7, email: "admin@example.com", role: "ADMIN" },
};

function buildRequest(file?: File): NextRequest {
    const request = new NextRequest("http://localhost/api/routines/imports/preview", {
        method: "POST",
    });
    vi.spyOn(request, "formData").mockResolvedValue({
        get: () => file ?? null,
    } as unknown as FormData);
    return request;
}

describe("POST /api/routines/imports/preview", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireAdminSession.mockResolvedValue(admin);
        mocks.enforceAuthenticatedMutationRateLimit.mockReturnValue(null);
        mocks.createRoutineCommandActor.mockReturnValue({ id: 7, role: "ADMIN", email: "admin@example.com" });
        mocks.createRoutineImportPreview.mockResolvedValue({
            batch: { id: 12 },
            reusedExisting: false,
        });
    });

    it("requires an admin session before parsing or staging the upload", async () => {
        mocks.requireAdminSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 }),
        });

        const response = await POST(buildRequest({
            name: "routine.xls",
            size: 1,
            arrayBuffer: async () => new ArrayBuffer(1),
        } as unknown as File));

        expect(response.status).toBe(403);
        expect(mocks.createRoutineImportPreview).not.toHaveBeenCalled();
    });

    it("rejects an upload without a file and does not apply anything", async () => {
        const response = await POST(buildRequest());

        expect(response.status).toBe(400);
        expect(mocks.createRoutineImportPreview).not.toHaveBeenCalled();
    });

    it("passes the uploaded workbook to preview staging without applying tasks", async () => {
        const file = {
            name: "routine.xls",
            size: 4,
            arrayBuffer: async () => new ArrayBuffer(4),
        } as unknown as File;
        const response = await POST(buildRequest(file));

        const body = await response.json();
        expect(response.status, JSON.stringify(body)).toBe(201);
        expect(mocks.createRoutineImportPreview).toHaveBeenCalledWith(
            expect.objectContaining({ name: "routine.xls", size: file.size }),
            expect.objectContaining({ id: 7, role: "ADMIN" }),
            undefined,
        );
    });
});
