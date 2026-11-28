import { Prisma } from "@prisma/client";
import type {
    ITTicketEventKind,
    ITTicketPriority,
    ITTicketStatus,
    ITTicketType,
} from "@prisma/client";

import type {
    ITAnalyticsBacklogAgeBucketKey,
    ITAnalyticsCategoryFilter,
} from "../../contracts";

export type ITTicketAnalyticsPersistenceContext = Pick<
    Prisma.TransactionClient,
    "iTTicket" | "iTTicketCategory" | "iTTicketEvent" | "$queryRaw"
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
    /** The comparison ends at startAt. */
    readonly previousStartAt: Date;
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

export interface ITAnalyticsResolvedEvent {
    readonly ticketId: number;
    readonly occurredAt: Date | null;
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
    readonly previousNewTicketCount: number;
    readonly previousResolvedTicketCount: number;
    readonly closedTicketCount: number;
    readonly cancelledTicketCount: number;
    readonly reopenedTicketCount: number;
    readonly createdAtValues: readonly Date[];
    readonly resolvedEvents: readonly ITAnalyticsResolvedEvent[];
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
function toTicketScopeWhere(
    scope: ITAnalyticsTicketScope | undefined,
): { type?: ITTicketType; categoryId?: number | null } {
    const where: { type?: ITTicketType; categoryId?: number | null } = {};
    if (scope?.type) where.type = scope.type;
    if (scope?.category !== undefined && scope.category !== null) {
        where.categoryId = scope.category === "uncategorized" ? null : scope.category;
    }
    return where;
}

function toBacklogAgePredicate(range: ITAnalyticsBacklogAgeRange): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];
    if (range.createdAtLte !== null) conditions.push(Prisma.sql`createdAt <= ${range.createdAtLte}`);
    if (range.createdAtGt !== null) conditions.push(Prisma.sql`createdAt > ${range.createdAtGt}`);
    return conditions.length === 0 ? Prisma.sql`TRUE` : Prisma.join(conditions, " AND ");
}

/** All queries are narrow, period-bounded or grouped and run on the caller's snapshot. */
export async function readITAnalyticsPersistenceSnapshot(
    tx: ITTicketAnalyticsPersistenceContext,
    window: ITAnalyticsQueryWindow,
): Promise<ITAnalyticsPersistenceSnapshot> {
    const scopeWhere = toTicketScopeWhere(window.scope);
    const ticketScopePredicates: Prisma.Sql[] = [];
    if (scopeWhere.type !== undefined) {
        ticketScopePredicates.push(Prisma.sql`it_tickets.type = ${scopeWhere.type}`);
    }
    if (scopeWhere.categoryId !== undefined) {
        ticketScopePredicates.push(scopeWhere.categoryId === null
            ? Prisma.sql`it_tickets.categoryId IS NULL`
            : Prisma.sql`it_tickets.categoryId = ${scopeWhere.categoryId}`);
    }
    const hasScope = ticketScopePredicates.length > 0;
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
    const previousNewTicketCount = await tx.iTTicket.count({
        where: { ...scopeWhere, createdAt: { gte: window.previousStartAt, lt: window.startAt } },
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
    // Keep the existing current-resolution trend query. Fetch only scalar
    // counts for the comparison and the other transitions in one statement.
    const [eventCounts] = await tx.$queryRaw<readonly [{
        readonly previousResolvedTickets: bigint;
        readonly closedTickets: bigint;
        readonly cancelledTickets: bigint;
        readonly reopenedTickets: bigint;
    }]>(Prisma.sql`
        SELECT
            COUNT(DISTINCT CASE WHEN e.occurredAt < ${window.startAt}
                THEN e.ticketId END) AS previousResolvedTickets,
            COUNT(DISTINCT CASE WHEN e.toStatus = 'CLOSED' THEN e.ticketId END) AS closedTickets,
            COUNT(DISTINCT CASE WHEN e.toStatus = 'CANCELLED' THEN e.ticketId END) AS cancelledTickets,
            COUNT(DISTINCT CASE WHEN e.toStatus = 'IN_PROGRESS' THEN e.ticketId END) AS reopenedTickets
        FROM it_ticket_events AS e
        ${hasScope ? Prisma.sql`INNER JOIN it_tickets ON it_tickets.id = e.ticketId` : Prisma.empty}
        WHERE e.kind = ${window.resolutionEventKind}
          AND e.occurredAt >= ${window.previousStartAt} AND e.occurredAt < ${window.endAt}
          AND (
              (e.occurredAt < ${window.startAt} AND e.toStatus = ${window.resolutionStatus})
              OR (e.occurredAt >= ${window.startAt} AND (
                  e.toStatus IN ('CLOSED', 'CANCELLED')
                  OR (e.fromStatus = ${window.resolutionStatus} AND e.toStatus = 'IN_PROGRESS')
              ))
          )
          ${hasScope ? Prisma.sql`AND ${Prisma.join(ticketScopePredicates, " AND ")}` : Prisma.empty}
    `);
    const createdCategoryGroups = await tx.iTTicket.groupBy({
        by: ["categoryId"],
        where: periodWhere,
        _count: { _all: true },
    });
    // One indexed current-backlog scan; no Ticket rows leave the database.
    // Domain ranges partition all timestamps, including future dates in 0_1.
    const ranges = window.backlogAgeRanges ?? [];
    const ageScope: Prisma.Sql[] = [backlogStatusFilter.length === 0
        ? Prisma.sql`FALSE`
        : Prisma.sql`status IN (${Prisma.join(backlogStatusFilter)})`];
    ageScope.push(...ticketScopePredicates);
    const ageRows = ranges.length === 0 ? [] : await tx.$queryRaw<{
        readonly bucket: ITAnalyticsBacklogAgeBucketKey;
        readonly count: bigint;
    }[]>(Prisma.sql`
        SELECT CASE ${Prisma.join(ranges.map((range) =>
            Prisma.sql`WHEN ${toBacklogAgePredicate(range)} THEN ${range.key}`), " ")}
        END AS bucket, COUNT(*) AS count
        FROM it_tickets
        WHERE ${Prisma.join(ageScope, " AND ")}
        GROUP BY bucket
    `);
    const agesByKey = new Map(ageRows.map((row) => [row.bucket, Number(row.count)]));
    const backlogAges = ranges.map((range) => ({ key: range.key, count: agesByKey.get(range.key) ?? 0 }));
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
        previousNewTicketCount,
        previousResolvedTicketCount: Number(eventCounts.previousResolvedTickets),
        closedTicketCount: Number(eventCounts.closedTickets),
        cancelledTicketCount: Number(eventCounts.cancelledTickets),
        reopenedTicketCount: Number(eventCounts.reopenedTickets),
        createdAtValues: createdRows.map((row) => row.createdAt),
        resolvedEvents: resolutionGroups.map((group) => ({
            ticketId: group.ticketId,
            occurredAt: group._min.occurredAt,
        })),
        createdCategories: createdCategoryGroups.map((group) => ({
            categoryId: group.categoryId,
            count: countOf(group),
        })),
        backlogAges,
        categories,
    };
}
