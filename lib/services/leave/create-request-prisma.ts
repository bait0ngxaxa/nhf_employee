import type { Prisma } from "@prisma/client";

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
        select: {
            id: true,
            contentType: true,
            sizeBytes: true,
            width: true,
            height: true,
        },
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

type CreatedLeaveAttachment = CreatedLeaveRequest["attachments"][number];

export interface LeaveAttachmentSummary {
    id: string;
    contentType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
}

export function toLeaveAttachmentSummary(
    attachment: CreatedLeaveAttachment,
): LeaveAttachmentSummary {
    return {
        id: attachment.id,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        width: attachment.width,
        height: attachment.height,
    };
}
