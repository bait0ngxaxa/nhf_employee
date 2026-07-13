import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST as submitLeaveRequest } from "@/app/api/leave/request/route";
import { getApiAuthSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
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

vi.mock("@/lib/auth/server", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn(),
}));

vi.mock("@/lib/services/leave/get-employee-id", () => ({
    getEmployeeIdFromUserId: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
        user: { findUnique: vi.fn() },
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
    const mockManager = {
        id: 200,
        firstName: "Manager",
        lastName: "User",
        email: "manager@example.com",
        user: { id: 2, email: "manager-account@thainhf.org", isActive: true },
    };

    const buildEmployeeWithManager = () => ({
        id: mockEmployeeId,
        firstName: "A",
        lastName: "B",
        email: "employee@example.com",
        managerId: mockManager.id,
        user: { id: 1 },
        manager: mockManager,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            employee: { id: mockEmployeeId, status: "ACTIVE", deletedAt: null },
        } as never);
        (processOutbox as unknown as { mockResolvedValue: (v: undefined) => void }).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
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
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            employee: null,
        } as never);

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

    it("should reject timestamp dates for a half-day request before starting a transaction", async () => {
        (getApiAuthSession as unknown as { mockResolvedValue: (v: { user: { id: string; name: string } }) => void }).mockResolvedValue({ user: mockUser });
        (getEmployeeIdFromUserId as unknown as { mockResolvedValue: (v: number) => void }).mockResolvedValue(mockEmployeeId);

        const req = new NextRequest("http://localhost/api/leave/request", {
            method: "POST",
            body: JSON.stringify({
                leaveType: "SICK",
                startDate: "2030-05-10T00:00:00.000Z",
                endDate: "2030-05-10T12:00:00.000Z",
                period: "MORNING",
                reason: "Valid reason",
            }),
        });

        const res = await submitLeaveRequest(req);

        expect(res.status).toBe(400);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should return 400 if half-day period spans multiple days", async () => {
        (getApiAuthSession as unknown as { mockResolvedValue: (v: { user: { id: string; name: string } }) => void }).mockResolvedValue({ user: mockUser });
        (getEmployeeIdFromUserId as unknown as { mockResolvedValue: (v: number) => void }).mockResolvedValue(mockEmployeeId);

        const payload = {
            leaveType: "SICK",
            startDate: "2030-01-01",
            endDate: "2030-01-02",
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
            startDate: "2030-05-10", // Friday
            endDate: "2030-05-11",   // Saturday
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

        (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: ReturnType<typeof buildEmployeeWithManager>) => void }).mockResolvedValue(buildEmployeeWithManager());
        (prisma.leaveRequest.findFirst as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);
        (prisma.leaveQuota.findFirst as unknown as { mockResolvedValue: (v: { id: number; totalDays: number; usedDays: number }) => void }).mockResolvedValue({
            id: 1,
            totalDays: 10,
            usedDays: 0,
        });
        (prisma.leaveRequest.create as unknown as { mockResolvedValue: (v: { id: number }) => void }).mockResolvedValue({ id: 123 });

        const payload = {
            leaveType: "SICK",
            startDate: "2030-05-10", // Friday
            endDate: "2030-05-13",   // Monday
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
            startDate: "2030-05-10",
            endDate: "2030-05-10",
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
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: { id: number; managerId: null; manager: null }) => void }).mockResolvedValue({
                id: mockEmployeeId,
                managerId: null,
                manager: null,
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
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: ReturnType<typeof buildEmployeeWithManager>) => void }).mockResolvedValue(buildEmployeeWithManager());
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
            expect(data.error).toBe("กรุณาระบุเหตุผลพิเศษสำหรับการลาเกินโควต้า");
        });

        it("should allow insufficient quota with special reason", async () => {
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: ReturnType<typeof buildEmployeeWithManager>) => void }).mockResolvedValue(buildEmployeeWithManager());
            (prisma.leaveRequest.findFirst as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);
            (prisma.leaveQuota.findFirst as unknown as { mockResolvedValue: (v: { id: number; totalDays: number; usedDays: number }) => void }).mockResolvedValue({
                id: 1,
                totalDays: 6,
                usedDays: 6,
            });
            (prisma.leaveRequest.create as unknown as { mockResolvedValue: (v: { id: number }) => void }).mockResolvedValue({ id: 123 });

            const req = new NextRequest("http://localhost/api/leave/request", {
                method: "POST",
                body: JSON.stringify({
                    ...validPayload,
                    specialReason: "กรณีพิเศษที่หัวหน้าควรพิจารณา",
                }),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(201);
            expect(prisma.leaveRequest.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    overQuotaDays: 1,
                    specialReason: "กรณีพิเศษที่หัวหน้าควรพิจารณา",
                }),
            });
        });

        it("should enqueue and process emergency backdated leave notification", async () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2030-05-15T12:00:00.000Z"));

            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: ReturnType<typeof buildEmployeeWithManager>) => void }).mockResolvedValue(buildEmployeeWithManager());
            (prisma.leaveRequest.findFirst as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);
            (prisma.leaveQuota.findFirst as unknown as { mockResolvedValue: (v: { id: number; totalDays: number; usedDays: number }) => void }).mockResolvedValue({
                id: 1,
                totalDays: 10,
                usedDays: 0,
            });
            (prisma.leaveRequest.create as unknown as { mockResolvedValue: (v: { id: string }) => void }).mockResolvedValue({ id: "leave-backdated-1" });

            const req = new NextRequest("http://localhost/api/leave/request", {
                method: "POST",
                body: JSON.stringify({
                    leaveType: "SICK",
                    startDate: "2030-05-13",
                    endDate: "2030-05-13",
                    period: "FULL_DAY",
                    reason: "ลาป่วยฉุกเฉิน",
                    emergencyReason: "ป่วยฉุกเฉินจนยื่นคำขอไม่ทัน",
                }),
            });

            const res = await submitLeaveRequest(req);

            expect(res.status).toBe(201);
            expect(prisma.leaveRequest.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    emergencyReason: "ป่วยฉุกเฉินจนยื่นคำขอไม่ทัน",
                    status: "PENDING",
                    approverId: 200,
                }),
            });
            const createCall = vi.mocked(prisma.notificationOutbox.create).mock.calls[0]?.[0];
            const payload = JSON.parse(String(createCall?.data.payload)) as Record<string, unknown>;
            expect(createCall).toEqual({
                data: expect.objectContaining({
                    type: "LEAVE_ACTION",
                    payload: expect.any(String),
                }),
            });
            expect(payload.emergencyReason).toBe("ป่วยฉุกเฉินจนยื่นคำขอไม่ทัน");
            expect(processOutbox).toHaveBeenCalled();
        });

        it("should throw error if requests overlap", async () => {
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: ReturnType<typeof buildEmployeeWithManager>) => void }).mockResolvedValue(buildEmployeeWithManager());
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

        it("should retry a write conflict and return overlap conflict", async () => {
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: ReturnType<typeof buildEmployeeWithManager>) => void }).mockResolvedValue(buildEmployeeWithManager());
            (prisma.leaveRequest.findFirst as unknown as { mockResolvedValue: (v: { id: string; status: string }) => void }).mockResolvedValue({
                id: "existing-leave-request",
                status: "PENDING",
            });
            (
                prisma.$transaction as unknown as {
                    mockRejectedValueOnce: (value: unknown) => {
                        mockImplementationOnce: (
                            implementation: (callback: (tx: typeof prisma) => Promise<unknown>) => Promise<unknown>,
                        ) => void;
                    };
                }
            )
                .mockRejectedValueOnce({ code: "P2034" })
                .mockImplementationOnce(async (callback) => callback(prisma));

            const req = new NextRequest("http://localhost/api/leave/request", {
                method: "POST",
                body: JSON.stringify(validPayload),
            });
            const res = await submitLeaveRequest(req);

            expect(res.status).toBe(409);
            expect(prisma.$transaction).toHaveBeenCalledTimes(2);
            expect(prisma.$transaction).toHaveBeenLastCalledWith(
                expect.any(Function),
                expect.objectContaining({ isolationLevel: "Serializable" }),
            );
        });

        it("should complete successfully, creating default quota if none exists", async () => {
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: ReturnType<typeof buildEmployeeWithManager>) => void }).mockResolvedValue(buildEmployeeWithManager());
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
