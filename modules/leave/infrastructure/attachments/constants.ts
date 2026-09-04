export const LEAVE_ATTACHMENT_MAX_FILES = 3;

export const LEAVE_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

export const LEAVE_ATTACHMENT_MAX_MB =
    LEAVE_ATTACHMENT_MAX_BYTES / (1024 * 1024);

export const LEAVE_ATTACHMENT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export const LEAVE_ATTACHMENT_MAX_TOTAL_MB =
    LEAVE_ATTACHMENT_MAX_TOTAL_BYTES / (1024 * 1024);

// Multipart framing adds a small amount of overhead above the 20 MB file total.
// Keep this aligned with the reverse-proxy body limit documented for production.
export const LEAVE_ATTACHMENT_MAX_REQUEST_BYTES = 25_000_000;

export const LEAVE_ATTACHMENT_ACCEPTED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

export const LEAVE_ATTACHMENT_ACCEPTED_FORMATS = [
    "jpeg",
    "png",
    "webp",
] as const;

export const LEAVE_ATTACHMENT_MAX_WIDTH = 2400;

export const LEAVE_ATTACHMENT_MAX_HEIGHT = 2400;

export const LEAVE_ATTACHMENT_MAX_INPUT_PIXELS = 40_000_000;

export const LEAVE_ATTACHMENT_WEBP_QUALITY = 88;

// Files are eligible for orphan cleanup only after this safety window. It keeps
// files written by an in-flight request safe when cleanup runs concurrently.
export const LEAVE_ATTACHMENT_ORPHAN_SAFETY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type LeaveAttachmentAcceptedType =
    (typeof LEAVE_ATTACHMENT_ACCEPTED_TYPES)[number];
