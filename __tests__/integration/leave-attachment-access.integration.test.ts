import {
    LeavePeriod,
    LeaveStatus,
    LeaveType,
} from "@prisma/client";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import { GET } from "@/app/api/leave/attachments/[attachmentId]/route";
import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { prisma } from "@/lib/db/prisma";
import { readLeaveAttachment } from "@/lib/uploads/leave";
import type * as LeaveUploadsModule from "@/lib/uploads/leave";

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceOrAdminSession: vi.fn(),
}));

vi.mock("@/lib/uploads/leave", async (importOriginal) => {
    const actual = await importOriginal<typeof LeaveUploadsModule>();
    return {
        ...actual,
        readLeaveAttachment: vi.fn(),
    };
});

const DEPARTMENT_NAME = "Leave Attachment Integration";
const DEPARTMENT_CODE = "LEAVE-ATTACH-INTEGRATION";
const STORAGE_KEY =
    "leave/integration-request/0123456789abcdef0123456789abcdef.webp";
const IMAGE = Buffer.from("integration-private-webp");

type Fixture = {
    attachmentId: string;
    ownerId: number;
    approverId: number;
    outsiderId: number;
};

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

    await prisma.leaveRequest.deleteMany({
        where: { employee: { departmentId: department.id } },
    });
    await prisma.employee.deleteMany({
        where: { departmentId: department.id },
    });
    await prisma.department.delete({ where: { id: department.id } });
}

async function createFixture(): Promise<Fixture> {
    const department = await prisma.department.create({
        data: {
            name: DEPARTMENT_NAME,
            code: DEPARTMENT_CODE,
        },
    });
    const [owner, approver, outsider] = await Promise.all([
        prisma.employee.create({
            data: {
                firstName: "Owner",
                lastName: "Integration",
                email: "leave-owner@integration.test",
                position: "Employee",
                departmentId: department.id,
            },
        }),
        prisma.employee.create({
            data: {
                firstName: "Approver",
                lastName: "Integration",
                email: "leave-approver@integration.test",
                position: "Manager",
                departmentId: department.id,
            },
        }),
        prisma.employee.create({
            data: {
                firstName: "Outsider",
                lastName: "Integration",
                email: "leave-outsider@integration.test",
                position: "Manager",
                departmentId: department.id,
            },
        }),
    ]);
    const leaveRequest = await prisma.leaveRequest.create({
        data: {
            employeeId: owner.id,
            approverId: approver.id,
            leaveType: LeaveType.SICK,
            startDate: new Date("2031-05-05T00:00:00.000Z"),
            endDate: new Date("2031-05-05T00:00:00.000Z"),
            period: LeavePeriod.FULL_DAY,
            durationHalfDays: 2,
            reason: "Integration attachment access",
            status: LeaveStatus.PENDING,
            attachments: {
                create: {
                    storageKey: STORAGE_KEY,
                    originalName: "proof.jpg",
                    contentType: "image/webp",
                    sizeBytes: IMAGE.byteLength,
                    width: 32,
                    height: 24,
                },
            },
        },
        select: {
            attachments: {
                select: { id: true },
            },
        },
    });
    const attachment = leaveRequest.attachments[0];
    if (!attachment) {
        throw new Error("สร้าง fixture หลักฐานการลาไม่สำเร็จ");
    }

    return {
        attachmentId: attachment.id,
        ownerId: owner.id,
        approverId: approver.id,
        outsiderId: outsider.id,
    };
}

function mockWorkforce(employeeId: number): void {
    vi.mocked(requireActiveWorkforceOrAdminSession).mockResolvedValue({
        ok: true,
        session: { user: { id: "1", role: "USER" } },
        user: {
            id: 1,
            role: "USER",
            email: "integration@example.com",
            name: "Integration",
        },
        employeeId,
    });
}

function mockAdmin(): void {
    vi.mocked(requireActiveWorkforceOrAdminSession).mockResolvedValue({
        ok: true,
        session: { user: { id: "1", role: "ADMIN" } },
        user: {
            id: 1,
            role: "ADMIN",
            email: "admin@integration.test",
            name: "Admin",
        },
    });
}

async function requestAttachment(attachmentId: string): Promise<Response> {
    return GET(
        new Request(
            `http://localhost/api/leave/attachments/${attachmentId}`,
        ),
        { params: Promise.resolve({ attachmentId }) },
    );
}

describe.sequential("leave attachment access with real MySQL", () => {
    let fixture: Fixture;

    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        await cleanFixture();
        fixture = await createFixture();
        vi.mocked(readLeaveAttachment).mockResolvedValue(IMAGE);
    });

    afterAll(async () => {
        await cleanFixture();
        await prisma.$disconnect();
    });

    it("authorizes owner and stored approver from persisted relations", async () => {
        mockWorkforce(fixture.ownerId);
        const ownerResponse = await requestAttachment(fixture.attachmentId);

        mockWorkforce(fixture.approverId);
        const approverResponse = await requestAttachment(fixture.attachmentId);

        expect(ownerResponse.status).toBe(200);
        expect(approverResponse.status).toBe(200);
    });

    it("authorizes an admin and conceals the record from another employee", async () => {
        mockAdmin();
        const adminResponse = await requestAttachment(fixture.attachmentId);

        mockWorkforce(fixture.outsiderId);
        const outsiderResponse = await requestAttachment(fixture.attachmentId);

        expect(adminResponse.status).toBe(200);
        expect(outsiderResponse.status).toBe(404);
    });
});
