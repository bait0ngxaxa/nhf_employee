/**
 * Generates a presentation-only default identifier for a newly created
 * authorization administration entity. Runtime authority never derives from
 * this value; the server still validates uniqueness and persists the key.
 */
export function createAuthorizationTechnicalKey(prefix: "team" | "role"): string {
    const suffix = typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    return `new-${prefix}-${suffix}`;
}
