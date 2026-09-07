import { hasActiveAuthSessionFamily } from "@/modules/auth";

export async function hasActiveSessionFamily(
    userId: number,
    familyId: string,
): Promise<boolean> {
    return hasActiveAuthSessionFamily(userId, familyId);
}
