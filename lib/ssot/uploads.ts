export const IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

export const IMAGE_UPLOAD_MAX_MB = IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024);

export const IMAGE_UPLOAD_ACCEPTED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

// Multipart envelope allowance on top of the file limit: boundaries, part
// headers and the small `scope` field. Applied to the whole request body.
export const IMAGE_UPLOAD_MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export const IMAGE_UPLOAD_MAX_REQUEST_BYTES =
    IMAGE_UPLOAD_MAX_BYTES + IMAGE_UPLOAD_MULTIPART_OVERHEAD_BYTES;
