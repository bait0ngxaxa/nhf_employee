export interface SessionItem {
    id: string;
    familyId: string;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string;
    userAgent: string | null;
    ipAddress: string | null;
    isCurrent: boolean;
}

export interface SessionsResponse {
    sessions: SessionItem[];
}

export type ConfirmAction =
    | { type: "revoke-session"; sessionId: string }
    | { type: "signout-current" }
    | { type: "signout-others" };

export interface ParsedUserAgent {
    browser: string;
    os: string;
    deviceType: "mobile" | "tablet" | "desktop";
}
