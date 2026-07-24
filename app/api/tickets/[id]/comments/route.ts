import { after, type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { createTicketCommandActor } from "@/lib/server/ticket-command-actor";
import { processOutbox } from "@/lib/services/outbox/processor";
import { createTicketAudit } from "@/lib/services/ticket/audit";
import {
    enqueueTicketCommentOutbox,
    getTicketCommentRecipientIds,
} from "@/lib/services/ticket/outbox";
import { jsonError, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { isAdminRole } from "@/lib/ssot/permissions";
import { createTicketCommentSchema } from "@/lib/validations/ticket";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    ): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.itSupport)) {
            return notFound();
        }

        const body = await request.json();
        const parsed = createTicketCommentSchema.safeParse(body);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const resolvedParams = await params;
        const ticketId = parseInt(resolvedParams.id, 10);
        if (Number.isNaN(ticketId)) {
            return jsonError(COMMON_API_MESSAGES.invalidTicketId, 400);
        }

        const actor = createTicketCommandActor(auth.user, request.headers);
        const result = await prisma.$transaction(async (tx) => {
            const ticket = await tx.ticket.findFirst({
                where: { id: ticketId, deletedAt: null },
            });
            if (!ticket) return { outcome: "not_found" as const };

            const isOwner = ticket.reportedById === actor.id;
            const isAdmin = isAdminRole(actor.role);
            if (!isOwner && !isAdmin) {
                return { outcome: "forbidden" as const };
            }

            const comment = await tx.ticketComment.create({
                data: {
                    content: parsed.data.content,
                    ticketId,
                    authorId: actor.id,
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                            employee: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                },
                            },
                        },
                    },
                },
            });

            await createTicketAudit(
                tx,
                "TICKET_COMMENT",
                ticketId,
                actor,
                {
                    after: {
                        commentId: comment.id,
                        content: comment.content,
                        authorId: actor.id,
                    },
                },
            );

            const commentAuthorName =
                comment.author.employee?.firstName
                && comment.author.employee?.lastName
                    ? `${comment.author.employee.firstName} ${comment.author.employee.lastName}`
                    : comment.author.name;
            const recipientIds = await getTicketCommentRecipientIds(
                tx,
                {
                    reportedById: ticket.reportedById,
                    assignedToId: ticket.assignedToId,
                    actorId: actor.id,
                    isAdmin,
                    isOwner,
                },
            );
            await enqueueTicketCommentOutbox(tx, {
                ticketId,
                commentId: comment.id,
                recipientIds,
                authorId: actor.id,
                authorName: commentAuthorName,
                ticketTitle: ticket.title,
                authorIsOwner: isOwner,
            });

            return {
                outcome: "created" as const,
                comment,
            };
        });

        if (result.outcome === "not_found") {
            return jsonError(COMMON_API_MESSAGES.ticketNotFound, 404);
        }
        if (result.outcome === "forbidden") {
            return jsonError(COMMON_API_MESSAGES.accessDenied, 403);
        }

        after(() =>
            processOutbox().catch((error) => {
                console.error("Outbox processor failed:", error);
            }),
        );

        return NextResponse.json({ comment: result.comment }, { status: 201 });
    } catch (error) {
        console.error("Error creating comment:", error);
        return jsonError(COMMON_API_MESSAGES.failedToCreateComment, 500);
    }
}
