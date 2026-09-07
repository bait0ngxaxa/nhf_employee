export function parseAuthenticatedUserId(rawUserId: string): number | null {
    const userId = Number.parseInt(rawUserId, 10);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return userId;
}
