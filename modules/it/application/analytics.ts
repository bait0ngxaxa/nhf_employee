import { Prisma, ITTicketEventKind, ITTicketStatus } from "@prisma/client";

import { getUserDisplayName } from "@/shared/identity/display";
import { findCurrentEmployeeDisplayProjections } from "@/modules/employee";
import { prisma } from "@/lib/db/prisma";

import {
    IT_ANALYTICS_PERIODS,
    IT_ANALYTICS_TIME_ZONE,
    IT_TICKET_STATUS_OPTIONS,
    IT_TICKET_TYPE_OPTIONS,
    type ITAnalyticsDashboard,
    type ITAnalyticsPeriod,
} from "../contracts";
import { getITAnalyticsLocalDate, getITAnalyticsPeriodBounds } from "../domain/analytics-period";
import {
    ITCapabilityDeniedError,
    resolveITCapabilityInTransaction,
    type ITAuthorizationContext,
} from "./authorization";
import { assertITActorCurrentWorkforce } from "./workforce";
import { readITAnalyticsPersistenceSnapshot } from "../infrastructure/persistence/ticket-analytics-repository";

const CURRENT_BACKLOG_STATUSES = Object.freeze([
    ITTicketStatus.OPEN,
    ITTicketStatus.IN_PROGRESS,
    ITTicketStatus.WAITING_REQUESTER,
] as const);

export class ITAnalyticsInputValidationError extends Error {
    constructor() {
        super("ช่วงเวลารายงานไม่ถูกต้อง");
        this.name = "ITAnalyticsInputValidationError";
    }
}

export function parseITAnalyticsPeriod(value: string | undefined): ITAnalyticsPeriod {
    if (value === undefined) return "30D";
    if ((IT_ANALYTICS_PERIODS as readonly string[]).includes(value)) {
        return value as ITAnalyticsPeriod;
    }
    throw new ITAnalyticsInputValidationError();
}

function averageMinutes(durationsMs: readonly number[]): number | null {
    if (durationsMs.length === 0) return null;
    return durationsMs.reduce((total, duration) => total + duration, 0)
        / durationsMs.length
        / 60_000;
}

function sortedLabels(
    counts: ReadonlyMap<string, number>,
): readonly { readonly label: string; readonly count: number }[] {
    return [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => right.count - left.count
            || (left.label < right.label ? -1 : left.label > right.label ? 1 : 0));
}

function increment(map: Map<string, number>, key: string, count = 1): void {
    map.set(key, (map.get(key) ?? 0) + count);
}

interface IdentifiedDimensionRow {
    readonly identity: number | null;
    readonly label: string;
    readonly count: number;
}

interface QualifiedDimensionRow extends IdentifiedDimensionRow {
    readonly qualifier?: string;
}

function compareDimensionIdentity(
    left: number | null,
    right: number | null,
): number {
    if (left === null) return right === null ? 0 : -1;
    if (right === null) return 1;
    return left - right;
}

/** Disambiguates colliding display labels while preserving each ID-backed row. */
function disambiguateDimensionLabels<T extends IdentifiedDimensionRow>(
    rows: readonly T[],
    getQualifier: (row: T, duplicateOrdinal: number) => string,
): readonly T[] {
    const rowsByLabel = new Map<string, T[]>();
    for (const row of rows) {
        const sameLabelRows = rowsByLabel.get(row.label) ?? [];
        sameLabelRows.push(row);
        rowsByLabel.set(row.label, sameLabelRows);
    }

    const duplicateOrdinals = new Map<T, number>();
    for (const sameLabelRows of rowsByLabel.values()) {
        if (sameLabelRows.length < 2) continue;
        [...sameLabelRows]
            .sort((left, right) => compareDimensionIdentity(left.identity, right.identity))
            .forEach((row, index) => duplicateOrdinals.set(row, index + 1));
    }

    const reservedLabels = new Set(rows.map((row) => row.label));
    const assignedLabels = new Set<string>();
    const labelsByRow = new Map<T, string>();
    const stableRows = [...rows].sort((left, right) =>
        compareDimensionIdentity(left.identity, right.identity));

    for (const row of stableRows) {
        const duplicateOrdinal = duplicateOrdinals.get(row);
        if (duplicateOrdinal === undefined) {
            labelsByRow.set(row, row.label);
            assignedLabels.add(row.label);
            continue;
        }

        const qualifier = getQualifier(row, duplicateOrdinal);
        let collisionOrdinal = 0;
        let label = `${row.label} (${qualifier})`;
        while (assignedLabels.has(label) || reservedLabels.has(label)) {
            collisionOrdinal += 1;
            label = `${row.label} (${qualifier} · ${collisionOrdinal})`;
        }
        labelsByRow.set(row, label);
        assignedLabels.add(label);
    }

    return rows.map((row) => ({ ...row, label: labelsByRow.get(row) ?? row.label }));
}

