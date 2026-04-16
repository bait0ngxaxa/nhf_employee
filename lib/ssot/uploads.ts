export const IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

export const IMAGE_UPLOAD_MAX_MB = IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024);

export const IMAGE_UPLOAD_ACCEPTED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;
