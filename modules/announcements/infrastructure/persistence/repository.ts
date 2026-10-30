import type { Announcement } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { UserContext } from "@/lib/auth/context";
import { appendAuditInTransaction } from "@/modules/audit";
import { AnnouncementError, type AnnouncementMutation, type AnnouncementState } from "../../domain/contracts";

function project(row: Announcement): AnnouncementState {
    return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function findAnnouncement(): Promise<AnnouncementState> {
    return project(await prisma.announcement.findUniqueOrThrow({ where: { id: 1 } }));
}

export async function persistAnnouncement(principal: UserContext, input: AnnouncementMutation): Promise<AnnouncementState> {
    return prisma.$transaction(async (tx) => {
        // Re-read trusted account state at the mutation boundary as well as route authorization.
        const actor = await tx.user.findUnique({
            where: { id: principal.id },
            select: { role: true, isActive: true, deletedAt: true, email: true },
        });
        if (!actor || actor.role !== "ADMIN" || !actor.isActive || actor.deletedAt !== null) {
            throw new AnnouncementError("FORBIDDEN");
        }
        const before = await tx.announcement.findUniqueOrThrow({ where: { id: 1 } });
        if (before.version !== input.version) throw new AnnouncementError("CONFLICT");
        if (input.action === "unpublish" && before.version === 0) throw new AnnouncementError("INVALID_INPUT");
        const result = await tx.announcement.updateMany({
            where: { id: 1, version: input.version },
            data: {
                ...(input.action !== "unpublish" ? { content: input.content } : {}),
                published: input.action === "publish",
                version: { increment: 1 },
                ...(before.authorId === null ? { authorId: principal.id } : {}),
                updatedById: principal.id,
            },
        });
        if (result.count !== 1) throw new AnnouncementError("CONFLICT");
        const after = await tx.announcement.findUniqueOrThrow({ where: { id: 1 } });
        await appendAuditInTransaction(tx, {
            action: "ANNOUNCEMENT_UPDATE", entityType: "Announcement", entityId: 1,
            userId: principal.id, userEmail: actor.email,
            details: {
                before: { content: before.content, published: before.published, version: before.version },
                after: { content: after.content, published: after.published, version: after.version },
                metadata: { action: input.action },
            },
        });
        return project(after);
    });
}
