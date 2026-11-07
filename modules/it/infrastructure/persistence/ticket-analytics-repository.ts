import type {
    ITTicketEventKind,
    ITTicketPriority,
    ITTicketStatus,
    ITTicketType,
    Prisma,
} from "@prisma/client";

import type {
    ITAnalyticsBacklogAgeBucketKey,
    ITAnalyticsCategoryFilter,
} from "../../contracts";

export type ITTicketAnalyticsPersistenceContext = Pick<
    Prisma.TransactionClient,
    "iTTicket" | "iTTicketCategory" | "iTTicketEvent"
>;

/** Ticket-population filters applied to every Ticket-scoped aggregate. */
export interface ITAnalyticsTicketScope {
    readonly type: ITTicketType | null;
    readonly category: ITAnalyticsCategoryFilter | null;
}

export interface ITAnalyticsBacklogAgeRange {
    readonly key: ITAnalyticsBacklogAgeBucketKey;
    readonly createdAtLte: Date | null;
    readonly createdAtGt: Date | null;
}

export interface ITAnalyticsQueryWindow {
    readonly startAt: Date;
    readonly endAt: Date;
    readonly backlogStatuses: readonly ITTicketStatus[];
    readonly resolutionEventKind: ITTicketEventKind;
    readonly resolutionStatus: ITTicketStatus;
    /** Omitted scope means the full Ticket population. */
    readonly scope?: ITAnalyticsTicketScope;
    /** Omitted ranges skip the aging counts. */
    readonly backlogAgeRanges?: readonly ITAnalyticsBacklogAgeRange[];
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
    readonly priority: ITTicketPriority;
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
    readonly priority: ITTicketPriority;
}

export interface ITAnalyticsCategoryName {
    readonly id: number;
    readonly name: string;
    readonly key: string;
    readonly isActive: boolean;
}

export interface ITAnalyticsBacklogAgeCount {
    readonly key: ITAnalyticsBacklogAgeBucketKey;
    readonly count: number;
}

export interface ITAnalyticsPersistenceSnapshot {
    readonly statuses: readonly ITAnalyticsStatusCount[];
    readonly types: readonly ITAnalyticsTypeCount[];
    readonly priorities: readonly { readonly priority: ITTicketPriority; readonly count: number }[];
    readonly backlogPriorities: readonly { readonly priority: ITTicketPriority; readonly count: number }[];
    readonly untriagedBacklogCount: number;
    readonly backlogCategories: readonly ITAnalyticsCategoryCount[];
    readonly backlogAssignees: readonly ITAnalyticsAssigneeCount[];
    readonly backlogOldestCreatedAt: Date | null;
    readonly departmentSnapshots: readonly ITAnalyticsDepartmentCount[];
    readonly newTicketCount: number;
    readonly firstResponses: readonly ITAnalyticsFirstResponseSample[];
    readonly createdAtValues: readonly Date[];
    readonly resolvedEvents: readonly ITAnalyticsResolvedEvent[];
    readonly resolvedTickets: readonly ITAnalyticsResolvedTicket[];
    /** Period-created Tickets grouped by current category identity. */
    readonly createdCategories: readonly ITAnalyticsCategoryCount[];
    readonly backlogAges: readonly ITAnalyticsBacklogAgeCount[];
    /** Active categories plus every category still referenced by a Ticket. */
    readonly categories: readonly ITAnalyticsCategoryName[];
}

function countOf(group: { readonly _count: { readonly _all: number } }): number {
    return group._count._all;
}

/** Empty scope yields `{}` so unfiltered predicates stay unchanged. */
function toTicketScopeWhere(scope: ITAnalyticsTicketScope | undefined): Prisma.ITTicketWhereInput {
    const where: Prisma.ITTicketWhereInput = {};
    if (scope?.type) where.type = scope.type;
    if (scope?.category !== undefined && scope.category !== null) {
        where.categoryId = scope.category === "uncategorized" ? null : scope.category;
    }
    return where;
}

