import type { Prisma } from "@prisma/client";

import {
    leaveAttachmentSummaryOrderBy,
    leaveAttachmentSummarySelect,
} from "@/modules/leave/application/queries/attachment-summary";

export const EMPLOYEE_INCLUDE = {
    user: { select: { id: true } },
    manager: {
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    isActive: true,
                    deletedAt: true,
                },
            },
        },
    },
} as const satisfies Prisma.EmployeeInclude;

export const LEAVE_REQUEST_INCLUDE = {
    attachments: {
        select: leaveAttachmentSummarySelect,
        orderBy: leaveAttachmentSummaryOrderBy,
    },
} as const satisfies Prisma.LeaveRequestInclude;

type EmployeeWithManager = Prisma.EmployeeGetPayload<{
    include: typeof EMPLOYEE_INCLUDE;
}>;

export type EligibleEmployee = EmployeeWithManager & {
    manager: NonNullable<EmployeeWithManager["manager"]> & {
        user: NonNullable<NonNullable<EmployeeWithManager["manager"]>["user"]>;
    };
};

export type CreatedLeaveRequest = Prisma.LeaveRequestGetPayload<{
    include: typeof LEAVE_REQUEST_INCLUDE;
}>;
