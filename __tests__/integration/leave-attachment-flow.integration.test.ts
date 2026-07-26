import {
    createHash,
    randomUUID,
} from "node:crypto";
import {
    LeavePeriod,
    LeaveStatus,
    LeaveType,
} from "@prisma/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import sharp from "sharp";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import type * as NextServerModule from "next/server";

import { GET as readAttachment } from "@/app/api/leave/attachments/[attachmentId]/route";
import { POST as submitLeaveRequest } from "@/app/api/leave/request/route";
import { prisma } from "@/lib/db/prisma";
import { resetMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import {
    createLeaveAttachmentStorage,
    LeaveAttachmentValidationError,
    type StoredLeaveAttachment,
} from "@/lib/uploads/leave";
import type * as LeaveUploadsModule from "@/lib/uploads/leave";

const mocks = vi.hoisted(() => ({
    session: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    read: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: (callback: () => void): void => {
            callback();
        },
    };
});

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceSession: mocks.session,
    requireActiveWorkforceOrAdminSession: mocks.session,
}));

vi.mock("@/lib/uploads/leave", async (importOriginal) => {
    const actual = await importOriginal<typeof LeaveUploadsModule>();
    return {
        ...actual,
        saveLeaveAttachments: mocks.save,
        deleteLeaveAttachment: mocks.remove,
        readLeaveAttachment: mocks.read,
    };
});

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn().mockResolvedValue(undefined),
}));

const DEPARTMENT_NAME = "Leave Attachment Flow Integration";
const DEPARTMENT_CODE = "LEAVE-ATTACH-FLOW";
const REQUEST_DATE = "2031-05-05";

type Fixture = {
    ownerEmployeeId: number;
    approverEmployeeId: number;
    outsiderEmployeeId: number;
    ownerUserId: number;
    approverUserId: number;
    outsiderUserId: number;
    adminUserId: number;
};

type StoredFile = StoredLeaveAttachment;

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) {
        throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");
    }

    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (
        url.protocol !== "mysql:"
        || !/(?:_integration|_test)$/.test(databaseName)
    ) {
        throw new Error(
            "ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test",
        );
    }
}

async function cleanFixture(): Promise<void> {
    const department = await prisma.department.findUnique({
        where: { name: DEPARTMENT_NAME },
        select: { id: true },
    });
    if (!department) {
        return;
    }

    const employees = await prisma.employee.findMany({
        where: { departmentId: department.id },
        select: { id: true },
    });
    const employeeIds = employees.map(({ id }) => id);
    await prisma.leaveRequest.deleteMany({
        where: { employeeId: { in: employeeIds } },
    });
    await prisma.leaveQuota.deleteMany({
        where: { employeeId: { in: employeeIds } },
    });
    await prisma.employee.updateMany({
        where: { id: { in: employeeIds } },
        data: { managerId: null },
    });
    await prisma.user.deleteMany({
        where: {
            OR: [
                { employeeId: { in: employeeIds } },
                { email: "leave-flow-admin@integration.test" },
            ],
        },
    });
    await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
    await prisma.department.delete({ where: { id: department.id } });
    await prisma.notificationOutbox.deleteMany({ where: { type: "LEAVE_ACTION" } });
}

