import type { Prisma } from "@prisma/client";

export interface EmployeeLeaveOffboardingBlocker {
    id: string;
    employee: {
        id: number;
        firstName: string;
        lastName: string;
        nickname: string | null;
    };
}

export async function getEmployeeLeaveOffboardingBlockers(
    tx: Prisma.TransactionClient,
    employeeId: number,
): Promise<EmployeeLeaveOffboardingBlocker[]> {
    return tx.leaveRequest.findMany({
        where: {
            OR: [{ approverId: employeeId }, { exceptionApproverId: employeeId }],
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
            employee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    nickname: true,
                },
            },
        },
        orderBy: { id: "asc" },
    });
}
