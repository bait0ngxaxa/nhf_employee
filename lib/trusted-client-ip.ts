import { isIP } from "net";

interface HeaderReader {
    get(name: string): string | null;
}

const TRUSTED_CLIENT_IP_HEADERS = [
    "cf-connecting-ip",
    "true-client-ip",
] as const;

function normalizeIp(value: string | null): string | null {
    const normalized = value?.trim();
    if (!normalized || isIP(normalized) === 0) {
        return null;
    }
    return normalized;
}

export function getTrustedClientIp(headers: HeaderReader): string | null {
    for (const header of TRUSTED_CLIENT_IP_HEADERS) {
        const ipAddress = normalizeIp(headers.get(header));
        if (ipAddress) {
            return ipAddress;
        }
    }
    return null;
}