async function createFixture(): Promise<Fixture> {
    const department = await prisma.department.create({
        data: { name: DEPARTMENT_NAME, code: DEPARTMENT_CODE },
    });
    const approver = await prisma.employee.create({
        data: {
            firstName: "Stored",
            lastName: "Approver",
            email: "leave-flow-approver@integration.test",
            position: "Manager",
            departmentId: department.id,
        },
    });
    const owner = await prisma.employee.create({
        data: {
            firstName: "Leave",
            lastName: "Owner",
            email: "leave-flow-owner@integration.test",
            position: "Employee",
            departmentId: department.id,
            managerId: approver.id,
        },
    });
    const outsider = await prisma.employee.create({
        data: {
            firstName: "Other",
            lastName: "Employee",
            email: "leave-flow-outsider@integration.test",
            position: "Employee",
            departmentId: department.id,
        },
    });
    const [ownerUser, approverUser, outsiderUser, adminUser] = await Promise.all([
        prisma.user.create({
            data: {
                email: "leave-flow-owner-user@integration.test",
                name: "Leave Owner",
                password: "integration-only",
                employeeId: owner.id,
            },
        }),
        prisma.user.create({
            data: {
                email: "leave-flow-approver-user@integration.test",
                name: "Stored Approver",
                password: "integration-only",
                employeeId: approver.id,
            },
        }),
        prisma.user.create({
            data: {
                email: "leave-flow-outsider-user@integration.test",
                name: "Other Employee",
                password: "integration-only",
                employeeId: outsider.id,
            },
        }),
        prisma.user.create({
            data: {
                email: "leave-flow-admin@integration.test",
                name: "Leave Admin",
                password: "integration-only",
                role: "ADMIN",
            },
        }),
    ]);

    return {
        ownerEmployeeId: owner.id,
        approverEmployeeId: approver.id,
        outsiderEmployeeId: outsider.id,
        ownerUserId: ownerUser.id,
        approverUserId: approverUser.id,
        outsiderUserId: outsiderUser.id,
        adminUserId: adminUser.id,
    };
}

function mockUserSession(
    userId: number,
    role: "USER" | "ADMIN",
    employeeId?: number,
): void {
    mocks.session.mockResolvedValue({
        ok: true,
        session: { user: { id: userId, role } },
        user: {
            id: userId,
            role,
            email: `${role.toLowerCase()}@integration.test`,
            name: role,
        },
        ...(employeeId === undefined ? {} : { employeeId }),
    });
}

function createMultipartRequest(
    files: readonly File[] = [],
    idempotencyKey: string = randomUUID(),
): NextRequest {
    const formData = new FormData();
    formData.set("payload", JSON.stringify({
        leaveType: "PERSONAL",
        startDate: REQUEST_DATE,
        endDate: REQUEST_DATE,
        period: "FULL_DAY",
        reason: "Integration evidence request",
    }));
    files.forEach((file) => formData.append("attachments", file));
    return new NextRequest("http://localhost/api/leave/request", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: formData,
    });
}

function createFiles(count: number): File[] {
    return Array.from(
        { length: count },
        (_, index) => new File(
            [`fake-image-${index}`],
            `proof-${index}.jpg`,
            { type: "image/jpeg" },
        ),
    );
}

async function createStoredFiles(
    leaveRequestId: string,
    files: readonly File[],
): Promise<StoredFile[]> {
    return Promise.all(files.map(async (file, index) => ({
        storageKey: `leave/${leaveRequestId}/${String(index + 1).padStart(32, "0")}.webp`,
        originalName: file.name,
        contentType: "image/webp",
        contentSha256: createHash("sha256")
            .update(Buffer.from(await file.arrayBuffer()))
            .digest("hex"),
        sizeBytes: file.size,
        width: 32,
        height: 24,
    })));
}

async function submit(files: readonly File[] = []): Promise<{
    response: Response;
    body: { data?: { id?: string; attachments?: Array<{ id: string }> } };
}> {
    mockUserSession(
        fixture.ownerUserId,
        "USER",
        fixture.ownerEmployeeId,
    );
    const response = await submitLeaveRequest(createMultipartRequest(files));
    const body = await response.json() as {
        data?: { id?: string; attachments?: Array<{ id: string }> };
    };
    return { response, body };
}

async function readAttachmentAs(userId: number, role: "USER" | "ADMIN", employeeId?: number): Promise<Response> {
    mockUserSession(userId, role, employeeId);
    return readAttachment(
        new Request("http://localhost/api/leave/attachments/test"),
        { params: Promise.resolve({ attachmentId: attachmentIdForTest }) },
    );
}

let fixture: Fixture;
let attachmentIdForTest = "";

