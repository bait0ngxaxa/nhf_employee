// @vitest-environment node

import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/leave/attachments/[attachmentId]/route";
import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { prisma } from "@/lib/db/prisma";
import { API_ROUTES } from "@/lib/ssot/routes";
import { readLeaveAttachment } from "@/modules/leave";

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceOrAdminSession: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        leaveAttachment: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("@/modules/leave", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as Record<string, unknown>),
        readLeaveAttachment: vi.fn(),
    };
});

const ATTACHMENT_ID = "attachment-1";
const STORAGE_KEY =
    "leave/leave-request-1/0123456789abcdef0123456789abcdef.webp";
const IMAGE = Buffer.from("private-webp-image");

function routeContext(
    attachmentId: string = ATTACHMENT_ID,
): { params: Promise<{ attachmentId: string }> } {
    return { params: Promise.resolve({ attachmentId }) };
}

function mockWorkforce(employeeId: number): void {
    vi.mocked(requireActiveWorkforceOrAdminSession).mockResolvedValue({
        ok: true,
        session: {
            user: {
                id: String(employeeId),
                role: "USER",
                email: "employee@example.com",
                name: "Employee",
            },
        },
        user: {
            id: employeeId,
            role: "USER",
            email: "employee@example.com",
            name: "Employee",
        },
        employeeId,
    });
}

function mockAdmin(): void {
    vi.mocked(requireActiveWorkforceOrAdminSession).mockResolvedValue({
        ok: true,
        session: {
            user: {
                id: "1",
                role: "ADMIN",
                email: "admin@example.com",
                name: "Admin",
            },
        },
        user: {
            id: 1,
            role: "ADMIN",
            email: "admin@example.com",
            name: "Admin",
        },
    });
}

function mockAttachment(
    employeeId: number = 10,
    approverId: number | null = 20,
): void {
    vi.mocked(prisma.leaveAttachment.findUnique).mockResolvedValue({
        id: ATTACHMENT_ID,
        storageKey: STORAGE_KEY,
        contentType: "image/webp",
        leaveRequest: {
            employeeId,
            approverId,
        },
    } as never);
}

async function getAttachment(
    attachmentId: string = ATTACHMENT_ID,
): Promise<NextResponse> {
    const route = API_ROUTES.leave.attachmentById(attachmentId);
    return GET(
        new Request(new URL(route, "http://localhost")),
        routeContext(attachmentId),
    );
}

describe("GET /api/leave/attachments/[attachmentId]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAttachment();
        vi.mocked(readLeaveAttachment).mockResolvedValue(IMAGE);
    });

    it("allows the employee who owns the leave request", async () => {
        mockWorkforce(10);

        const response = await getAttachment();

        expect(response.status).toBe(200);
        await expect(response.arrayBuffer()).resolves.toEqual(
            Uint8Array.from(IMAGE).buffer,
        );
    });

    it("allows the approver stored on the leave request", async () => {
        mockWorkforce(20);

        const response = await getAttachment();

        expect(response.status).toBe(200);
    });

    it("allows an admin without requiring an employee profile", async () => {
        mockAdmin();

        const response = await getAttachment();

        expect(response.status).toBe(200);
    });

    it("returns 404 for another employee", async () => {
        mockWorkforce(30);

        const response = await getAttachment();

        expect(response.status).toBe(404);
        expect(readLeaveAttachment).not.toHaveBeenCalled();
    });

    it("does not authorize the employee's new manager", async () => {
        mockWorkforce(30);
        mockAttachment(10, 20);

        const response = await getAttachment();

        expect(response.status).toBe(404);
        expect(readLeaveAttachment).not.toHaveBeenCalled();
    });

    it("still authorizes the former manager stored as the approver snapshot", async () => {
        mockWorkforce(20);
        mockAttachment(10, 20);

        const response = await getAttachment();

        expect(response.status).toBe(200);
    });

    it("returns 404 when the attachment does not exist", async () => {
        mockWorkforce(10);
        vi.mocked(prisma.leaveAttachment.findUnique).mockResolvedValue(null);

        const response = await getAttachment();

        expect(response.status).toBe(404);
        expect(readLeaveAttachment).not.toHaveBeenCalled();
    });

    it("preserves the authentication response for an unauthorized session", async () => {
        vi.mocked(requireActiveWorkforceOrAdminSession).mockResolvedValue({
            ok: false,
            response: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            ),
        });

        const response = await getAttachment();

        expect(response.status).toBe(401);
        expect(prisma.leaveAttachment.findUnique).not.toHaveBeenCalled();
        expect(readLeaveAttachment).not.toHaveBeenCalled();
    });

    it("returns a safe 404 when the physical file is missing", async () => {
        mockWorkforce(10);
        vi.mocked(readLeaveAttachment).mockRejectedValue(
            Object.assign(new Error("private path is missing"), {
                code: "ENOENT",
            }),
        );

        const response = await getAttachment();
        const body = await response.text();

        expect(response.status).toBe(404);
        expect(body).not.toContain(STORAGE_KEY);
        expect(body).not.toContain("private path");
    });

    it("returns a safe 500 for another filesystem read error", async () => {
        mockWorkforce(10);
        vi.mocked(readLeaveAttachment).mockRejectedValue(
            Object.assign(new Error("private path permission denied"), {
                code: "EACCES",
            }),
        );
        const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);

        const response = await getAttachment();
        const body = await response.text();

        expect(response.status).toBe(500);
        expect(body).not.toContain(STORAGE_KEY);
        expect(body).not.toContain("private path");
        consoleError.mockRestore();
    });

    it("sets private inline response headers", async () => {
        mockWorkforce(10);

        const response = await getAttachment();

        expect(response.headers.get("Content-Type")).toBe("image/webp");
        expect(response.headers.get("Content-Disposition")).toBe("inline");
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("does not expose the storage key in a successful response", async () => {
        mockWorkforce(10);

        const response = await getAttachment();
        const body = Buffer.from(await response.arrayBuffer());

        expect(response.status).toBe(200);
        expect(body).toEqual(IMAGE);
        expect(body.toString("utf8")).not.toContain(STORAGE_KEY);
    });

    it("rejects path traversal in the route parameter before querying metadata", async () => {
        mockWorkforce(10);

        const response = await getAttachment("../private-file");

        expect(response.status).toBe(404);
        expect(prisma.leaveAttachment.findUnique).not.toHaveBeenCalled();
        expect(readLeaveAttachment).not.toHaveBeenCalled();
    });
});