function toBacklogAgeWhere(range: ITAnalyticsBacklogAgeRange): Prisma.ITTicketWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};
    if (range.createdAtLte !== null) createdAt.lte = range.createdAtLte;
    if (range.createdAtGt !== null) createdAt.gt = range.createdAtGt;
    return Object.keys(createdAt).length === 0 ? {} : { createdAt };
}

/** All queries are narrow, period-bounded or grouped and run on the caller's snapshot. */
export async function readITAnalyticsPersistenceSnapshot(
    tx: ITTicketAnalyticsPersistenceContext,
    window: ITAnalyticsQueryWindow,
): Promise<ITAnalyticsPersistenceSnapshot> {
    const scopeWhere = toTicketScopeWhere(window.scope);
    const hasScope = Object.keys(scopeWhere).length > 0;
    const backlogStatusFilter = [...window.backlogStatuses];
    const backlogWhere: Prisma.ITTicketWhereInput = {
        ...scopeWhere,
        status: { in: backlogStatusFilter },
    };
    const periodWhere: Prisma.ITTicketWhereInput = {
        ...scopeWhere,
        createdAt: { gte: window.startAt, lt: window.endAt },
    };

    const statusGroups = await tx.iTTicket.groupBy({
        by: ["status"],
        ...(hasScope ? { where: scopeWhere } : {}),
        _count: { _all: true },
    });
    const priorityGroups = await tx.iTTicket.groupBy({
        by: ["priority"],
        ...(hasScope ? { where: scopeWhere } : {}),
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
    const backlogPriorityGroups = await tx.iTTicket.groupBy({
        by: ["priority"],
        where: backlogWhere,
        _count: { _all: true },
    });
    const untriagedBacklogCount = await tx.iTTicket.count({
        where: { ...backlogWhere, triagedAt: null },
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
        select: { priority: true, createdAt: true, firstRespondedAt: true },
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
            ...(hasScope ? { ticket: scopeWhere } : {}),
        },
        _min: { occurredAt: true },
    });
    const resolvedIds = resolutionGroups.map((group) => group.ticketId);
    const resolvedTickets = resolvedIds.length === 0
        ? []
        : await tx.iTTicket.findMany({
            where: { id: { in: resolvedIds } },
            select: { id: true, createdAt: true, priority: true },
        });
    const createdCategoryGroups = await tx.iTTicket.groupBy({
        by: ["categoryId"],
        where: periodWhere,
        _count: { _all: true },
    });
    // One bounded count per aging bucket (five), each a `(status, createdAt)` range.
    const backlogAges: ITAnalyticsBacklogAgeCount[] = [];
    for (const range of window.backlogAgeRanges ?? []) {
        backlogAges.push({
            key: range.key,
            count: await tx.iTTicket.count({
                where: { ...backlogWhere, ...toBacklogAgeWhere(range) },
            }),
        });
    }
    // Reference data only; inactive rows stay reportable while still referenced.
    const categories = await tx.iTTicketCategory.findMany({
        where: { OR: [{ isActive: true }, { tickets: { some: {} } }] },
        select: { id: true, name: true, key: true, isActive: true },
        orderBy: { id: "asc" },
    });

    return {
        statuses: statusGroups.map((group) => ({
            status: group.status,
            count: countOf(group),
        })),
        priorities: priorityGroups.map((group) => ({
            priority: group.priority,
            count: countOf(group),
        })),
        backlogPriorities: backlogPriorityGroups.map((group) => ({
            priority: group.priority,
            count: countOf(group),
        })),
        untriagedBacklogCount,
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
                : [{
                    priority: row.priority,
                    createdAt: row.createdAt,
                    firstRespondedAt: row.firstRespondedAt,
                }],
        ),
        createdAtValues: createdRows.map((row) => row.createdAt),
        resolvedEvents: resolutionGroups.map((group) => ({
            ticketId: group.ticketId,
            occurredAt: group._min.occurredAt,
        })),
        resolvedTickets: resolvedTickets.map((ticket) => ({
            id: ticket.id,
            createdAt: ticket.createdAt,
            priority: ticket.priority,
        })),
        createdCategories: createdCategoryGroups.map((group) => ({
            categoryId: group.categoryId,
            count: countOf(group),
        })),
        backlogAges,
        categories,
    };
}