describe.sequential("leave attachment flow with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        resetMutationRateLimit();
        await cleanFixture();
        fixture = await createFixture();
        mocks.save.mockImplementation(
            async (input: { leaveRequestId: string; files: readonly File[] }) =>
                createStoredFiles(input.leaveRequestId, input.files),
        );
        mocks.remove.mockResolvedValue(undefined);
        mocks.read.mockResolvedValue(Buffer.from("private-webp"));
    });

    afterAll(async () => {
        await cleanFixture();
        await prisma.$disconnect();
    });

    it("runs the real Sharp/private-storage lifecycle on a temporary root", async () => {
        const storageRoot = await mkdtemp(
            path.join(tmpdir(), "leave-flow-storage-"),
        );
        try {
            const source = await sharp({
                create: {
                    width: 16,
                    height: 12,
                    channels: 3,
                    background: { r: 20, g: 80, b: 140 },
                },
            }).jpeg().toBuffer();
            const storage = createLeaveAttachmentStorage(storageRoot);
            const [stored] = await storage.save({
                leaveRequestId: "real-storage-request",
                files: [{
                    name: "proof.jpg",
                    type: "image/jpeg",
                    size: source.byteLength,
                    arrayBuffer: async () => Uint8Array.from(source).buffer,
                }],
            });

            expect(stored?.contentType).toBe("image/webp");
            expect(stored?.storageKey).toMatch(
                /^leave\/real-storage-request\/[a-f0-9]{32}\.webp$/,
            );
            await expect(storage.read(stored?.storageKey ?? "")).resolves.toBeInstanceOf(Buffer);
            await storage.delete(stored?.storageKey ?? "");
            await expect(storage.read(stored?.storageKey ?? "")).rejects.toMatchObject({
                code: "ENOENT",
            });
        } finally {
            await rm(storageRoot, { recursive: true, force: true });
        }
    });

    it("creates requests with zero, one, and three attachments", async () => {
        const withoutFiles = await submit();
        expect(withoutFiles.response.status).toBe(201);
        expect(withoutFiles.body.data?.attachments).toEqual([]);

        await cleanFixture();
        fixture = await createFixture();
        const oneFile = await submit(createFiles(1));
        expect(oneFile.response.status).toBe(201);
        expect(oneFile.body.data?.attachments).toHaveLength(1);

        await cleanFixture();
        fixture = await createFixture();
        const threeFiles = await submit(createFiles(3));
        expect(threeFiles.response.status).toBe(201);
        expect(threeFiles.body.data?.attachments).toHaveLength(3);
        expect(JSON.stringify(threeFiles.body)).not.toContain("storageKey");

        const [outbox] = await prisma.notificationOutbox.findMany({
            where: { type: "LEAVE_ACTION" },
            orderBy: { id: "desc" },
            take: 1,
            select: { payload: true },
        });
        expect(outbox).toBeDefined();
        expect(outbox?.payload).not.toContain("storageKey");
    });

    it("lets the owner, stored approver, and admin open evidence but not another employee", async () => {
        const result = await submit(createFiles(1));
        const attachmentId = result.body.data?.attachments?.[0]?.id;
        if (!attachmentId) {
            throw new Error("ไม่พบ attachment id จากคำขอลา");
        }
        attachmentIdForTest = attachmentId;

        const ownerResponse = await readAttachmentAs(
            fixture.ownerUserId,
            "USER",
            fixture.ownerEmployeeId,
        );
        const approverResponse = await readAttachmentAs(
            fixture.approverUserId,
            "USER",
            fixture.approverEmployeeId,
        );
        const outsiderResponse = await readAttachmentAs(
            fixture.outsiderUserId,
            "USER",
            fixture.outsiderEmployeeId,
        );
        const adminResponse = await readAttachmentAs(fixture.adminUserId, "ADMIN");

        expect(ownerResponse.status).toBe(200);
        expect(approverResponse.status).toBe(200);
        expect(outsiderResponse.status).toBe(404);
        expect(adminResponse.status).toBe(200);
        expect(approverResponse.headers.get("Cache-Control")).toBe("private, no-store");
        expect(approverResponse.headers.get("Content-Disposition")).toBe("inline");
        expect(approverResponse.headers.get("X-Content-Type-Options")).toBe("nosniff");

        await prisma.employee.update({
            where: { id: fixture.ownerEmployeeId },
            data: { managerId: fixture.outsiderEmployeeId },
        });
        const storedApproverAfterManagerChange = await readAttachmentAs(
            fixture.approverUserId,
            "USER",
            fixture.approverEmployeeId,
        );
        const newManagerResponse = await readAttachmentAs(
            fixture.outsiderUserId,
            "USER",
            fixture.outsiderEmployeeId,
        );
        expect(storedApproverAfterManagerChange.status).toBe(200);
        expect(newManagerResponse.status).toBe(404);
    });

    it("keeps evidence readable after rejection and cancellation", async () => {
        const result = await submit(createFiles(1));
        attachmentIdForTest = result.body.data?.attachments?.[0]?.id ?? "";
        const leaveId = result.body.data?.id;
        if (!attachmentIdForTest || !leaveId) {
            throw new Error("ไม่พบข้อมูลคำขอลาสำหรับ status test");
        }

        for (const status of [LeaveStatus.REJECTED, LeaveStatus.CANCELLED]) {
            await prisma.leaveRequest.update({
                where: { id: leaveId },
                data: { status },
            });
            const response = await readAttachmentAs(
                fixture.ownerUserId,
                "USER",
                fixture.ownerEmployeeId,
            );
            expect(response.status).toBe(200);
        }
    });

    it("returns a safe 404 when the physical file is missing", async () => {
        const result = await submit(createFiles(1));
        attachmentIdForTest = result.body.data?.attachments?.[0]?.id ?? "";
        mocks.read.mockRejectedValueOnce(
            Object.assign(new Error("missing"), { code: "ENOENT" }),
        );

        const response = await readAttachmentAs(
            fixture.ownerUserId,
            "USER",
            fixture.ownerEmployeeId,
        );

        expect(response.status).toBe(404);
        await expect(response.text()).resolves.toBe("{\"error\":\"Not found\"}");
    });

    it("does not persist a request when upload validation fails", async () => {
        const beforeCount = await prisma.leaveRequest.count({
            where: { employeeId: fixture.ownerEmployeeId },
        });
        mocks.save.mockRejectedValueOnce(
            new LeaveAttachmentValidationError("ไฟล์หลักฐานไม่ถูกต้อง"),
        );

        const result = await submit(createFiles(1));
        const afterCount = await prisma.leaveRequest.count({
            where: { employeeId: fixture.ownerEmployeeId },
        });

        expect(result.response.status).toBe(400);
        expect(afterCount).toBe(beforeCount);
        expect(mocks.remove).not.toHaveBeenCalled();
    });

    it("cleans up files when the transaction cannot persist attachment metadata", async () => {
        const conflictKey =
            "leave/conflict-request/0123456789abcdef0123456789abcdef.webp";
        await prisma.leaveRequest.create({
            data: {
                id: "conflict-request",
                employeeId: fixture.outsiderEmployeeId,
                leaveType: LeaveType.SICK,
                startDate: new Date("2032-05-05T00:00:00.000Z"),
                endDate: new Date("2032-05-05T00:00:00.000Z"),
                period: LeavePeriod.FULL_DAY,
                durationHalfDays: 2,
                reason: "Conflict fixture",
                status: LeaveStatus.CANCELLED,
                attachments: {
                    create: {
                        storageKey: conflictKey,
                        originalName: "conflict.jpg",
                        contentType: "image/webp",
                        sizeBytes: 1,
                        width: 1,
                        height: 1,
                    },
                },
            },
        });
        mocks.save.mockResolvedValueOnce([{
            storageKey: conflictKey,
            originalName: "new.jpg",
            contentType: "image/webp",
            contentSha256: "0".repeat(64),
            sizeBytes: 1,
            width: 1,
            height: 1,
        } satisfies StoredFile]);

        const result = await submit(createFiles(1));

        expect(result.response.status).toBe(500);
        expect(mocks.remove).toHaveBeenCalledWith(conflictKey);
    });
});
