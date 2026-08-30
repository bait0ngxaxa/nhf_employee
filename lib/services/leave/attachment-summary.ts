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

export type LeaveAttachmentUrlBuilder = (attachmentId: string) => string;

export function toLeaveAttachmentSummary(
    attachment: StoredLeaveAttachmentSummary,
    buildViewUrl: LeaveAttachmentUrlBuilder = API_ROUTES.leave.attachmentById,
): LeaveAttachmentSummary {
    return {
        id: attachment.id,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        width: attachment.width,
        height: attachment.height,
        viewUrl: buildViewUrl(attachment.id),
    };
}

export function withLeaveAttachmentSummaries<
    T extends { attachments: StoredLeaveAttachmentSummary[] },
>(
    request: T,
    buildViewUrl: LeaveAttachmentUrlBuilder = API_ROUTES.leave.attachmentById,
): Omit<T, "attachments"> & { attachments: LeaveAttachmentSummary[] } {
    const { attachments, ...leaveRequest } = request;

    return {
        ...leaveRequest,
        attachments: attachments.map((attachment) =>
            toLeaveAttachmentSummary(attachment, buildViewUrl),
        ),
    };
}
