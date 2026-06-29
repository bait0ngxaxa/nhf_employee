import { type NextRequest } from "next/server";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isProduction(): boolean {
    return process.env.NODE_ENV === "production";
}

function toOrigin(rawUrl: string | undefined): string | null {
    if (!rawUrl) {
        return null;
    }

    try {
        return new URL(rawUrl).origin;
    } catch {
        return null;
    }
}

function isLocalOrigin(origin: string): boolean {
    try {
        return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
    } catch {
        return false;
    }
}

function firstHeaderValue(value: string | null): string | null {
    return value?.split(",")[0]?.trim() || null;
}

function getForwardedOrigin(request: NextRequest): string | null {
    const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
    const host = forwardedHost ?? firstHeaderValue(request.headers.get("host"));
    if (!host) {
        return null;
    }

    const protocol = firstHeaderValue(request.headers.get("x-forwarded-proto"))
        ?? request.nextUrl.protocol.replace(":", "");
    return toOrigin(`${protocol}://${host}`);
}

export function getConfiguredPublicOrigin(): string | null {
    return toOrigin(process.env.PUBLIC_APPROVE_URL);
}

export function getPublicOrigin(request?: NextRequest): string {
    const requestOrigin = request ? getForwardedOrigin(request) ?? request.nextUrl.origin : null;
    if (!isProduction() && requestOrigin) {
        return requestOrigin;
    }

    const configuredOrigin = getConfiguredPublicOrigin();
    if (configuredOrigin && !isLocalOrigin(configuredOrigin)) {
        return configuredOrigin;
    }

    if (requestOrigin && (!isProduction() || !isLocalOrigin(requestOrigin))) {
        return requestOrigin;
    }

    if (!isProduction()) {
        return "http://localhost:3000";
    }

    throw new Error("PUBLIC_APPROVE_URL is required in production.");
}

export function buildPublicUrl(path: string, request?: NextRequest): URL {
    return new URL(path, getPublicOrigin(request));
}
