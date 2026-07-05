import { isIP } from "net";

interface HeaderReader {
    get(name: string): string | null;
}

const CLOUDFLARE_REAL_IP_HEADER = "cf-connecting-ip";

function normalizeIp(value: string | null): string | null {
    const normalized = value?.trim();
    if (!normalized || isIP(normalized) === 0) {
        return null;
    }
    return normalized;
}

export function getTrustedClientIp(headers: HeaderReader): string | null {
    return normalizeIp(headers.get(CLOUDFLARE_REAL_IP_HEADER));
}
