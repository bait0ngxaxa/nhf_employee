import type {
    ITTicketEventKind,
    ITTicketStatus,
    Prisma,
} from "@prisma/client";

export type ITTicketAnalyticsPersistenceContext = Pick<
    Prisma.TransactionClient,
    "iTTicket" | "iTTicketCategory" | "iTTicketEvent"
>;

export interface ITAnalyticsQueryWindow {
    readonly startAt: Date;
    readonly endAt: Date;
    readonly backlogStatuses: readonly ITTicketStatus[];
    readonly resolutionEventKind: ITTicketEventKind;
    readonly resolutionStatus: ITTicketStatus;
}

export interface ITAnalyticsStatusCount {
    readonly status: ITTicketStatus;
    readonly count: number;
}

export interface ITAnalyticsTypeCount {
    readonly type: "INCIDENT" | "SERVICE_REQUEST" | "SUGGESTION";
    readonly count: number;
}

export interface ITAnalyticsCategoryCount {
    readonly categoryId: number | null;
    readonly count: number;
}

export interface ITAnalyticsAssigneeCount {
    readonly userId: number | null;
    readonly count: number;
}

export interface ITAnalyticsDepartmentCount {
    readonly departmentNameSnapshot: string | null;
    readonly count: number;
}

export interface ITAnalyticsFirstResponseSample {
    readonly createdAt: Date;
    readonly firstRespondedAt: Date;
}

export interface ITAnalyticsResolvedEvent {
    readonly ticketId: number;
    readonly occurredAt: Date | null;
}

export interface ITAnalyticsResolvedTicket {
    readonly id: number;
    readonly createdAt: Date;
}

export interface ITAnalyticsCategoryName {
    readonly id: number;
    readonly name: string;
}

export interface ITAnalyticsPersistenceSnapshot {
    readonly statuses: readonly ITAnalyticsStatusCount[];
    readonly types: readonly ITAnalyticsTypeCount[];
    readonly backlogCategories: readonly ITAnalyticsCategoryCount[];
    readonly backlogAssignees: readonly ITAnalyticsAssigneeCount[];
    readonly backlogOldestCreatedAt: Date | null;
    readonly departmentSnapshots: readonly ITAnalyticsDepartmentCount[];
    readonly newTicketCount: number;
    readonly firstResponses: readonly ITAnalyticsFirstResponseSample[];
    readonly createdAtValues: readonly Date[];
    readonly resolvedEvents: readonly ITAnalyticsResolvedEvent[];
    readonly resolvedTickets: readonly ITAnalyticsResolvedTicket[];
    readonly categories: readonly ITAnalyticsCategoryName[];
}

function countOf(group: { readonly _count: { readonly _all: number } }): number {
    return group._count._all;
}

/** All queries are narrow, period-bounded or grouped and run on the caller's snapshot. */
export async function readITAnalyticsPersistenceSnapshot(
    tx: ITTicketAnalyticsPersistenceContext,
    window: ITAnalyticsQueryWindow,
): Promise<ITAnalyticsPersistenceSnapshot> {
    const backlogStatusFilter = [...window.backlogStatuses];
    const backlogWhere: Prisma.ITTicketWhereInput = {
        status: { in: backlogStatusFilter },
    };
    const periodWhere: Prisma.ITTicketWhereInput = {
        createdAt: { gte: window.startAt, lt: window.endAt },
    };

    const statusGroups = await tx.iTTicket.groupBy({
        by: ["status"],
        _count: { _all: true },
    });
    const categoryGroups = await tx.iTTicket.groupBy({
        by: ["categoryId"],
        where: backlogWhere,
        _count: { _all: true },
    });
    const assigneeGroups = await tx.iTTicket.groupBy({
        by: ["assignedToUserId"],
        where: backlogWhere,
        _count: { _all: true },
    });
    const oldestBacklog = await tx.iTTicket.aggregate({
        where: backlogWhere,
        _min: { createdAt: true },
    });
    const typeGroups = await tx.iTTicket.groupBy({
        by: ["type"],
        where: periodWhere,
        _count: { _all: true },
    });
    const departmentGroups = await tx.iTTicket.groupBy({
        by: ["requesterDepartmentNameSnapshot"],
        where: periodWhere,
        _count: { _all: true },
    });
    const newTicketCount = await tx.iTTicket.count({ where: periodWhere });
    const firstResponseRows = await tx.iTTicket.findMany({
        where: {
            ...periodWhere,
            firstRespondedAt: { not: null },
        },
        select: { createdAt: true, firstRespondedAt: true },
    });
    const createdRows = await tx.iTTicket.findMany({
        where: periodWhere,
        select: { createdAt: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const resolutionGroups = await tx.iTTicketEvent.groupBy({
        by: ["ticketId"],
        where: {
            kind: window.resolutionEventKind,
            toStatus: window.resolutionStatus,
            occurredAt: { gte: window.startAt, lt: window.endAt },
        },
        _min: { occurredAt: true },
    });
    const resolvedIds = resolutionGroups.map((group) => group.ticketId);
    const resolvedTickets = resolvedIds.length === 0
        ? []
        : await tx.iTTicket.findMany({
            where: { id: { in: resolvedIds } },
            select: { id: true, createdAt: true },
        });
    const categoryIds = categoryGroups.flatMap((group) =>
        group.categoryId === null ? [] : [group.categoryId],
    );
    const categories = categoryIds.length === 0
        ? []
        : await tx.iTTicketCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
        });

    return {
        statuses: statusGroups.map((group) => ({
            status: group.status,
            count: countOf(group),
        })),
        types: typeGroups.map((group) => ({
            type: group.type,
            count: countOf(group),
        })),
        backlogCategories: categoryGroups.map((group) => ({
            categoryId: group.categoryId,
            count: countOf(group),
        })),
        backlogAssignees: assigneeGroups.map((group) => ({
            userId: group.assignedToUserId,
            count: countOf(group),
        })),
        backlogOldestCreatedAt: oldestBacklog._min.createdAt,
        departmentSnapshots: departmentGroups.map((group) => ({
            departmentNameSnapshot: group.requesterDepartmentNameSnapshot,
            count: countOf(group),
        })),
        newTicketCount,
        firstResponses: firstResponseRows.flatMap((row) =>
            row.firstRespondedAt === null
                ? []
                : [{ createdAt: row.createdAt, firstRespondedAt: row.firstRespondedAt }],
        ),
        createdAtValues: createdRows.map((row) => row.createdAt),
        resolvedEvents: resolutionGroups.map((group) => ({
            ticketId: group.ticketId,
            occurredAt: group._min.occurredAt,
        })),
        resolvedTickets: resolvedTickets.map((ticket) => ({
            id: ticket.id,
            createdAt: ticket.createdAt,
        })),
        categories,
    };
}
