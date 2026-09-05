// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST as submitLeaveRequest } from "@/app/api/leave/request/route";
import { getApiAuthSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { processOutbox } from "@/lib/services/outbox/processor";
import { resetMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";
import type * as LeaveModule from "@/modules/leave";
import { formatAuditLogDisplay } from "@/lib/audit-log/display";

const uploadMocks = vi.hoisted(() => ({
    save: vi.fn(),
    delete: vi.fn(),
}));

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

vi.mock("@/modules/leave", async (importOriginal) => {
    const actual = await importOriginal<typeof LeaveModule>();
    return {
        ...actual,
        handleLeaveRequestSubmission: (
            request: Parameters<typeof actual.handleLeaveRequestSubmission>[0],
            actor: Parameters<typeof actual.handleLeaveRequestSubmission>[1],
            buildAttachmentUrl: Parameters<typeof actual.handleLeaveRequestSubmission>[2],
            serializeResponse: Parameters<typeof actual.handleLeaveRequestSubmission>[3],
            scheduleOutbox: Parameters<typeof actual.handleLeaveRequestSubmission>[4],
        ) => actual.handleLeaveRequestSubmission(
            request,
            actor,
            buildAttachmentUrl,
            serializeResponse,
            scheduleOutbox,
            {
                saveLeaveAttachments: uploadMocks.save,
                deleteLeaveAttachment: uploadMocks.delete,
            },
        ),
    };
});

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
        $queryRaw: vi.fn(),
        user: { findUnique: vi.fn(), findFirst: vi.fn() },
        employee: {
            findUnique: vi.fn(),
        },
        leaveQuota: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
        },
        leaveRequest: {
            create: vi.fn(),
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
        leaveRequestIdempotency: {
            create: vi.fn(),
            findUnique: vi.fn(),
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
    const testIdempotencyKey = "leave-request-test-key";
    const mockUser = { id: "1", name: "Test User" };
    const mockEmployeeId = 100;
    const mockManager = {
        id: 200,
        firstName: "Manager",
        lastName: "User",
        email: "manager@example.com",
        status: "ACTIVE",
        deletedAt: null,
        user: {
            id: 2,
            email: "manager-account@thainhf.org",
            isActive: true,
            deletedAt: null,
        },
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

    function createLeaveRequestRequest(
        init: ConstructorParameters<typeof NextRequest>[1] = {},
    ): NextRequest {
        const headers = new Headers(init.headers);
        if (!headers.has("Idempotency-Key")) {
            headers.set("Idempotency-Key", testIdempotencyKey);
        }
        return new NextRequest(
            "http://localhost/api/leave/request",
            { ...init, headers },
        );
    }

    beforeEach(() => {
        vi.clearAllMocks();
        resetMutationRateLimit();
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            employee: { id: mockEmployeeId, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 1 } as never);
        vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.leaveQuota.findMany).mockResolvedValue([]);
        vi.mocked(prisma.leaveRequestIdempotency.findUnique).mockResolvedValue(null);
        uploadMocks.save.mockResolvedValue([]);
        uploadMocks.delete.mockResolvedValue(undefined);
        (processOutbox as unknown as { mockResolvedValue: (v: undefined) => void }).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should return 401 if unauthorized", async () => {
        (getApiAuthSession as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);
        const req = createLeaveRequestRequest({
            method: "POST",
            body: JSON.stringify({}),
        });

        const res = await submitLeaveRequest(req);
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe("Unauthorized");
    });

    it("requires an Idempotency-Key for a valid leave payload", async () => {
        (getApiAuthSession as unknown as { mockResolvedValue: (v: { user: { id: string; name: string } }) => void }).mockResolvedValue({ user: mockUser });

        const req = new NextRequest("http://localhost/api/leave/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                leaveType: "PERSONAL",
                startDate: "2030-05-10",
                endDate: "2030-05-10",
                period: "FULL_DAY",
                reason: "Personal errand",
            }),
        });

        const res = await submitLeaveRequest(req);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
            error: "กรุณาระบุ Idempotency-Key ที่ถูกต้อง",
        });
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects an oversized request before authenticating", async () => {
        const req = createLeaveRequestRequest({
            method: "POST",
            headers: {
                "Content-Type": "multipart/form-data; boundary=test",
                "Content-Length": String(25_000_001),
            },
        });

        const res = await submitLeaveRequest(req);

        expect(res.status).toBe(413);
        expect(getApiAuthSession).not.toHaveBeenCalled();
    });

    it("should return 400 if user ID is invalid", async () => {
        (getApiAuthSession as unknown as { mockResolvedValue: (v: { user: { id: string } }) => void }).mockResolvedValue({
            user: { id: "not-a-number" },
        });
        const req = createLeaveRequestRequest({
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
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            employee: null,
        } as never);

        const req = createLeaveRequestRequest({
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

        const req = createLeaveRequestRequest({
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

        const req = createLeaveRequestRequest({
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

        const payload = {
            leaveType: "SICK",
            startDate: "2030-01-01",
            endDate: "2030-01-02",
            period: "MORNING",
            reason: "Sick leave",
        };

        const req = createLeaveRequestRequest({
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

        const payload = {
            leaveType: "SICK",
            startDate: "2030-05-10", // Friday
            endDate: "2030-05-11",   // Saturday
            period: "FULL_DAY",
            reason: "Weekend overlap",
        };

        const req = createLeaveRequestRequest({
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
        (prisma.leaveQuota.upsert as unknown as { mockResolvedValue: (v: { id: number; totalHalfDays: number; carryBalanceHalfDays: number; usedHalfDays: number }) => void }).mockResolvedValue({
            id: 1,
            totalHalfDays: 60,
            carryBalanceHalfDays: 0,
            usedHalfDays: 0,
        });
        (prisma.leaveRequest.create as unknown as { mockResolvedValue: (v: { id: number; durationHalfDays: number; overQuotaHalfDays: number; approvalActionVersion: number }) => void }).mockResolvedValue({
            id: 123,
            durationHalfDays: 4,
            overQuotaHalfDays: 0,
            approvalActionVersion: 1,
        });

        const payload = {
            leaveType: "SICK",
            startDate: "2030-05-10", // Friday
            endDate: "2030-05-13",   // Monday
            period: "FULL_DAY",
            reason: "Cross weekend",
        };

        const req = createLeaveRequestRequest({
            method: "POST",
            body: JSON.stringify(payload),
        });

        const res = await submitLeaveRequest(req);
        expect(res.status).toBe(201);
        expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    durationHalfDays: 4,
                }),
            }),
        );
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

            const req = createLeaveRequestRequest({
                method: "POST",
                headers: { "Content-Type": "application/json" },
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

            const req = createLeaveRequestRequest({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe("ยังไม่ได้ตั้งค่าผู้อนุมัติ");
        });

        it.each([
            ["inactive", { status: "INACTIVE" }],
            ["deleted", { deletedAt: new Date("2030-01-01T00:00:00.000Z") }],
        ])("rejects a %s manager even when its user account is active", async (_label, state) => {
            (prisma.employee.findUnique as unknown as {
                mockResolvedValue: (value: ReturnType<typeof buildEmployeeWithManager>) => void;
            }).mockResolvedValue({
                ...buildEmployeeWithManager(),
                manager: { ...mockManager, ...state },
            } as never);

            const req = createLeaveRequestRequest({
                method: "POST",
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);

            expect(res.status).toBe(400);
            await expect(res.json()).resolves.toMatchObject({
                error: "ผู้อนุมัติยังไม่มีบัญชีผู้ใช้ในระบบ",
            });
            expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
        });

        it("should throw error if insufficient quota", async () => {
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: ReturnType<typeof buildEmployeeWithManager>) => void }).mockResolvedValue(buildEmployeeWithManager());
            (prisma.leaveRequest.findFirst as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);
            vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue({
                id: "quota-2029",
                employeeId: mockEmployeeId,
                year: 2029,
                leaveType: "PERSONAL",
                totalHalfDays: 20,
                carryBalanceHalfDays: 0,
                usedHalfDays: 24,
            });
            (prisma.leaveQuota.upsert as unknown as { mockResolvedValue: (v: { id: number; totalHalfDays: number; carryBalanceHalfDays: number; usedHalfDays: number }) => void }).mockResolvedValue({
                id: 1,
                totalHalfDays: 20,
                carryBalanceHalfDays: -4,
                usedHalfDays: 16,
            });

            const req = createLeaveRequestRequest({
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
            vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue({
                id: "quota-2029",
                employeeId: mockEmployeeId,
                year: 2029,
                leaveType: "PERSONAL",
                totalHalfDays: 20,
                carryBalanceHalfDays: 0,
                usedHalfDays: 24,
            });
            (prisma.leaveQuota.upsert as unknown as { mockResolvedValue: (v: { id: number; totalHalfDays: number; carryBalanceHalfDays: number; usedHalfDays: number }) => void }).mockResolvedValue({
                id: 1,
                totalHalfDays: 20,
                carryBalanceHalfDays: -4,
                usedHalfDays: 16,
            });
            (prisma.leaveRequest.create as unknown as { mockResolvedValue: (v: { id: number; durationHalfDays: number; overQuotaHalfDays: number; approvalActionVersion: number }) => void }).mockResolvedValue({
                id: 123,
                durationHalfDays: 2,
                overQuotaHalfDays: 2,
                approvalActionVersion: 1,
            });

            const req = createLeaveRequestRequest({
                method: "POST",
                body: JSON.stringify({
                    ...validPayload,
                    specialReason: "กรณีพิเศษที่หัวหน้าควรพิจารณา",
                }),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(201);
            expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        overQuotaHalfDays: 2,
                        specialReason: "กรณีพิเศษที่หัวหน้าควรพิจารณา",
                    }),
                }),
            );
        });

        it("should enqueue and process emergency backdated leave notification", async () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2030-05-15T12:00:00.000Z"));

            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: ReturnType<typeof buildEmployeeWithManager>) => void }).mockResolvedValue(buildEmployeeWithManager());
            (prisma.leaveRequest.findFirst as unknown as { mockResolvedValue: (v: null) => void }).mockResolvedValue(null);
            (prisma.leaveQuota.upsert as unknown as { mockResolvedValue: (v: { id: number; totalHalfDays: number; carryBalanceHalfDays: number; usedHalfDays: number }) => void }).mockResolvedValue({
                id: 1,
                totalHalfDays: 60,
                carryBalanceHalfDays: 0,
                usedHalfDays: 0,
            });
            (prisma.leaveRequest.create as unknown as { mockResolvedValue: (v: { id: string; durationHalfDays: number; overQuotaHalfDays: number; approvalActionVersion: number }) => void }).mockResolvedValue({
                id: "leave-backdated-1",
                durationHalfDays: 2,
                overQuotaHalfDays: 0,
                approvalActionVersion: 1,
            });

            const req = createLeaveRequestRequest({
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
            expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        emergencyReason: "ป่วยฉุกเฉินจนยื่นคำขอไม่ทัน",
                        status: "PENDING",
                        approverId: 200,
                        approvalActionVersion: 1,
                    }),
                }),
            );
            const createCall = vi.mocked(prisma.notificationOutbox.create).mock.calls[0]?.[0];
            const payload = JSON.parse(String(createCall?.data.payload)) as Record<string, unknown>;
            expect(createCall).toEqual({
                data: expect.objectContaining({
                    type: "LEAVE_ACTION",
                    payload: expect.any(String),
                }),
            });
            expect(payload.emergencyReason).toBe("ป่วยฉุกเฉินจนยื่นคำขอไม่ทัน");
            expect(payload.deliveryIdentity).toBe(
                `${String(payload.leaveId)}:${mockManager.user.id}:generation:1`,
            );
            expect(payload.deliveryIdentity).not.toBe(
                `${String(payload.leaveId)}:${mockManager.user.id}:generation:2`,
            );
            expect(processOutbox).toHaveBeenCalled();
        });

        it("should throw error if requests overlap", async () => {
            (prisma.employee.findUnique as unknown as { mockResolvedValue: (v: ReturnType<typeof buildEmployeeWithManager>) => void }).mockResolvedValue(buildEmployeeWithManager());
            (prisma.leaveRequest.findFirst as unknown as { mockResolvedValue: (v: { id: number; status: string }) => void }).mockResolvedValue({
                id: 50,
                status: "APPROVED",
            });

            const req = createLeaveRequestRequest({
                method: "POST",
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(409);
            const data = await res.json();
            expect(data.error).toBe("มีคำขอลาในช่วงวันที่นี้อยู่แล้ว");
        });

        it("should replay the original request for the same key and payload", async () => {
            const replayedRequest = {
                id: "leave-request-replayed",
                durationHalfDays: 2,
                overQuotaHalfDays: 0,
                attachments: [],
            };
            vi.mocked(prisma.leaveRequestIdempotency.findUnique).mockResolvedValue({
                requestHash: "c607d41308fd5c69b7d86fea0bf507e577fd4f81785ea3b31030490572299841",
                leaveRequest: replayedRequest,
            } as never);

            const req = createLeaveRequestRequest({
                method: "POST",
                headers: { "Idempotency-Key": testIdempotencyKey },
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                success: true,
                data: {
                    id: replayedRequest.id,
                    durationDays: 1,
                    overQuotaDays: 0,
                    attachments: [],
                },
            });
            expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
            expect(prisma.leaveRequestIdempotency.create).not.toHaveBeenCalled();
            expect(prisma.notificationOutbox.create).not.toHaveBeenCalled();
            expect(processOutbox).not.toHaveBeenCalled();
            expect(prisma.auditLog.create).not.toHaveBeenCalled();
        });

        it("should reject a reused key when the payload hash differs", async () => {
            vi.mocked(prisma.leaveRequestIdempotency.findUnique).mockResolvedValue({
                requestHash: "different-request-hash",
                leaveRequest: {
                    id: "leave-request-existing",
                    durationHalfDays: 2,
                    overQuotaHalfDays: 0,
                    attachments: [],
                },
            } as never);

            const req = createLeaveRequestRequest({
                method: "POST",
                headers: { "Idempotency-Key": testIdempotencyKey },
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);

            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({
                error: "Idempotency-Key นี้ถูกใช้กับข้อมูลคำขออื่นแล้ว",
                code: "IDEMPOTENCY_CONFLICT",
            });
            expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
            expect(prisma.leaveRequestIdempotency.create).not.toHaveBeenCalled();
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

            const req = createLeaveRequestRequest({
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
            (prisma.leaveQuota.upsert as unknown as { mockResolvedValue: (v: { id: number; totalHalfDays: number; carryBalanceHalfDays: number; usedHalfDays: number }) => void }).mockResolvedValue({
                id: 1,
                totalHalfDays: 20,
                carryBalanceHalfDays: 0,
                usedHalfDays: 0,
            });

            const mockCreatedRequest = {
                id: 999,
                durationHalfDays: 2,
                overQuotaHalfDays: 0,
                approvalActionVersion: 1,
            };
            (prisma.leaveRequest.create as unknown as { mockResolvedValue: (v: typeof mockCreatedRequest) => void }).mockResolvedValue(
                mockCreatedRequest,
            );

            const req = createLeaveRequestRequest({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(validPayload),
            });

            const res = await submitLeaveRequest(req);
            expect(res.status).toBe(201);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual({
                id: mockCreatedRequest.id,
                durationDays: 1,
                overQuotaDays: 0,
                attachments: [],
            });

            expect(prisma.leaveQuota.upsert).toHaveBeenCalledWith({
                where: {
                    employeeId_year_leaveType: {
                        employeeId: mockEmployeeId,
                        year: 2030,
                        leaveType: "PERSONAL",
                    },
                },
                update: {
                    totalHalfDays: 20,
                    carryBalanceHalfDays: 0,
                },
                create: {
                    employeeId: mockEmployeeId,
                    year: 2030,
                    leaveType: "PERSONAL",
                    totalHalfDays: 20,
                    carryBalanceHalfDays: 0,
                    usedHalfDays: 0,
                },
            });
            expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        employeeId: mockEmployeeId,
                        leaveType: "PERSONAL",
                        period: "FULL_DAY",
                        durationHalfDays: 2,
                        reason: "Personal errand",
                        status: "PENDING",
                        approverId: 200,
                    }),
                }),
            );

            expect(prisma.notificationOutbox.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    type: "LEAVE_ACTION",
                }),
            });
            expect(prisma.leaveRequestIdempotency.create).toHaveBeenCalledWith({
                data: {
                    userId: 1,
                    idempotencyKey: testIdempotencyKey,
                    requestHash: expect.any(String),
                    leaveRequestId: mockCreatedRequest.id,
                },
            });
            expect(processOutbox).toHaveBeenCalled();
        });
    });

    describe("multipart attachments", () => {
        const validPayload = {
            leaveType: "PERSONAL",
            startDate: "2030-05-10",
            endDate: "2030-05-10",
            period: "FULL_DAY",
            reason: "ไปทำธุระส่วนตัว",
        };
        const storedAttachment = {
            storageKey: "leave/leave-request-1/0123456789abcdef0123456789abcdef.webp",
            originalName: "proof.jpg",
            contentType: "image/webp" as const,
            sizeBytes: 512,
            width: 32,
            height: 24,
        };
        const attachmentSummary = {
            id: "attachment-1",
            contentType: "image/webp",
            sizeBytes: 512,
            width: 32,
            height: 24,
            viewUrl: "/api/leave/attachments/attachment-1",
        };

        function createMultipartRequest(files: readonly File[] = []): NextRequest {
            const formData = new FormData();
            formData.set("payload", JSON.stringify(validPayload));
            for (const file of files) {
                formData.append("attachments", file);
            }
            return createLeaveRequestRequest({
                method: "POST",
                body: formData,
            });
        }

        function arrangeSuccessfulCreation(
            attachments: readonly typeof attachmentSummary[] = [],
        ): void {
            (getApiAuthSession as unknown as {
                mockResolvedValue: (value: { user: { id: string; name: string } }) => void;
            }).mockResolvedValue({ user: mockUser });
            (
                prisma.$transaction as unknown as {
                    mockImplementation: (
                        implementation: (callback: (tx: typeof prisma) => Promise<unknown>) => Promise<unknown>,
                    ) => void;
                }
            ).mockImplementation(async (callback) => callback(prisma));
            vi.mocked(prisma.employee.findUnique).mockResolvedValue(
                buildEmployeeWithManager() as never,
            );
            vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValue(null);
            vi.mocked(prisma.leaveQuota.upsert).mockResolvedValue({
                id: "quota-1",
                totalHalfDays: 20,
                carryBalanceHalfDays: 0,
                usedHalfDays: 0,
            } as never);
            vi.mocked(prisma.leaveRequest.create).mockResolvedValue({
                id: "leave-request-1",
                employeeId: mockEmployeeId,
                leaveType: validPayload.leaveType,
                startDate: new Date("2030-05-10T00:00:00.000Z"),
                endDate: new Date("2030-05-10T00:00:00.000Z"),
                period: validPayload.period,
                durationHalfDays: 2,
                overQuotaHalfDays: 0,
                approvalActionVersion: 1,
                attachments,
            } as never);
        }

        it("accepts a multipart request without files", async () => {
            arrangeSuccessfulCreation();

            const response = await submitLeaveRequest(createMultipartRequest());

            expect(response.status).toBe(201);
            expect(uploadMocks.save).toHaveBeenCalledWith({
                leaveRequestId: expect.any(String),
                files: [],
            });
        });

        it("finishes file processing before starting the transaction", async () => {
            arrangeSuccessfulCreation();
            let finishUpload: ((attachments: typeof storedAttachment[]) => void)
                | undefined;
            uploadMocks.save.mockImplementation(
                () => new Promise((resolve) => {
                    finishUpload = resolve;
                }),
            );

            const responsePromise = submitLeaveRequest(createMultipartRequest());
            await vi.waitFor(() => expect(uploadMocks.save).toHaveBeenCalled());
            expect(prisma.$transaction).not.toHaveBeenCalled();

            finishUpload?.([]);
            const response = await responsePromise;

            expect(response.status).toBe(201);
            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        });

        it("creates attachment records and omits storage keys from the response", async () => {
            arrangeSuccessfulCreation([attachmentSummary]);
            uploadMocks.save.mockImplementation(
                async (input: { leaveRequestId: string }) => [{
                    ...storedAttachment,
                    storageKey:
                        `leave/${input.leaveRequestId}/0123456789abcdef0123456789abcdef.webp`,
                }],
            );
            const file = new File(["valid image"], "proof.jpg", {
                type: "image/jpeg",
            });

            const response = await submitLeaveRequest(createMultipartRequest([file]));
            const body = await response.json();
            const saveInput = uploadMocks.save.mock.calls[0]?.[0] as {
                leaveRequestId: string;
            };
            const dynamicStoredAttachment = {
                ...storedAttachment,
                storageKey:
                    `leave/${saveInput.leaveRequestId}/0123456789abcdef0123456789abcdef.webp`,
            };
            const createCall = vi.mocked(prisma.leaveRequest.create).mock.calls[0]?.[0];
            const createData = createCall?.data as {
                id: string;
                attachments: { create: typeof dynamicStoredAttachment[] };
            };

            expect(response.status).toBe(201);
            expect(createData.id).toBe(saveInput.leaveRequestId);
            expect(createData.attachments.create).toEqual([
                dynamicStoredAttachment,
            ]);
            expect(dynamicStoredAttachment.storageKey).toContain(
                `leave/${createData.id}/`,
            );
            expect(prisma.notificationOutbox.create).toHaveBeenCalled();
            expect(body.data.attachments).toEqual([attachmentSummary]);
            expect(JSON.stringify(body)).not.toContain("storageKey");
            expect(JSON.stringify(body)).not.toContain(
                dynamicStoredAttachment.storageKey,
            );

            const outboxCall = vi.mocked(prisma.notificationOutbox.create).mock.calls[0]?.[0];
            expect(String(outboxCall?.data.payload)).not.toContain("storageKey");
            expect(String(outboxCall?.data.payload)).not.toContain("proof.jpg");

            const auditCall = vi.mocked(prisma.auditLog.create).mock.calls[0]?.[0];
            const auditDetails = JSON.parse(
                String(auditCall?.data.details),
            ) as { metadata?: Record<string, unknown> };
            expect(auditDetails.metadata?.attachmentCount).toBe(1);
            expect(auditDetails.metadata).toMatchObject({
                attachmentCount: 1,
                employeeId: mockEmployeeId,
                employeeName: "A B",
                leaveType: "PERSONAL",
                period: "FULL_DAY",
                durationDays: 1,
            });
            expect(formatAuditLogDisplay({
                action: "LEAVE_REQUEST_CREATE",
                entityType: "LeaveRequest",
                entityId: null,
                details: auditDetails as Record<string, unknown>,
            }).summary).toContain("ยื่นคำขอลากิจของ A B");
            expect(String(auditCall?.data.details)).not.toContain("storageKey");
            expect(String(auditCall?.data.details)).not.toContain("proof.jpg");
        });

        it("stores multiple attachment records in the same request", async () => {
            const secondStoredAttachment = {
                ...storedAttachment,
                storageKey: "leave/leave-request-1/fedcba9876543210fedcba9876543210.webp",
                originalName: "second.png",
                sizeBytes: 768,
            };
            const secondSummary = {
                ...attachmentSummary,
                id: "attachment-2",
                sizeBytes: 768,
                viewUrl: "/api/leave/attachments/attachment-2",
            };
            arrangeSuccessfulCreation([attachmentSummary, secondSummary]);
            uploadMocks.save.mockResolvedValue([
                storedAttachment,
                secondStoredAttachment,
            ]);
            const files = [
                new File(["first"], "proof.jpg", { type: "image/jpeg" }),
                new File(["second"], "second.png", { type: "image/png" }),
            ];

            const response = await submitLeaveRequest(createMultipartRequest(files));
            const body = await response.json();

            expect(response.status).toBe(201);
            expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        attachments: {
                            create: [storedAttachment, secondStoredAttachment],
                        },
                    }),
                }),
            );
            expect(body.data.attachments).toEqual([
                attachmentSummary,
                secondSummary,
            ]);
        });

        it("rejects more than three attachments before processing files", async () => {
            arrangeSuccessfulCreation();
            const files = Array.from(
                { length: 4 },
                (_, index) => new File(
                    [`file-${index}`],
                    `proof-${index}.jpg`,
                    { type: "image/jpeg" },
                ),
            );

            const response = await submitLeaveRequest(createMultipartRequest(files));

            expect(response.status).toBe(400);
            expect(uploadMocks.save).not.toHaveBeenCalled();
        });

        it("rejects an attachment larger than eight megabytes", async () => {
            arrangeSuccessfulCreation();
            const file = new File(
                [new Uint8Array(8 * 1024 * 1024 + 1)],
                "large.jpg",
                { type: "image/jpeg" },
            );

            const response = await submitLeaveRequest(createMultipartRequest([file]));

            expect(response.status).toBe(400);
            expect(uploadMocks.save).not.toHaveBeenCalled();
        });

        it("cleans up stored files when business validation fails", async () => {
            arrangeSuccessfulCreation();
            uploadMocks.save.mockResolvedValue([storedAttachment]);
            vi.mocked(prisma.employee.findUnique).mockResolvedValue({
                id: mockEmployeeId,
                managerId: null,
                manager: null,
            } as never);
            const file = new File(["valid image"], "proof.jpg", {
                type: "image/jpeg",
            });

            const response = await submitLeaveRequest(createMultipartRequest([file]));

            expect(response.status).toBe(400);
            expect(uploadMocks.delete).toHaveBeenCalledWith(storedAttachment.storageKey);
        });

        it("cleans up stored files when the database transaction fails", async () => {
            arrangeSuccessfulCreation();
            uploadMocks.save.mockResolvedValue([storedAttachment]);
            vi.mocked(prisma.$transaction).mockRejectedValue(
                new Error("database unavailable"),
            );
            const file = new File(["valid image"], "proof.jpg", {
                type: "image/jpeg",
            });

            const response = await submitLeaveRequest(createMultipartRequest([file]));

            expect(response.status).toBe(500);
            expect(uploadMocks.delete).toHaveBeenCalledWith(storedAttachment.storageKey);
        });

        it("attempts every cleanup without masking the business error", async () => {
            const secondStoredAttachment = {
                ...storedAttachment,
                storageKey: "leave/leave-request-1/fedcba9876543210fedcba9876543210.webp",
            };
            arrangeSuccessfulCreation();
            uploadMocks.save.mockResolvedValue([
                storedAttachment,
                secondStoredAttachment,
            ]);
            uploadMocks.delete.mockImplementation(async (storageKey: string) => {
                if (storageKey === storedAttachment.storageKey) {
                    throw new Error("cleanup failed");
                }
            });
            vi.mocked(prisma.employee.findUnique).mockResolvedValue({
                id: mockEmployeeId,
                managerId: null,
                manager: null,
            } as never);
            const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

            const response = await submitLeaveRequest(createMultipartRequest([
                new File(["first"], "proof.jpg", { type: "image/jpeg" }),
                new File(["second"], "second.png", { type: "image/png" }),
            ]));

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toMatchObject({
                error: "ยังไม่ได้ตั้งค่าผู้อนุมัติ",
            });
            expect(uploadMocks.delete).toHaveBeenCalledWith(storedAttachment.storageKey);
            expect(uploadMocks.delete).toHaveBeenCalledWith(
                secondStoredAttachment.storageKey,
            );
            consoleError.mockRestore();
        });

    });
});
