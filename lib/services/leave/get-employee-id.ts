import { prisma } from "@/lib/prisma";

/**
 * Resolve a User ID (from session) to the linked Employee ID.
 * Returns null if the user has no linked employee record.
 */
export async function getEmployeeIdFromUserId(userId: number): Promise<number | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { employeeId: true },
    });

    return user?.employeeId ?? null;
}