function sortedDimensionRows(
    rows: readonly IdentifiedDimensionRow[],
): readonly { readonly label: string; readonly count: number }[] {
    return [...rows]
        .sort((left, right) => right.count - left.count
            || (left.label < right.label ? -1 : left.label > right.label ? 1 : 0)
            || compareDimensionIdentity(left.identity, right.identity))
        .map(({ label, count }) => ({ label, count }));
}

export async function getITAnalyticsDashboard(
    context: ITAuthorizationContext,
    periodInput?: string,
    now: Date = new Date(),
): Promise<ITAnalyticsDashboard> {
    const period = parseITAnalyticsPeriod(periodInput);
    const bounds = getITAnalyticsPeriodBounds(period, now);

    return prisma.$transaction(async (tx) => {
        await assertITActorCurrentWorkforce(tx, context);
        const analyticsAuthority = await resolveITCapabilityInTransaction(
            context,
            "it.analytics.read",
            tx,
        );
        if (!analyticsAuthority.scopes.includes("ALL")) {
            throw new ITCapabilityDeniedError(
                "it.analytics.read",
                analyticsAuthority.decision.reason ?? "NO_APPLICABLE_GRANT",
            );
        }

        const persistence = await readITAnalyticsPersistenceSnapshot(tx, {
            startAt: bounds.startAt,
            endAt: bounds.endAt,
            backlogStatuses: CURRENT_BACKLOG_STATUSES,
            resolutionEventKind: ITTicketEventKind.STATUS_CHANGED,
            resolutionStatus: ITTicketStatus.RESOLVED,
        });

        const activeAssignees = await findCurrentEmployeeDisplayProjections(
            persistence.backlogAssignees.flatMap((row) =>
                row.userId === null ? [] : [row.userId],
            ),
            tx,
        );
        const assigneeNames = new Map(activeAssignees.map((employee) => [
            employee.userId,
            getUserDisplayName({
                employee: {
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    nickname: employee.nickname,
                },
            }, "ผู้รับผิดชอบเดิม"),
        ]));

        const categoriesById = new Map(
            persistence.categories.map((category) => [category.id, category]),
        );
        const categoryRows = disambiguateDimensionLabels(
            persistence.backlogCategories.map((row): QualifiedDimensionRow => {
                const category = row.categoryId === null
                    ? undefined
                    : categoriesById.get(row.categoryId);
                return {
                    identity: row.categoryId,
                    label: row.categoryId === null
                        ? "ยังไม่จัดหมวดหมู่"
                        : category?.name ?? "หมวดหมู่เดิม",
                    count: row.count,
                    qualifier: row.categoryId === null
                        ? "ไม่ระบุหมวดหมู่"
                        : category?.key,
                };
            }),
            (row, ordinal) => row.qualifier ?? `หมวดหมู่ ${ordinal}`,
        );

        const assigneeRows = disambiguateDimensionLabels(
            persistence.backlogAssignees.map((row): IdentifiedDimensionRow => ({
                identity: row.userId,
                label: row.userId === null
                    ? "ยังไม่มีผู้รับผิดชอบ"
                    : assigneeNames.get(row.userId) ?? "ผู้รับผิดชอบเดิม",
                count: row.count,
            })),
            (_row, ordinal) => String(ordinal),
        );

        const departmentCounts = new Map<string, number>();
        for (const row of persistence.departmentSnapshots) {
            const label = row.departmentNameSnapshot?.trim() || "ไม่ระบุหน่วยงาน";
            increment(departmentCounts, label, row.count);
        }

        const statusCountMap = new Map(
            persistence.statuses.map((row) => [row.status, row.count]),
        );
        const typeCountMap = new Map(
            persistence.types.map((row) => [row.type, row.count]),
        );
        const statusDistribution = IT_TICKET_STATUS_OPTIONS.map(({ value }) => ({
            status: value,
            count: statusCountMap.get(value) ?? 0,
        }));
        const typeDistribution = IT_TICKET_TYPE_OPTIONS.map(({ value }) => ({
            type: value,
            count: typeCountMap.get(value) ?? 0,
        }));

        const trendCounts = new Map(bounds.dates.map((date) => [
            date,
            { created: 0, resolved: 0 },
        ]));
        for (const createdAt of persistence.createdAtValues) {
            const date = getITAnalyticsLocalDate(createdAt);
            const bucket = trendCounts.get(date);
            if (bucket) bucket.created += 1;
        }
        for (const event of persistence.resolvedEvents) {
            if (event.occurredAt === null) continue;
            const date = getITAnalyticsLocalDate(event.occurredAt);
            const bucket = trendCounts.get(date);
            if (bucket) bucket.resolved += 1;
        }

        const resolvedAtByTicketId = new Map(
            persistence.resolvedEvents.flatMap((event) =>
                event.occurredAt === null ? [] : [[event.ticketId, event.occurredAt] as const],
            ),
        );
        const createdAtByTicketId = new Map(
            persistence.resolvedTickets.map((ticket) => [ticket.id, ticket.createdAt]),
        );
        const resolutionDurations = [...resolvedAtByTicketId.entries()].flatMap(
            ([ticketId, resolvedAt]) => {
                const createdAt = createdAtByTicketId.get(ticketId);
                return createdAt === undefined
                    ? []
                    : [resolvedAt.getTime() - createdAt.getTime()];
            },
        );
        const firstResponseDurations = persistence.firstResponses.map((sample) =>
            sample.firstRespondedAt.getTime() - sample.createdAt.getTime(),
        );
        const backlogByStatus = new Map(
            persistence.statuses.map((row) => [row.status, row.count]),
        );
        const currentBacklog = CURRENT_BACKLOG_STATUSES.reduce(
            (total, status) => total + (backlogByStatus.get(status) ?? 0),
            0,
        );
        const unassignedBacklog = persistence.backlogAssignees.find(
            (row) => row.userId === null,
        )?.count ?? 0;

        return {
            generatedAt: now.toISOString(),
            timeZone: IT_ANALYTICS_TIME_ZONE,
            period: {
                key: bounds.key,
                startAt: bounds.startAt.toISOString(),
                endAt: bounds.endAt.toISOString(),
            },
            summary: {
                currentBacklog,
                waitingRequester: backlogByStatus.get(ITTicketStatus.WAITING_REQUESTER) ?? 0,
                unassignedBacklog,
                oldestUnresolvedAgeMinutes: persistence.backlogOldestCreatedAt === null
                    ? null
                    : Math.max(
                        0,
                        Math.floor((now.getTime() - persistence.backlogOldestCreatedAt.getTime()) / 60_000),
                    ),
                newTickets: persistence.newTicketCount,
                resolvedTickets: persistence.resolvedEvents.length,
                firstRespondedTickets: persistence.firstResponses.length,
                averageFirstResponseMinutes: averageMinutes(firstResponseDurations),
                averageResolutionMinutes: averageMinutes(resolutionDurations),
            },
            trend: bounds.dates.map((date) => ({
                date,
                ...(trendCounts.get(date) ?? { created: 0, resolved: 0 }),
            })),
            statusDistribution,
            typeDistribution,
            categoryBacklog: sortedDimensionRows(categoryRows),
            assigneeBacklog: sortedDimensionRows(assigneeRows),
            departmentCreated: sortedLabels(departmentCounts),
        };
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
}
