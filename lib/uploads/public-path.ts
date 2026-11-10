/**
 * Single source of truth for the shape of publicly served image uploads.
 *
 * `saveLocalImageUpload` writes exactly:
 *   stock/items/<YYYY>/<MM>/item-<epochMs>-<12 hex>.webp
 *   stock/variants/<YYYY>/<MM>/variant-<epochMs>-<12 hex>.webp
 *
 * The public GET route serves only paths of this shape. Everything else under
 * the upload root (including private attachments) is never reachable through it.
 */
export const PUBLIC_IMAGE_UPLOAD_SCOPE_SEGMENTS = {
    item: ["stock", "items"],
    variant: ["stock", "variants"],
} as const;

export type PublicImageUploadScope = keyof typeof PUBLIC_IMAGE_UPLOAD_SCOPE_SEGMENTS;

const YEAR_SEGMENT = /^\d{4}$/;
const MONTH_SEGMENT = /^(?:0[1-9]|1[0-2])$/;
const FILE_NAME_SEGMENT = /^(item|variant)-\d{1,16}-[0-9a-f]{12}\.webp$/;

function scopeForFolder(
    root: string | undefined,
    folder: string | undefined,
): PublicImageUploadScope | null {
    for (const [scope, segments] of Object.entries(PUBLIC_IMAGE_UPLOAD_SCOPE_SEGMENTS)) {
        if (segments[0] === root && segments[1] === folder) {
            return scope as PublicImageUploadScope;
        }
    }
    return null;
}

export function isPublicImageUploadPath(segments: readonly string[]): boolean {
    if (segments.length !== 5) return false;

    const [root, folder, year, month, fileName] = segments;
    const scope = scopeForFolder(root, folder);
    if (scope === null) return false;
    if (year === undefined || !YEAR_SEGMENT.test(year)) return false;
    if (month === undefined || !MONTH_SEGMENT.test(month)) return false;

    const fileMatch = fileName === undefined ? null : FILE_NAME_SEGMENT.exec(fileName);
    return fileMatch !== null && fileMatch[1] === scope;
}
