import type { ITTicket as PrismaITTicket, Prisma } from "@prisma/client";

export type ITTicketPersistenceContext = Pick<
    Prisma.TransactionClient,
    "iTTicket" | "iTTicketEvent" | "iTTicketCategory" | "iTTicketCreateIdempotency"
>;

export async function findITTicketForMutation(
    tx: ITTicketPersistenceContext,
    ticketId: number,
): Promise<PrismaITTicket | null> {
    return tx.iTTicket.findUnique({ where: { id: ticketId } });
}

export async function findITTicketCreationReplay(
    tx: ITTicketPersistenceContext,
    requesterUserId: number,
    idempotencyKey: string,
): Promise<{ readonly requestHash: string; readonly ticket: PrismaITTicket } | null> {
    return tx.iTTicketCreateIdempotency.findUnique({
        where: {
            requesterUserId_idempotencyKey: { requesterUserId, idempotencyKey },
        },
        select: {
            requestHash: true,
            ticket: true,
        },
    });
}

export async function createITTicketRecord(
    tx: ITTicketPersistenceContext,
    data: Prisma.ITTicketUncheckedCreateInput,
): Promise<PrismaITTicket> {
    return tx.iTTicket.create({ data });
}

export async function createITTicketEvent(
    tx: ITTicketPersistenceContext,
    data: Prisma.ITTicketEventUncheckedCreateInput,
): Promise<number> {
    const event = await tx.iTTicketEvent.create({
        data,
        select: { id: true },
    });
    return event.id;
}

export async function createITTicketCreationIdempotency(
    tx: ITTicketPersistenceContext,
    data: Prisma.ITTicketCreateIdempotencyUncheckedCreateInput,
): Promise<void> {
    await tx.iTTicketCreateIdempotency.create({ data, select: { id: true } });
}

export async function findITTicketCategoryState(
    tx: ITTicketPersistenceContext,
    categoryId: number,
): Promise<{ readonly id: number; readonly isActive: boolean } | null> {
    return tx.iTTicketCategory.findUnique({
        where: { id: categoryId },
        select: { id: true, isActive: true },
    });
}

export async function updateITTicketIfVersionMatches(
    tx: ITTicketPersistenceContext,
    ticketId: number,
    expectedVersion: number,
    data: Prisma.ITTicketUncheckedUpdateManyInput,
): Promise<boolean> {
    const result = await tx.iTTicket.updateMany({
        where: { id: ticketId, version: expectedVersion },
        data,
    });
    return result.count === 1;
}
