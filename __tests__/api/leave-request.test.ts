import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as submitLeaveRequest } from "@/app/api/leave/request/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { processOutbox } from "@/lib/services/outbox/processor";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("next-auth", () => ({
    getServerSession: vi.fn(),
}));

// Mock processOutbox
vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn(),
}));

// Mock getEmployeeIdFromUserId
vi.mock("@/lib/services/leave/get-employee-id", () => ({
    getEmployeeIdFromUserId: vi.fn(),
}));

// Mock Prisma
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
    },
}));

describe("POST /api/leave/request", () => {
    const mockUser = { id: "1", name: "Test User" };
    const mockEmployeeId = 100;

    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default mocks for a happy path partially
        (processOutbox as any).mockResolvedValue(undefined);
    });

    it("should return 401 if unauthorized", async () => {
        (getServerSession as any).mockResolvedValue(null);
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
        (getServerSession as any).mockResolvedValue({
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
        (getServerSession as any).mockResolvedValue({ user: mockUser });
        (getEmployeeIdFromUserId as any).mockResolvedValue(null);

        const req = new NextRequest("http://localhost/api/leave/request", {
            method: "POST",
            body: JSON.stringify({}),
        });

        const res = await submitLeaveRequest(req);
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toBe("ไม่พบข้อมูลพนักงานที่เชื่อมกับบัญชีนี้");
    });

    it("should return 400 for invalid input payload", async () => {
        (getServerSession as any).mockResolvedValue({ user: mockUser });
        (getEmployeeIdFromUserId as any).mockResolvedValue(mockEmployeeId);

        // Missing required fields
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
        (getServerSession as any).mockResolvedValue({ user: mockUser });
        (getEmployeeIdFromUserId as any).mockResolvedValue(mockEmployeeId);

        const payload = {
            leaveType: "SICK",
            startDate: "2030-01-01T00:00:00.000Z",
            endDate: "2030-01-02T00:00:00.000Z",
            period: "MORNING", // half-day spanning two days
            reason: "Sick leave",
        };

        const req = new NextRequest("http://localhost/api/leave/request", {
            method: "POST",
            body: JSON.stringify(payload),
        });

        const res = await submitLeaveRequest(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("ครึ่งวันสามารถลาได้เฉพาะวันเดียวเท่านั้น");
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
            (getServerSession as any).mockResolvedValue({ user: mockUser });
            (getEmployeeIdFromUserId as any).mockResolvedValue(mockEmployeeId);

            // Mock transaction to immediately execute its callback with the mocked prisma clients
            (prisma.$transaction as any).mockImplementation(
                async (callback: any) => {
                    return callback(prisma);
                },
            );
        });

        it("should throw error if employee record not found in transaction", async () => {
            (prisma.employee.findUnique as any).mockResolvedValue(null);

            const req = new NextRequest("http://localhost/api/leave/request", {
                method: "POST",
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe("Employee not found");
        });

        it("should throw error if employee has no managerId", async () => {
            (prisma.employee.findUnique as any).mockResolvedValue({
                id: mockEmployeeId,
                managerId: null,
            });

            const req = new NextRequest("http://localhost/api/leave/request", {
                method: "POST",
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe(
                "ไม่พบหัวหน้างานในระบบ กรุณาติดต่อแอดมินเพื่อตั้งค่าผู้อนุมัติ",
            );
        });

        it("should throw error if insufficient quota", async () => {
            // Employee with a manager
            (prisma.employee.findUnique as any).mockResolvedValue({
                id: mockEmployeeId,
                firstName: "A",
                lastName: "B",
                managerId: 200,
            });
            // 3. Mock overlap check to pass (no overlaps)
            (prisma.leaveRequest.findFirst as any).mockResolvedValue(null);

            // 4. Mock quota check
            (prisma.leaveQuota.findFirst as any).mockResolvedValue({
                id: 1,
                totalDays: 6,
                usedDays: 6,
            });

            // 5. Mock quota.update shouldn't be called if availableQuota check fails first
            // But we'll set it just in case
            (prisma.leaveQuota.update as any).mockResolvedValue({
                 id: 1,
                 totalDays: 6,
                 usedDays: 7, // Exceeds
            });

            const req = new NextRequest("http://localhost/api/leave/request", {
                method: "POST",
                body: JSON.stringify(validPayload), // 1 day requested
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(500);
            const data = await res.json();
            // 0 days remaining
            expect(data.error).toBe(
                "คุณมีโควตาวันลาคงเหลือเพียง 0 วัน",
            );
        });

        it("should throw error if requests overlap", async () => {
             (prisma.employee.findUnique as any).mockResolvedValue({
                id: mockEmployeeId,
                managerId: 200,
            });

            // Mock an existing overlap request
            (prisma.leaveRequest.findFirst as any).mockResolvedValue({
                id: 50,
                status: "APPROVED"
            });

            const req = new NextRequest("http://localhost/api/leave/request", {
                method: "POST",
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(500);
            const data = await res.json();
            
            expect(data.error).toBe("คุณมีคำขอลาในช่วงเวลานี้ที่กำลังรออนุมัติหรืออนุมัติแล้ว");
        });


        it("should complete successfully, creating default quota if none exists", async () => {
            (prisma.employee.findUnique as any).mockResolvedValue({
                id: mockEmployeeId,
                firstName: "A",
                lastName: "B",
                managerId: 200,
            });
            // No overlap
            (prisma.leaveRequest.findFirst as any).mockResolvedValue(null);

            // No existing quota
            (prisma.leaveQuota.findFirst as any).mockResolvedValue(null);

            // Mock created quota
            const newQuota = { id: 1, totalDays: 10, usedDays: 0 };
            (prisma.leaveQuota.create as any).mockResolvedValue(newQuota);
            const mockCreatedRequest = { id: 999 };
            (prisma.leaveRequest.create as any).mockResolvedValue(
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

            // Assertions
            expect(prisma.leaveQuota.create).toHaveBeenCalledWith({
                data: {
                    employeeId: mockEmployeeId,
                    year: 2030,
                    leaveType: "PERSONAL",
                    totalDays: 10, // DEFAULT_LEAVE_QUOTAS.PERSONAL
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
