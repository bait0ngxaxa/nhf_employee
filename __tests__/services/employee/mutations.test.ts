import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/db/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
    createEmployee,
    updateEmployee,
    deleteEmployee,
    offboardEmployee,
    reactivateEmployee,
    suspendEmployee,
} from "@/lib/services/employee/mutations";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/services/employee/queries", () => ({
    emailExists: vi.fn(),
}));

import { emailExists } from "@/lib/services/employee/queries";

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

const ACTOR = { userId: 999, email: "admin@thainhf.org" };

function buildEmployee(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 1,
        firstName: "Test",
        lastName: "Employee",
        email: "employee@thainhf.org",
        status: "ACTIVE",
        deletedAt: null,
        user: null,
        ...overrides,
    };
}

function buildLinkedEmployee(
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    return buildEmployee({
        user: {
            id: 10,
            name: "Test Employee",
            email: "employee@thainhf.org",
            role: "USER",
            isActive: true,
            deletedAt: null,
        },
        ...overrides,
    });
}

describe("Employee Mutations", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.mocked(emailExists).mockReset();
        prismaMock.$queryRaw.mockResolvedValue([] as never);
        prismaMock.$transaction.mockImplementation(async (callback) => {
            if (typeof callback === "function") {
                return callback(prismaMock as never);
            }
            return callback as never;
        });
        prismaMock.employee.findMany.mockResolvedValue([] as never);
        prismaMock.leaveRequest.findMany.mockResolvedValue([] as never);
        prismaMock.user.findMany.mockResolvedValue([] as never);
        prismaMock.user.update.mockResolvedValue({ id: 10 } as never);
        prismaMock.authRefreshToken.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.auditLog.create.mockResolvedValue({ id: 1 } as never);
        prismaMock.employee.findUnique.mockResolvedValue(
            buildEmployee() as never,
        );
    });

    describe("createEmployee", () => {
        const mockData = {
            firstName: "John",
            lastName: "Doe",
            email: "john@thainhf.org",
            position: "Dev",
            departmentId: 1,
        };

        it("should fail if email exists", async () => {
            vi.mocked(emailExists).mockResolvedValue(true);

            const result = await createEmployee(mockData);

            expect(result.success).toBe(false);
            expect(result.error).toContain("อีเมลนี้ถูกใช้งานแล้ว");
        });

        it("should fail if email domain is not @thainhf.org", async () => {
            const invalidData = { ...mockData, email: "john@gmail.com" };

            const result = await createEmployee(invalidData);

            expect(result.success).toBe(false);
            expect(result.status).toBe(400);
            expect(result.error).toContain(
                "กรุณาใช้อีเมลองค์กร (@thainhf.org) เท่านั้น",
            );
        });

        it("should create employee if valid", async () => {
            vi.mocked(emailExists).mockResolvedValue(false);
            prismaMock.employee.create.mockResolvedValue({
                id: 1,
                ...mockData,
            } as never);

            const result = await createEmployee(mockData);

            expect(result.success).toBe(true);
            expect(result.employee).toBeDefined();
            expect(prismaMock.employee.create).toHaveBeenCalled();
        });
    });

    describe("updateEmployee", () => {
        it("should fail if employee not found", async () => {
            prismaMock.employee.findUnique.mockResolvedValue(null);

            const result = await updateEmployee(999, { firstName: "New" });

            expect(result.success).toBe(false);
            expect(result.status).toBe(404);
        });

        it("should update basic fields", async () => {
            prismaMock.employee.findFirst.mockResolvedValue({
                id: 1,
                firstName: "Old",
            } as never);
            prismaMock.employee.update.mockResolvedValue({
                id: 1,
                firstName: "New",
            } as never);

            const result = await updateEmployee(1, { firstName: "New" });

            expect(result.success).toBe(true);
            expect(prismaMock.employee.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                    data: expect.objectContaining({ firstName: "New" }),
                }),
            );
        });
        it("keeps the existing behavior for an employee without a linked user", async () => {
            const employee = buildEmployee();
            prismaMock.employee.findFirst.mockResolvedValue(employee as never);
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.employee.update.mockResolvedValue({
                ...employee,
                firstName: "New",
                email: "new@thainhf.org",
            } as never);
            vi.mocked(emailExists).mockResolvedValue(false);

            const result = await updateEmployee(1, {
                firstName: "New",
                email: "NEW@THAINHF.ORG",
            });

            expect(result.success).toBe(true);
            expect(prismaMock.employee.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        firstName: "New",
                        email: "new@thainhf.org",
                    }),
                }),
            );
            expect(prismaMock.user.update).not.toHaveBeenCalled();
        });

        it("keeps temporary-email behavior for an employee without a linked user", async () => {
            const employee = buildEmployee();
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.employee.update.mockResolvedValue(employee as never);

            const result = await updateEmployee(1, { email: "-" });

            expect(result.success).toBe(true);
            expect(prismaMock.employee.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        email: expect.stringMatching(/@temp\.local$/),
                    }),
                }),
            );
            expect(prismaMock.user.update).not.toHaveBeenCalled();
        });

        it.each([
            {
                label: "first name",
                update: { firstName: "New" },
                expectedName: "New Employee",
            },
            {
                label: "last name",
                update: { lastName: "Name" },
                expectedName: "Test Name",
            },
        ])("syncs the linked user name after changing the employee $label", async ({
            update,
            expectedName,
        }) => {
            const employee = buildLinkedEmployee();
            prismaMock.employee.findFirst.mockResolvedValue(employee as never);
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.employee.update.mockResolvedValue(employee as never);

            const result = await updateEmployee(1, update);

            expect(result.success).toBe(true);
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: 10 },
                data: { name: expectedName },
            });
        });

        it("updates employee and linked user email in the same transaction", async () => {
            const employee = buildLinkedEmployee();
            prismaMock.employee.findFirst.mockResolvedValue(employee as never);
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.employee.update.mockResolvedValue({
                ...employee,
                email: "new@thainhf.org",
            } as never);
            prismaMock.employee.findFirst
                .mockResolvedValueOnce(employee as never)
                .mockResolvedValueOnce(null);
            prismaMock.user.findFirst.mockResolvedValue(null);
            vi.mocked(emailExists).mockResolvedValue(false);

            const result = await updateEmployee(1, {
                email: "NEW@THAINHF.ORG",
            });

            expect(result.success).toBe(true);
            expect(prismaMock.employee.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ email: "new@thainhf.org" }),
                }),
            );
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: 10 },
                data: { email: "new@thainhf.org" },
            });
            expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        });

        it("rejects an email owned by another employee without partial writes", async () => {
            const employee = buildLinkedEmployee();
            prismaMock.employee.findFirst.mockResolvedValue(employee as never);
            prismaMock.employee.findUnique.mockImplementation((async (
                args: Prisma.EmployeeFindUniqueArgs,
            ) =>
                "email" in args.where
                    ? { id: 2 }
                    : employee
            ) as never);
            vi.mocked(emailExists).mockResolvedValue(true);

            const result = await updateEmployee(1, {
                email: "taken@thainhf.org",
            });

            expect(result).toMatchObject({ success: false, status: 400 });
            expect(prismaMock.employee.update).not.toHaveBeenCalled();
            expect(prismaMock.user.update).not.toHaveBeenCalled();
        });

        it("rejects an email owned by another user without partial writes", async () => {
            const employee = buildLinkedEmployee();
            prismaMock.employee.findFirst.mockResolvedValue(employee as never);
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.user.findUnique.mockResolvedValue({ id: 99 } as never);
            vi.mocked(emailExists).mockResolvedValue(false);

            const result = await updateEmployee(1, {
                email: "taken@thainhf.org",
            });

            expect(result).toMatchObject({ success: false, status: 400 });
            expect(prismaMock.employee.update).not.toHaveBeenCalled();
            expect(prismaMock.user.update).not.toHaveBeenCalled();
        });

        it("maps a concurrent unique collision to a business error", async () => {
            const employee = buildLinkedEmployee();
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.user.findUnique.mockResolvedValue(null);
            prismaMock.employee.update.mockRejectedValue({ code: "P2002" });

            const result = await updateEmployee(1, {
                email: "race@thainhf.org",
            });

            expect(result).toMatchObject({
                success: false,
                status: 400,
                error: expect.stringContaining("อีเมลนี้ถูกใช้งานแล้ว"),
            });
            expect(prismaMock.user.update).not.toHaveBeenCalled();
        });

        it.each(["", "-"])(
            "rejects %j as the email of an employee with a linked user",
            async (email) => {
                const employee = buildLinkedEmployee();
                prismaMock.employee.findFirst.mockResolvedValue(employee as never);
                prismaMock.employee.findUnique.mockResolvedValue(employee as never);

                const result = await updateEmployee(1, { email });

                expect(result).toMatchObject({ success: false, status: 400 });
                expect(prismaMock.employee.update).not.toHaveBeenCalled();
                expect(prismaMock.user.update).not.toHaveBeenCalled();
            },
        );

        it("rolls back both identity records when the linked user update fails", async () => {
            const employee = buildLinkedEmployee();
            const state = {
                employeeFirstName: "Test",
                userName: "Test Employee",
            };
            prismaMock.employee.findFirst.mockResolvedValue(employee as never);
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.employee.update.mockImplementation((async () => {
                state.employeeFirstName = "New";
                return { ...employee, firstName: "New" };
            }) as never);
            prismaMock.user.update.mockImplementation((async () => {
                state.userName = "New Employee";
                throw new Error("user update failed");
            }) as never);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                const before = { ...state };
                try {
                    if (typeof callback === "function") {
                        return await callback(prismaMock as never);
                    }
                    return callback as never;
                } catch (error) {
                    Object.assign(state, before);
                    throw error;
                }
            });

            await expect(updateEmployee(1, { firstName: "New" })).rejects.toThrow(
                "user update failed",
            );
            expect(state).toEqual({
                employeeFirstName: "Test",
                userName: "Test Employee",
            });
        });

        it("should fail if email domain is not @thainhf.org", async () => {
            prismaMock.employee.findFirst.mockResolvedValue({
                id: 1,
                firstName: "Old",
                email: "old@thainhf.org",
            } as never);

            const result = await updateEmployee(1, { email: "new@gmail.com" });

            expect(result.success).toBe(false);
            expect(result.status).toBe(400);
            expect(result.error).toContain(
                "กรุณาใช้อีเมลองค์กร (@thainhf.org) เท่านั้น",
            );
        });

        it("routes an INACTIVE status transition through the offboarding lifecycle", async () => {
            const employee = buildEmployee({
                user: {
                    id: 10,
                    email: "employee@thainhf.org",
                    role: "USER",
                    isActive: true,
                    deletedAt: null,
                },
            });
            prismaMock.employee.findFirst.mockResolvedValue(employee as never);
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.employee.update.mockResolvedValue({
                ...employee,
                status: "INACTIVE",
                deletedAt: new Date(),
            } as never);

            const result = await updateEmployee(1, { status: "INACTIVE" }, ACTOR);

            expect(result.success).toBe(true);
            expect(result.lifecycle).toBe("OFFBOARD");
            expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ isActive: false }),
            }));
        });
    });

    describe("deleteEmployee", () => {
        it("should fail if not found", async () => {
            prismaMock.employee.findUnique.mockResolvedValue(null);

            const result = await deleteEmployee(999, ACTOR);

            expect(result.success).toBe(false);
            expect(result.status).toBe(404);
        });

        it("should offboard the employee account and revoke every refresh token", async () => {
            const employee = buildEmployee({
                firstName: "DeleteMe",
                user: {
                    id: 10,
                    email: "delete-me@thainhf.org",
                    role: "USER",
                    isActive: true,
                    deletedAt: null,
                },
            });
            prismaMock.employee.findFirst.mockResolvedValue(employee as never);
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.employee.update.mockResolvedValue({
                ...employee,
                status: "INACTIVE",
                deletedAt: new Date(),
            } as never);

            const result = await deleteEmployee(1, ACTOR);

            expect(result.success).toBe(true);
            expect(result.auditRecorded).toBe(true);
            expect(prismaMock.employee.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: {
                    status: "INACTIVE",
                    deletedAt: expect.any(Date),
                },
                include: expect.any(Object),
            });
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: 10 },
                data: {
                    isActive: false,
                    tokenVersion: { increment: 1 },
                },
            });
            expect(prismaMock.authRefreshToken.updateMany).toHaveBeenCalledWith({
                where: { userId: 10, revokedAt: null },
                data: { revokedAt: expect.any(Date) },
            });
        });

        it("blocks self-offboarding", async () => {
            const employee = buildEmployee({
                user: {
                    id: ACTOR.userId,
                    email: ACTOR.email,
                    role: "ADMIN",
                    isActive: true,
                    deletedAt: null,
                },
            });
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);

            const result = await offboardEmployee(1, ACTOR);

            expect(result).toMatchObject({
                success: false,
                status: 403,
                error: expect.stringContaining("ตนเอง"),
            });
            expect(prismaMock.employee.update).not.toHaveBeenCalled();
        });

        it("blocks removing the last active admin", async () => {
            const employee = buildEmployee({
                user: {
                    id: 10,
                    email: "admin@thainhf.org",
                    role: "ADMIN",
                    isActive: true,
                    deletedAt: null,
                },
            });
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.user.findMany.mockResolvedValue([{ id: 10 }] as never);

            const result = await offboardEmployee(1, ACTOR);

            expect(result).toMatchObject({
                success: false,
                status: 409,
                error: expect.stringContaining("คนสุดท้าย"),
            });
            expect(prismaMock.employee.update).not.toHaveBeenCalled();
        });

        it("blocks a manager until subordinates are reassigned", async () => {
            const employee = buildEmployee({
                user: {
                    id: 10,
                    email: "manager@thainhf.org",
                    role: "USER",
                    isActive: true,
                    deletedAt: null,
                },
            });
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.employee.findMany.mockResolvedValue([{
                id: 2,
                firstName: "Direct",
                lastName: "Report",
            }] as never);

            const result = await offboardEmployee(1, ACTOR);

            expect(result).toMatchObject({
                success: false,
                status: 409,
                error: expect.stringContaining("2 (Direct Report)"),
            });
            expect(prismaMock.employee.update).not.toHaveBeenCalled();
        });

        it("blocks a manager with pending leave approvals", async () => {
            const employee = buildEmployee({
                user: {
                    id: 10,
                    email: "manager@thainhf.org",
                    role: "USER",
                    isActive: true,
                    deletedAt: null,
                },
            });
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.leaveRequest.findMany.mockResolvedValue([{
                id: "leave-1",
                employee: { id: 2, firstName: "Leave", lastName: "Requester" },
            }] as never);

            const result = await offboardEmployee(1, ACTOR);

            expect(result).toMatchObject({
                success: false,
                status: 409,
                error: expect.stringContaining("leave-1 (Leave Requester)"),
            });
            expect(prismaMock.employee.update).not.toHaveBeenCalled();
        });

        it.each([
            {
                status: "CANCELLATION_REQUESTED",
                notTakenRequestedAt: null,
                label: "cancellation requests",
            },
            {
                status: "APPROVED",
                notTakenRequestedAt: new Date("2026-02-01T00:00:00.000Z"),
                label: "not-taken requests",
            },
        ])("blocks a manager with $label", async ({ status }) => {
            const employee = buildEmployee({
                user: {
                    id: 10,
                    email: "manager@thainhf.org",
                    role: "USER",
                    isActive: true,
                    deletedAt: null,
                },
            });
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.leaveRequest.findMany.mockResolvedValue([{
                id: `leave-${status.toLowerCase()}`,
                employee: { id: 2, firstName: "Leave", lastName: "Requester" },
            }] as never);

            const result = await offboardEmployee(1, ACTOR);

            expect(result).toMatchObject({
                success: false,
                status: 409,
                error: expect.stringContaining("ต้องจัดการก่อนปิดใช้งาน"),
            });
            expect(prismaMock.leaveRequest.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { approverId: 1 },
                        { exceptionApproverId: 1 },
                    ],
                    AND: [{
                        OR: [
                            { status: "PENDING" },
                            { status: "CANCELLATION_REQUESTED" },
                            { status: "APPROVED", notTakenRequestedAt: { not: null } },
                        ],
                    }],
                },
                select: {
                    id: true,
                    employee: { select: { id: true, firstName: true, lastName: true } },
                },
                orderBy: { id: "asc" },
            });
        });

        it("reactivates the user only through an explicit lifecycle action", async () => {
            const employee = buildEmployee({
                status: "INACTIVE",
                deletedAt: new Date("2026-01-01T00:00:00.000Z"),
                user: {
                    id: 10,
                    email: "employee@thainhf.org",
                    role: "USER",
                    isActive: false,
                    deletedAt: null,
                },
            });
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.employee.update.mockResolvedValue({
                ...employee,
                status: "ACTIVE",
                deletedAt: null,
            } as never);

            const result = await reactivateEmployee(1, ACTOR);

            expect(result.success).toBe(true);
            expect(prismaMock.employee.update).toHaveBeenCalledWith(expect.objectContaining({
                data: { status: "ACTIVE", deletedAt: null },
            }));
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: 10 },
                data: {
                    isActive: true,
                    deletedAt: null,
                    tokenVersion: { increment: 1 },
                },
            });
        });

        it("suspends without soft-deleting the employee record", async () => {
            const employee = buildEmployee({
                user: {
                    id: 10,
                    email: "employee@thainhf.org",
                    role: "USER",
                    isActive: true,
                    deletedAt: null,
                },
            });
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.employee.update.mockResolvedValue({
                ...employee,
                status: "SUSPENDED",
            } as never);

            const result = await suspendEmployee(1, ACTOR);

            expect(result.success).toBe(true);
            expect(prismaMock.employee.update).toHaveBeenCalledWith(expect.objectContaining({
                data: { status: "SUSPENDED", deletedAt: null },
            }));
        });

        it("does not leave partial lifecycle state when the transaction fails", async () => {
            const employee = buildEmployee({
                user: {
                    id: 10,
                    email: "employee@thainhf.org",
                    role: "USER",
                    isActive: true,
                    deletedAt: null,
                },
            });
            const state = {
                employeeStatus: "ACTIVE",
                employeeDeletedAt: null as Date | null,
                userIsActive: true,
                tokenRevoked: false,
            };
            prismaMock.employee.findUnique.mockResolvedValue(employee as never);
            prismaMock.employee.update.mockImplementation((async ({ data }: Prisma.EmployeeUpdateArgs) => {
                state.employeeStatus = String(data.status);
                state.employeeDeletedAt = data.deletedAt instanceof Date ? data.deletedAt : null;
                return {
                    ...employee,
                    status: state.employeeStatus,
                    deletedAt: state.employeeDeletedAt,
                };
            }) as never);
            prismaMock.user.update.mockImplementation((async () => {
                state.userIsActive = false;
                return { id: 10 };
            }) as never);
            prismaMock.authRefreshToken.updateMany.mockImplementation((async () => {
                state.tokenRevoked = true;
                return { count: 1 };
            }) as never);
            prismaMock.auditLog.create.mockRejectedValue(new Error("audit failed"));
            prismaMock.$transaction.mockImplementation(async (callback) => {
                const before = { ...state };
                try {
                    if (typeof callback === "function") return await callback(prismaMock as never);
                    return callback as never;
                } catch (error) {
                    Object.assign(state, before);
                    throw error;
                }
            });

            await expect(offboardEmployee(1, ACTOR)).rejects.toThrow("audit failed");
            expect(state).toEqual({
                employeeStatus: "ACTIVE",
                employeeDeletedAt: null,
                userIsActive: true,
                tokenRevoked: false,
            });
        });
    });
});
