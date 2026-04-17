import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as submitLeaveRequest } from "@/app/api/leave/request/route";
import { getApiAuthSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { processOutbox } from "@/lib/services/outbox/processor";
import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: vi.fn((callback) => {
            callback();
        }),
    };
});

vi.mock("@/lib/server-auth", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn(),
}));

vi.mock("@/lib/services/leave/get-employee-id", () => ({
    getEmployeeIdFromUserId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
        employee: {
            findUnique: vi.fn(),
        },
        leaveQuota: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        leaveRequest: {
            create: vi.fn(),
            findFirst: vi.fn(),
        },
        notificationOutbox: {
            create: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    },
}));

describe("POST /api/leave/request", () => {
    const mockUser = { id: "1", name: "Test User" };
    const mockEmployeeId = 100;

    beforeEach(() => {
        vi.clearAllMocks();
        (processOutbox as unknown as { mockResolvedValue: (v: undefined) => void }).mockResolvedValue(undefined);
    });

    it("should return 401 if unauthorized", async () => {
        (getApiAuthSession as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);
        const req = new NextRequest("http://localhost/api/leave/request", {
            method: "POST",
            body: JSON.stringify({}),
        });

        const res = await submitLeaveRequest(req);
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 if user ID is invalid", async () => {
        (getApiAuthSession as unknown as { mockResolvedValue: (v: { user: { id: string } }) => void }).mockResolvedValue({
            user: { id: "not-a-number" },
        });
        const req = new NextRequest("http://localhost/api/leave/request", {
            method: "POST",
            body: JSON.stringify({}),
        });

        const res = await submitLeaveRequest(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("Invalid user ID");
    });

    it("should return 404 if employee not found for the user", async () => {
        (getApiAuthSession as unknown as { mockResolvedValue: (v: { user: { id: string; name: string } }) => void }).mockResolvedValue({ user: mockUser });
        (getEmployeeIdFromUserId as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);

        const req = new NextRequest("http://localhost/api/leave/request", {
            method: "POST",
            body: JSON.stringify({}),
        });

        const res = await submitLeaveRequest(req);
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(typeof data.error).toBe("string");
        expect(data.error.length).toBeGreaterThan(0);
    });

    it("should return 400 for invalid input payload", async () => {
        (getApiAuthSession as unknown as { mockResolvedValue: (v: { user: { id: string; name: string } }) => void }).mockResolvedValue({ user: mockUser });
        (getEmployeeIdFromUserId as unknown as { mockResolvedValue: (v: number) => void }).mockResolvedValue(mockEmployeeId);

        const req = new NextRequest("http://localhost/api/leave/request", {
            method: "POST",
            body: JSON.stringify({ leaveType: "INVALID" }),
        });

        const res = await submitLeaveRequest(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("Invalid input");
        expect(data.details).toBeDefined();
    });

    it("should return 400 if half-day period spans multiple days", async () => {
        (getApiAuthSession as unknown as { mockResolvedValue: (v: { user: { id: string; name: string } }) => void }).mockResolvedValue({ user: mockUser });
        (getEmployeeIdFromUserId as unknown as { mockResolvedValue: (v: number) => void }).mockResolvedValue(mockEmployeeId);

        const payload = {
            leaveType: "SICK",
            startDate: "2030-01-01T00:00:00.000Z",
            endDate: "2030-01-02T00:00:00.000Z",
            period: "MORNING",
            reason: "Sick leave",
        };

        const req = new NextRequest("http://localhost/api/leave/request", {
            method: "POST",
            body: JSON.stringify(payload),
        });

        const res = await submitLeaveRequest(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("การลาครึ่งวันต้องเลือกวันลาเพียงวันเดียว");
    });

    it("should return 400 if full-day leave range includes weekend", async () => {
        (getApiAuthSession as unknown as { mockResolvedValue: (v: { user: { id: string; name: string } }) => void }).mockResolvedValue({ user: mockUser });
        (getEmployeeIdFromUserId as unknown as { mockResolvedValue: (v: number) => void }).mockResolvedValue(mockEmployeeId);

        const payload = {
            leaveType: "SICK",
            startDate: "2030-05-10T00:00:00.000Z", // Friday
            endDate: "2030-05-11T00:00:00.000Z",   // Saturday
            period: "FULL_DAY",
            reason: "Weekend overlap",
        };

        const req = new NextRequest("http://localhost/api/leave/request", {
            method: "POST",
            body: JSON.stringify(payload),
        });

        const res = await submitLeaveRequest(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("วันที่ลาตรงกับวันหยุด");
    });

    it("should allow full-day leave that crosses weekend in the middle", async () => {
        (getApiAuthSession as unknown as { mockResolvedValue: (v: { user: { id: string; name: string } }) => void }).mockResolvedValue({ user: mockUser });
        (getEmployeeIdFromUserId as unknown as { mockResolvedValue: (v: number) => void }).mockResolvedValue(mockEmployeeId);
        (
            prisma.$transaction as unknown as { mockImplementation: (fn: (arg: unknown) => Promise<unknown>) => void }
        ).mockImplementation(async (arg: unknown) => {
            if (typeof arg === "function") {
                const callback = arg as (tx: typeof prisma) => Promise<unknown>;
                return callback(prisma);
            }
            return Promise.resolve(arg);
        });

        (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: { id: number; firstName: string; lastName: string; managerId: number }) => void }).mockResolvedValue({
            id: mockEmployeeId,
            firstName: "A",
            lastName: "B",
            managerId: 200,
        });
        (prisma.leaveRequest.findFirst as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);
        (prisma.leaveQuota.findFirst as unknown as { mockResolvedValue: (v: { id: number; totalDays: number; usedDays: number }) => void }).mockResolvedValue({
            id: 1,
            totalDays: 10,
            usedDays: 0,
        });
        (prisma.leaveRequest.create as unknown as { mockResolvedValue: (v: { id: number }) => void }).mockResolvedValue({ id: 123 });

        const payload = {
            leaveType: "SICK",
            startDate: "2030-05-10T00:00:00.000Z", // Friday
            endDate: "2030-05-13T00:00:00.000Z",   // Monday
            period: "FULL_DAY",
            reason: "Cross weekend",
        };

        const req = new NextRequest("http://localhost/api/leave/request", {
            method: "POST",
            body: JSON.stringify(payload),
        });

        const res = await submitLeaveRequest(req);
        expect(res.status).toBe(201);
        expect(prisma.leaveRequest.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                durationDays: 2,
            }),
        });
    });

    describe("Transaction Logic", () => {
        const validPayload = {
            leaveType: "PERSONAL",
            startDate: "2030-05-10T00:00:00.000Z",
            endDate: "2030-05-10T00:00:00.000Z",
            period: "FULL_DAY",
            reason: "Personal errand",
        };

        beforeEach(() => {
            (getApiAuthSession as unknown as { mockResolvedValue: (v: { user: { id: string; name: string } }) => void }).mockResolvedValue({ user: mockUser });
            (getEmployeeIdFromUserId as unknown as { mockResolvedValue: (v: number) => void }).mockResolvedValue(mockEmployeeId);
            (
                prisma.$transaction as unknown as { mockImplementation: (fn: (arg: unknown) => Promise<unknown>) => void }
            ).mockImplementation(async (arg: unknown) => {
                if (typeof arg === "function") {
                    const callback = arg as (tx: typeof prisma) => Promise<unknown>;
                    return callback(prisma);
                }
                return Promise.resolve(arg);
            });
        });

        it("should throw error if employee record not found in transaction", async () => {
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);

            const req = new NextRequest("http://localhost/api/leave/request", {
                method: "POST",
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(404);
            const data = await res.json();
            expect(data.error).toBe("ไม่พบข้อมูลพนักงาน");
        });

        it("should throw error if employee has no managerId", async () => {
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: { id: number; managerId: null }) => void }).mockResolvedValue({
                id: mockEmployeeId,
                managerId: null,
            });

            const req = new NextRequest("http://localhost/api/leave/request", {
                method: "POST",
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe("ยังไม่ได้ตั้งค่าผู้อนุมัติ");
        });

        it("should throw error if insufficient quota", async () => {
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: { id: number; firstName: string; lastName: string; managerId: number }) => void }).mockResolvedValue({
                id: mockEmployeeId,
                firstName: "A",
                lastName: "B",
                managerId: 200,
            });
            (prisma.leaveRequest.findFirst as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);
            (prisma.leaveQuota.findFirst as unknown as { mockResolvedValue: (v: { id: number; totalDays: number; usedDays: number }) => void }).mockResolvedValue({
                id: 1,
                totalDays: 6,
                usedDays: 6,
            });

            const req = new NextRequest("http://localhost/api/leave/request", {
                method: "POST",
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe("สิทธิ์ลาคงเหลือไม่เพียงพอ");
        });

        it("should throw error if requests overlap", async () => {
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: { id: number; managerId: number }) => void }).mockResolvedValue({
                id: mockEmployeeId,
                managerId: 200,
            });
            (prisma.leaveRequest.findFirst as unknown as { mockResolvedValue: (v: { id: number; status: string }) => void }).mockResolvedValue({
                id: 50,
                status: "APPROVED",
            });

            const req = new NextRequest("http://localhost/api/leave/request", {
                method: "POST",
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(409);
            const data = await res.json();
            expect(data.error).toBe("มีคำขอลาในช่วงวันที่นี้อยู่แล้ว");
        });

        it("should complete successfully, creating default quota if none exists", async () => {
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: { id: number; firstName: string; lastName: string; managerId: number }) => void }).mockResolvedValue({
                id: mockEmployeeId,
                firstName: "A",
                lastName: "B",
                managerId: 200,
            });
            (prisma.leaveRequest.findFirst as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);
            (prisma.leaveQuota.findFirst as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);
            (prisma.leaveQuota.create as unknown as { mockResolvedValue: (v: { id: number; totalDays: number; usedDays: number }) => void }).mockResolvedValue({
                id: 1,
                totalDays: 10,
                usedDays: 0,
            });

            const mockCreatedRequest = { id: 999 };
            (prisma.leaveRequest.create as unknown as { mockResolvedValue: (v: { id: number }) => void }).mockResolvedValue(
                mockCreatedRequest,
            );

            const req = new NextRequest("http://localhost/api/leave/request", {
                method: "POST",
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(201);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockCreatedRequest);

            expect(prisma.leaveQuota.create).toHaveBeenCalledWith({
                data: {
                    employeeId: mockEmployeeId,
                    year: 2030,
                    leaveType: "PERSONAL",
                    totalDays: 10,
                    usedDays: 0,
                },
            });
            expect(prisma.leaveRequest.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    employeeId: mockEmployeeId,
                    leaveType: "PERSONAL",
                    period: "FULL_DAY",
                    durationDays: 1,
                    reason: "Personal errand",
                    status: "PENDING",
                    approverId: 200,
                }),
            });

            expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    type: "LEAVE_ACTION",
                }),
            });
            expect(processOutbox).toHaveBeenCalled();
        });
    });
});
