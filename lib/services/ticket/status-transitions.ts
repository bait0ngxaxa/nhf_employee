import { TicketStatus, type Prisma } from "@prisma/client";

const TICKET_STATUS_TRANSITIONS = {
    [TicketStatus.OPEN]: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.RESOLVED,
        TicketStatus.CANCELLED,
    ],
    [TicketStatus.IN_PROGRESS]: [
        TicketStatus.OPEN,
        TicketStatus.RESOLVED,
        TicketStatus.CANCELLED,
    ],
    [TicketStatus.RESOLVED]: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.CLOSED,
    ],
    [TicketStatus.CLOSED]: [TicketStatus.OPEN],
    [TicketStatus.CANCELLED]: [TicketStatus.OPEN],
} as const satisfies Record<TicketStatus, readonly TicketStatus[]>;

export function isTicketStatusTransitionAllowed(
    from: TicketStatus,
    to: TicketStatus,
): boolean {
    if (from === to) return true;
    return TICKET_STATUS_TRANSITIONS[from].some((status) => status === to);
}

export function buildTicketStatusUpdate(
    from: TicketStatus,
    to: TicketStatus,
    now: Date,
): Prisma.TicketUncheckedUpdateManyInput {
    if (from === to) return {};

    const update: Prisma.TicketUncheckedUpdateManyInput = { status: to };

    if (to === TicketStatus.RESOLVED) {
        update.resolvedAt = now;
    }
    if (from === TicketStatus.RESOLVED && to === TicketStatus.IN_PROGRESS) {
        update.resolvedAt = null;
    }
    if (to === TicketStatus.CLOSED) {
        update.closedAt = now;
    }
    if (from === TicketStatus.CLOSED && to === TicketStatus.OPEN) {
        update.resolvedAt = null;
        update.closedAt = null;
    }
    if (to === TicketStatus.CANCELLED) {
        update.cancelledAt = now;
    }
    if (from === TicketStatus.CANCELLED && to === TicketStatus.OPEN) {
        update.cancelledAt = null;
    }

    return update;
}
