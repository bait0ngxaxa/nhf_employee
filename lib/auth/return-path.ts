import { APP_ROUTES } from "@/lib/ssot/routes";

const SAFE_INTERNAL_ORIGIN = "http://nhf-internal.local";
const MAX_RETURN_PATH_LENGTH = 2048;

export function isSafeInternalPath(
    value: string | null | undefined,
): value is string {
    if (
        !value
        || value.length > MAX_RETURN_PATH_LENGTH
        || !value.startsWith("/")
        || value.startsWith("//")
        || value.includes("\\")
        || value.includes("\u0000")
    ) {
        return false;
    }

    try {
        const parsed = new URL(value, SAFE_INTERNAL_ORIGIN);
        return parsed.origin === SAFE_INTERNAL_ORIGIN
            && parsed.pathname.startsWith("/");
    } catch {
        return false;
    }
}

export function resolveSafeInternalPath(
    value: string | null | undefined,
    fallback = APP_ROUTES.dashboard,
): string {
    return isSafeInternalPath(value) ? value : fallback;
}
