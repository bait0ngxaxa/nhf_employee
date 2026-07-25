export const LEAVE_ATTACHMENT_MAX_FILES = 3;

export const LEAVE_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

export const LEAVE_ATTACHMENT_MAX_MB =
    LEAVE_ATTACHMENT_MAX_BYTES / (1024 * 1024);

export const LEAVE_ATTACHMENT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export const LEAVE_ATTACHMENT_MAX_TOTAL_MB =
    LEAVE_ATTACHMENT_MAX_TOTAL_BYTES / (1024 * 1024);

export const LEAVE_ATTACHMENT_ACCEPTED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

export const LEAVE_ATTACHMENT_MAX_WIDTH = 2400;

export const LEAVE_ATTACHMENT_MAX_HEIGHT = 2400;

export const LEAVE_ATTACHMENT_WEBP_QUALITY = 88;

export type LeaveAttachmentAcceptedType =
    (typeof LEAVE_ATTACHMENT_ACCEPTED_TYPES)[number];
