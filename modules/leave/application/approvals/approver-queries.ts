import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    ACTIVE_LEAVE_EMPLOYEE_QUERY_WHERE,
    isActiveLeaveApprover,
} from "@/modules/leave/domain/approver-eligibility";

const LEAVE_APPROVER_EMPLOYEE_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    nickname: true,
    email: true,
    position: true,
    status: true,
    deletedAt: true,
    managerId: true,
    dept: { select: { name: true } },
    user: {
        select: {
            id: true,
            email: true,
            isActive: true,
            deletedAt: true,
        },
    },
} as const satisfies Prisma.EmployeeSelect;

type SelectedLeaveApproverEmployee = Prisma.EmployeeGetPayload<{
    select: typeof LEAVE_APPROVER_EMPLOYEE_SELECT;
}>;

export type LeaveApproverEmployee = Omit<
    SelectedLeaveApproverEmployee,
    "user"
> & {
    canApproveLeave: boolean;
};

export async function getLeaveApproverEmployees(): Promise<LeaveApproverEmployee[]> {
    const employees = await prisma.employee.findMany({
        where: ACTIVE_LEAVE_EMPLOYEE_QUERY_WHERE,
        select: LEAVE_APPROVER_EMPLOYEE_SELECT,
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return employees.map(({ user, ...employee }) => ({
        ...employee,
        canApproveLeave: isActiveLeaveApprover({
            ...employee,
            user,
        }),
    }));
}
