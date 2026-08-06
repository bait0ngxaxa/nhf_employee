import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAdminSession: vi.fn(),
    createRoutineImportPreview: vi.fn(),
    getRoutineImportReferenceData: vi.fn(),
    createRoutineCommandActor: vi.fn(),
    enforceAuthenticatedMutationRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/services/routine-import", () => ({
    createRoutineImportPreview: mocks.createRoutineImportPreview,
    getRoutineImportReferenceData: mocks.getRoutineImportReferenceData,
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
import { GET as GETImportReference } from "@/app/api/routines/imports/reference/route";

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
        mocks.getRoutineImportReferenceData.mockResolvedValue({
            units: [],
            categories: [],
            employees: [{
                id: 22,
                firstName: "อดีต",
                lastName: "พนักงาน",
                nickname: "เก่า",
                departmentId: 3,
                status: "INACTIVE",
                deletedAt: "2026-01-01T00:00:00.000Z",
            }],
        });
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

describe("GET /api/routines/imports/reference", () => {
    beforeEach(() => {
        mocks.requireAdminSession.mockResolvedValue(admin);
        mocks.getRoutineImportReferenceData.mockResolvedValue({
            units: [],
            categories: [],
            employees: [{
                id: 22,
                firstName: "อดีต",
                lastName: "พนักงาน",
                nickname: "เก่า",
                departmentId: 3,
                status: "INACTIVE",
                deletedAt: "2026-01-01T00:00:00.000Z",
            }],
        });
    });

    it("returns import reference employees including unavailable records", async () => {
        const response = await GETImportReference(
            new NextRequest("http://localhost/api/routines/imports/reference"),
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(expect.objectContaining({
            employees: [expect.objectContaining({
                id: 22,
                status: "INACTIVE",
                deletedAt: "2026-01-01T00:00:00.000Z",
            })],
        }));
        expect(mocks.getRoutineImportReferenceData).toHaveBeenCalledOnce();
    });
});
