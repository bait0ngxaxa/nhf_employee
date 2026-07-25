import type { Prisma } from "@prisma/client";

import { API_ROUTES } from "@/lib/ssot/routes";
import type { LeaveAttachmentSummary } from "@/lib/types/leave";

export const leaveAttachmentSummarySelect = {
    id: true,
    contentType: true,
    sizeBytes: true,
    width: true,
    height: true,
} as const satisfies Prisma.LeaveAttachmentSelect;

export const leaveAttachmentSummaryOrderBy = [
    { createdAt: "asc" },
    { id: "asc" },
] as const satisfies Prisma.LeaveAttachmentOrderByWithRelationInput[];

type StoredLeaveAttachmentSummary = {
    id: string;
    contentType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
};

export function toLeaveAttachmentSummary(
    attachment: StoredLeaveAttachmentSummary,
): LeaveAttachmentSummary {
    return {
        id: attachment.id,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        width: attachment.width,
        height: attachment.height,
        viewUrl: API_ROUTES.leave.attachmentById(attachment.id),
    };
}

export function withLeaveAttachmentSummaries<
    T extends { attachments: StoredLeaveAttachmentSummary[] },
>(
    request: T,
): Omit<T, "attachments"> & { attachments: LeaveAttachmentSummary[] } {
    const { attachments, ...leaveRequest } = request;

    return {
        ...leaveRequest,
        attachments: attachments.map(toLeaveAttachmentSummary),
    };
}
