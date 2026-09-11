import type { Prisma } from "@prisma/client";

import { getAuditEntityHistory } from "@/modules/audit";
import { prisma } from "@/lib/db/prisma";
import { getEmployeeDisplayName } from "@/modules/employee";
import {
    addCalendarDays,
    calendarDayDifference,
    calendarDateToDate,
    getCurrentBangkokDate,
    toBangkokCalendarDate,
    type RoutineScheduleType,
} from "../domain/schedule";
import {
    getRoutineTimingStatus,
    type RoutineTimingStatus,
} from "../domain/timing";
import { isRoutineNotificationReady } from "../domain/notification-readiness";
import {
    resolveRoutineTaskCapabilities,
    type RoutineTaskCapabilities,
    type RoutineTaskCapabilityTarget,
} from "../domain/capabilities";
import type {
    RoutineOccurrenceFilters,
    RoutineSummaryScope,
    RoutineTaskFilters,
} from "../schemas/routine";

import { RoutineNotFoundError } from "./errors";
import {
    buildRoutineOccurrenceScope,
    buildRoutineTaskAccessScope,
    buildRoutineTaskScope,
    isRoutineAdminActor,
    resolveRoutineCapabilityForMigration,
    type RoutineCapabilityAuthorization,
} from "./authorization";
import type { AuthorizationScope } from "@/modules/authorization";
import { resolveRelevantRoutineOccurrences } from "./relevant-occurrence";
import type { RoutineQueryActor } from "./types";

const ROUTINE_OCCURRENCE_SELECT = {
    id: true,
    taskId: true,
    periodKey: true,
    dueDate: true,
    originalDueDate: true,
    scheduleVersion: true,
    reminderVersion: true,
    createdAt: true,
    updatedAt: true,
    task: {
        select: {
            id: true,
            title: true,
            description: true,
            scheduleType: true,
            scheduleText: true,
            unit: { select: { id: true, code: true, name: true } },
            category: { select: { id: true, name: true } },
        },
    },
    assignees: {
        select: {
            employeeId: true,
            role: true,
            employee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    nickname: true,
                    status: true,
                    deletedAt: true,
                },
            },
        },
    },
} as const satisfies Prisma.RoutineOccurrenceSelect;

const ROUTINE_TASK_SELECT = {
    id: true,
    unitId: true,
    categoryId: true,
    title: true,
    description: true,
    scheduleType: true,
    scheduleConfig: true,
    scheduleText: true,
    contractStartDate: true,
    contractEndDate: true,
    contractText: true,
    extraDetails: true,
    businessDayPolicy: true,
    isActive: true,
    version: true,
    sourceFileName: true,
    sourceSheet: true,
    sourceRow: true,
    createdById: true,
    updatedById: true,
    createdAt: true,
    updatedAt: true,
    unit: { select: { id: true, code: true, name: true, isActive: true } },
    category: {
        select: { id: true, name: true, sortOrder: true, isActive: true },
    },
    assignees: {
        select: {
            employeeId: true,
            role: true,
            employee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    nickname: true,
                    status: true,
                    deletedAt: true,
                },
            },
        },
    },
    reminderRules: {
        select: {
            id: true,
            daysBefore: true,
            sendHour: true,
            channel: true,
            recipientScope: true,
            isActive: true,
        },
        orderBy: [{ daysBefore: "asc" }, { sendHour: "asc" }],
    },
    _count: { select: { occurrences: true } },
} as const satisfies Prisma.RoutineTaskSelect;

const ROUTINE_OCCURRENCE_DATE_SELECT = {
    id: true,
    taskId: true,
    dueDate: true,
} as const satisfies Prisma.RoutineOccurrenceSelect;

type RoutineOccurrenceRow = Prisma.RoutineOccurrenceGetPayload<{
    select: typeof ROUTINE_OCCURRENCE_SELECT;
}>;

type RoutineTaskRow = Prisma.RoutineTaskGetPayload<{
    select: typeof ROUTINE_TASK_SELECT;
}>;

type RoutineTaskListRow = RoutineTaskRow & RoutineTaskCapabilities;

type RoutineTaskDetailRow = RoutineTaskRow & {
    occurrences: RoutineOccurrenceRow[];
};

type RoutineTaskDetailResultBase = Omit<
    RoutineTaskDetailRow,
    "contractStartDate" | "contractEndDate" | "createdAt" | "updatedAt" | "occurrences"
> & {
    contractStartDate: string | null;
    contractEndDate: string | null;
    createdAt: string;
    updatedAt: string;
    occurrences: SerializedRoutineOccurrence[];
};

export type RoutineTaskDetailResult = RoutineTaskDetailResultBase
    & RoutineTaskCapabilities;

type SerializedRoutineAssignee = ReturnType<typeof serializeAssignee>;

interface SerializedRoutineTaskOccurrence {
    id: number;
    taskId: number;
    periodKey: string;
    dueDate: string;
    originalDueDate: string;
    scheduleVersion: number;
    reminderVersion: number;
    timingStatus: RoutineTimingStatus;
    isOverdue: boolean;
    daysUntilDue: number;
    assignees: SerializedRoutineAssignee[];
}

export interface SerializedRoutineTaskWorkItem {
    canEdit: boolean;
    canDelete: boolean;
    id: number;
    title: string;
    description: string | null;
    scheduleType: RoutineScheduleType;
    scheduleConfig: RoutineTaskRow["scheduleConfig"];
    scheduleText: string | null;
    contractStartDate: string | null;
    contractEndDate: string | null;
    contractText: string | null;
    extraDetails: string | null;
    businessDayPolicy: RoutineTaskRow["businessDayPolicy"];
    isActive: boolean;
    unit: { id: number; code: string; name: string };
    category: { id: number; name: string };
    assignees: SerializedRoutineAssignee[];
    reminderRules: RoutineTaskRow["reminderRules"];
    relevantOccurrence: SerializedRoutineTaskOccurrence | null;
}

export interface RoutineTaskWorkItemQueryOptions {
    readonly authorizationMode?: "MIGRATED" | "DEFERRED_EXPORT";
}

function serializeAssignee(assignee: {
    employeeId: number;
    role: string;
    employee: {
        id: number;
        firstName: string;
        lastName: string;
        nickname: string | null;
        status: string;
        deletedAt: Date | null;
    };
}) {
    return {
        employeeId: assignee.employeeId,
        role: assignee.role,
        employee: {
            ...assignee.employee,
            displayName: getEmployeeDisplayName(assignee.employee),
        },
    };
}

function serializeOccurrence(
    row: RoutineOccurrenceRow,
    today = getCurrentBangkokDate(),
) {
    const dueDate = toBangkokCalendarDate(row.dueDate);
    const daysUntilDue = calendarDayDifference(today, dueDate);
    const timingStatus = getRoutineTimingStatus(today, dueDate);
    return {
        id: row.id,
        taskId: row.taskId,
        periodKey: row.periodKey,
        dueDate,
        originalDueDate: toBangkokCalendarDate(row.originalDueDate),
        scheduleVersion: row.scheduleVersion,
        reminderVersion: row.reminderVersion,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        task: {
            id: row.task.id,
            title: row.task.title,
            description: row.task.description,
            scheduleType: row.task.scheduleType,
            scheduleText: row.task.scheduleText,
            unit: {
                id: row.task.unit.id,
                code: row.task.unit.code,
                name: row.task.unit.name,
            },
            category: {
                id: row.task.category.id,
                name: row.task.category.name,
            },
        },
        assignees: row.assignees.map(serializeAssignee),
        timingStatus,
        isOverdue: timingStatus === "OVERDUE",
        daysUntilDue,
    };
}

export function serializeRoutineOccurrenceResponse(
    row: RoutineOccurrenceRow,
    today = getCurrentBangkokDate(),
): ReturnType<typeof serializeOccurrence> {
    return serializeOccurrence(row, today);
}

function buildOccurrenceDueDateFilter(
    filters: RoutineOccurrenceFilters,
    today: string,
): Prisma.DateTimeFilter | undefined {
    const dueDate: Prisma.DateTimeFilter = {};
    if (filters.dueFrom) dueDate.gte = calendarDateToDate(filters.dueFrom);
    if (filters.dueTo) dueDate.lte = calendarDateToDate(filters.dueTo);

    function setGte(value: Date): void {
        if (!dueDate.gte || value > dueDate.gte) dueDate.gte = value;
    }

    function setLte(value: Date): void {
        if (!dueDate.lte || value < dueDate.lte) dueDate.lte = value;
    }

    switch (filters.timingStatus as RoutineTimingStatus | undefined) {
        case "OVERDUE":
            dueDate.lt = calendarDateToDate(today);
            break;
        case "DUE_TODAY": {
            const date = calendarDateToDate(today);
            setGte(date);
            setLte(date);
            break;
        }
        case "DUE_SOON":
            dueDate.gt = calendarDateToDate(today);
            dueDate.lte = calendarDateToDate(addCalendarDays(today, 7));
            break;
        case "UPCOMING":
            dueDate.gt = calendarDateToDate(addCalendarDays(today, 7));
            break;
    }

    return Object.keys(dueDate).length > 0 ? dueDate : undefined;
}

type SerializedRoutineOccurrence = ReturnType<typeof serializeOccurrence>;

interface RoutinePagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

async function resolveActorEmployeeId(
    queryActor: RoutineQueryActor,
): Promise<number | null> {
    if (queryActor.employeeId !== null) return queryActor.employeeId;
    const user = await prisma.user.findUnique({
        where: { id: queryActor.actor.id },
        select: { employeeId: true },
    });
    return user?.employeeId ?? null;
}

function scopedAssigneeWhere(
    employeeId: number | null,
): Prisma.RoutineOccurrenceWhereInput {
    return {
        assignees: {
            some: {
                employeeId: employeeId === null ? { in: [] } : employeeId,
            },
        },
    };
}

function buildOccurrenceWhere(
    filters: RoutineOccurrenceFilters,
    employeeId: number | null,
    scopes: readonly AuthorizationScope[],
): Prisma.RoutineOccurrenceWhereInput {
    const occurrenceWhere = buildWorkOccurrenceWhere(filters, employeeId, scopes);
    const search = filters.search?.trim();

    return {
        ...occurrenceWhere,
        task: {
            isActive: true,
            ...(filters.unitId ? { unitId: filters.unitId } : {}),
            ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
            ...(search
                ? {
                      OR: [
                          { title: { contains: search } },
                          { description: { contains: search } },
                          { unit: { name: { contains: search } } },
                          { category: { name: { contains: search } } },
                      ],
                  }
                : {}),
        },
    };
}

function buildWorkOccurrenceWhere(
    filters: RoutineOccurrenceFilters,
    employeeId: number | null,
    scopes: readonly AuthorizationScope[],
): Prisma.RoutineOccurrenceWhereInput {
    const hasAllScope = scopes.includes("ALL");
    const shouldScopeToMine = !hasAllScope || filters.scope === "mine";
    const dueDate = buildOccurrenceDueDateFilter(
        filters,
        getCurrentBangkokDate(),
    );
    const ownershipWhere = shouldScopeToMine
        ? buildRoutineOccurrenceScope(employeeId, ["ASSIGNED"])
        : filters.assigneeId === undefined
            ? {}
            : scopedAssigneeWhere(filters.assigneeId);

    return {
        ...(filters.occurrenceId ? { id: filters.occurrenceId } : {}),
        ...(filters.taskId ? { taskId: filters.taskId } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...ownershipWhere,
    };
}

function buildTaskAssigneeWhere(
    filters: RoutineOccurrenceFilters,
    employeeId: number | null,
): Prisma.RoutineTaskWhereInput {
    const shouldScopeToMine = filters.scope !== "all";
    const assigneeId = shouldScopeToMine
        ? employeeId
        : filters.assigneeId ?? null;
    if (!shouldScopeToMine && filters.assigneeId === undefined) return {};

    return {
        assignees: {
            some: {
                employeeId: assigneeId === null ? { in: [] } : assigneeId,
            },
        },
    };
}

function buildTaskWhere(
    filters: RoutineOccurrenceFilters,
    employeeId: number | null,
): Prisma.RoutineTaskWhereInput {
    return {
        ...buildTaskMetadataWhere(filters),
        ...buildTaskAssigneeWhere(filters, employeeId),
    };
}

function buildTaskMetadataWhere(
    filters: RoutineOccurrenceFilters,
): Prisma.RoutineTaskWhereInput {
    const search = filters.search?.trim();
    return {
        isActive: true,
        ...(filters.taskId ? { id: filters.taskId } : {}),
        ...(filters.unitId ? { unitId: filters.unitId } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(search
            ? {
                  AND: [{
                      OR: [
                          { title: { contains: search } },
                          { description: { contains: search } },
                          { unit: { name: { contains: search } } },
                          { category: { name: { contains: search } } },
                      ],
                  }],
              }
            : {}),
    };
}

function buildRoutineTaskAccessWhere(
    queryActor: RoutineQueryActor,
    authorization: RoutineCapabilityAuthorization,
): Prisma.RoutineTaskWhereInput {
    return buildRoutineTaskAccessScope(
        queryActor.actor.id,
        authorization.actor.employeeId,
        authorization.scopes,
    );
}

async function getRoutineTaskCapabilities(
    task: RoutineTaskCapabilityTarget,
    queryActor: RoutineQueryActor,
    employeeId: number | null,
    authorizations?: {
        readonly edit: RoutineCapabilityAuthorization;
        readonly delete: RoutineCapabilityAuthorization;
    },
): Promise<RoutineTaskCapabilities> {
    return resolveRoutineTaskCapabilities(task, {
        actorId: queryActor.actor.id,
        employeeId,
        ...(authorizations
            ? {
                  editScopes: authorizations.edit.scopes,
                  deleteScopes: authorizations.delete.scopes,
              }
            : {
                  isAdmin: isRoutineAdminActor(
                      queryActor.actor.role,
                      queryActor.actor.mode,
                  ),
              }),
    });
}

async function resolveTaskMutationCapabilities(
    queryActor: RoutineQueryActor,
    employeeId: number | null,
): Promise<{
    edit: RoutineCapabilityAuthorization;
    delete: RoutineCapabilityAuthorization;
}> {
    const [edit, deleteAuthorization] = await Promise.all([
        resolveRoutineCapabilityForMigration(
            queryActor.actor,
            employeeId,
            "routine.task.update",
        ),
        resolveRoutineCapabilityForMigration(
            queryActor.actor,
            employeeId,
            "routine.task.delete",
        ),
    ]);
    return { edit, delete: deleteAuthorization };
}

function redactRoutineSourceMetadata<T extends {
    sourceFileName: string | null;
    sourceSheet: string | null;
    sourceRow: number | null;
}>(task: T, isAdministrative: boolean): T {
    if (isAdministrative) {
        return task;
    }

    return {
        ...task,
        sourceFileName: null,
        sourceSheet: null,
        sourceRow: null,
    };
}

function buildRoutineTaskReadWhere(
    filters: RoutineOccurrenceFilters,
    actorId: number,
    employeeId: number | null,
    authorization: RoutineCapabilityAuthorization,
): Prisma.RoutineTaskWhereInput {
    const mineScopes = authorization.scopes.includes("ALL")
        ? ["ASSIGNED"] as const
        : authorization.scopes;
    const ownershipWhere = filters.scope !== "all"
        ? buildRoutineTaskScope(
              actorId,
              employeeId,
              mineScopes,
          )
        : authorization.scopes.includes("ALL")
            ? buildTaskAssigneeWhere(filters, employeeId)
            : buildRoutineTaskScope(
                  actorId,
                  employeeId,
                  authorization.scopes,
              );

    return {
        ...buildTaskMetadataWhere(filters),
        ...ownershipWhere,
    };
}

function activeEmployeeWhere(): Prisma.EmployeeWhereInput {
    return {
        status: "ACTIVE",
        deletedAt: null,
        user: {
            is: {
                isActive: true,
                deletedAt: null,
            },
        },
    };
}

type RoutineFocusResolution =
    | { kind: "NONE" }
    | { kind: "AUTHORIZED_OCCURRENCE"; taskId: number }
    | { kind: "CURRENT_TASK_FALLBACK"; taskId: number }
    | { kind: "DENIED" };

interface RoutineFocusAuthorizationWhere {
    readonly allowUnscopedFocus: boolean;
    readonly task: Prisma.RoutineTaskWhereInput;
    readonly occurrence: Prisma.RoutineOccurrenceWhereInput;
}

function combineRoutineFocusPredicates<T>(
    predicates: readonly T[],
): T {
    if (predicates.length === 0) {
        return { AND: [{ id: { in: [] } }] } as T;
    }
    if (predicates.length === 1) return predicates[0];
    return { OR: predicates } as T;
}

function buildRoutineFocusAuthorizationWhere(
    filters: RoutineOccurrenceFilters,
    actorId: number,
    employeeId: number | null,
    scopes: readonly AuthorizationScope[] | null,
): RoutineFocusAuthorizationWhere {
    const allowUnscopedFocus = filters.scope === "all"
        && (scopes === null || scopes.includes("ALL"));
    if (allowUnscopedFocus) {
        return { allowUnscopedFocus, task: {}, occurrence: {} };
    }

    const taskPredicates: Prisma.RoutineTaskWhereInput[] = [];
    const occurrencePredicates: Prisma.RoutineOccurrenceWhereInput[] = [];
    const allowsCreated = scopes?.includes("CREATED") === true;
    const allowsAssigned = scopes === null
        || scopes.includes("ASSIGNED")
        || (filters.scope !== "all" && scopes.includes("ALL"));

    if (allowsCreated) {
        taskPredicates.push({ createdById: actorId });
        occurrencePredicates.push({ task: { createdById: actorId } });
    }

    if (allowsAssigned && employeeId !== null) {
        const activeAssignee = {
            employeeId,
            employee: activeEmployeeWhere(),
        };
        taskPredicates.push({ assignees: { some: activeAssignee } });
        taskPredicates.push({
            occurrences: {
                some: { assignees: { some: activeAssignee } },
            },
        });
        occurrencePredicates.push({
            task: { assignees: { some: activeAssignee } },
        });
        occurrencePredicates.push({ assignees: { some: activeAssignee } });
    }

    return {
        allowUnscopedFocus,
        task: combineRoutineFocusPredicates(taskPredicates),
        occurrence: combineRoutineFocusPredicates(occurrencePredicates),
    };
}

async function resolveRoutineFocus(
    filters: RoutineOccurrenceFilters,
    taskAccessWhere: Prisma.RoutineTaskWhereInput,
    focusAuthorization: RoutineFocusAuthorizationWhere,
): Promise<RoutineFocusResolution> {
    if (filters.occurrenceId === undefined) return { kind: "NONE" };
    if (filters.taskId === undefined) return { kind: "DENIED" };

    const occurrence = await prisma.routineOccurrence.findUnique({
        where: { id: filters.occurrenceId },
        select: {
            taskId: true,
            task: { select: { isActive: true } },
        },
    });
    if (!occurrence) {
        const fallbackTask = await prisma.routineTask.findFirst({
            where: taskAccessWhere,
            select: { id: true },
        });
        return fallbackTask
            ? { kind: "CURRENT_TASK_FALLBACK", taskId: fallbackTask.id }
            : { kind: "DENIED" };
    }
    if (!occurrence.task.isActive || occurrence.taskId !== filters.taskId) {
        return { kind: "DENIED" };
    }
    if (focusAuthorization.allowUnscopedFocus) {
        return { kind: "AUTHORIZED_OCCURRENCE", taskId: occurrence.taskId };
    }
    const authorizedOccurrence = await prisma.routineOccurrence.findFirst({
        where: {
            id: filters.occurrenceId,
            taskId: occurrence.taskId,
            task: { isActive: true },
            ...focusAuthorization.occurrence,
        },
        select: { taskId: true },
    });
    return authorizedOccurrence
        ? { kind: "AUTHORIZED_OCCURRENCE", taskId: authorizedOccurrence.taskId }
        : { kind: "DENIED" };
}

type RoutineOccurrenceCandidateWithRow = {
    id: number;
    taskId: number;
    dueDate: string;
    row: RoutineOccurrenceRow;
};

function resolveOccurrenceRows(
    rows: readonly RoutineOccurrenceRow[],
    today: string,
    focusOccurrenceId: number | null,
): Map<number, RoutineOccurrenceRow> {
    const candidates: RoutineOccurrenceCandidateWithRow[] = rows.map((row) => ({
        id: row.id,
        taskId: row.taskId,
        dueDate: toBangkokCalendarDate(row.dueDate),
        row,
    }));
    const relevant = resolveRelevantRoutineOccurrences(
        candidates,
        today,
        focusOccurrenceId,
    );
    return new Map(
        [...relevant].map(([taskId, candidate]) => [taskId, candidate.row]),
    );
}

async function findRoutineOccurrenceRowsForTasks(
    taskIds: readonly number[],
): Promise<RoutineOccurrenceRow[]> {
    if (taskIds.length === 0) return [];
    return prisma.routineOccurrence.findMany({
        where: { taskId: { in: [...taskIds] } },
        select: ROUTINE_OCCURRENCE_SELECT,
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    });
}

function serializeRoutineTaskWorkItem(
    task: RoutineTaskRow,
    relevantOccurrence: RoutineOccurrenceRow | undefined,
    today: string,
    capabilities: RoutineTaskCapabilities,
): SerializedRoutineTaskWorkItem {
    const serializedOccurrence = relevantOccurrence
        ? serializeOccurrence(relevantOccurrence, today)
        : null;

    return {
        ...capabilities,
        id: task.id,
        title: task.title,
        description: task.description,
        scheduleType: task.scheduleType,
        scheduleConfig: task.scheduleConfig,
        scheduleText: task.scheduleText,
        contractStartDate: task.contractStartDate
            ? toBangkokCalendarDate(task.contractStartDate)
            : null,
        contractEndDate: task.contractEndDate
            ? toBangkokCalendarDate(task.contractEndDate)
            : null,
        contractText: task.contractText,
        extraDetails: task.extraDetails,
        businessDayPolicy: task.businessDayPolicy,
        isActive: task.isActive,
        unit: {
            id: task.unit.id,
            code: task.unit.code,
            name: task.unit.name,
        },
        category: {
            id: task.category.id,
            name: task.category.name,
        },
        assignees: task.assignees.map(serializeAssignee),
        reminderRules: task.reminderRules,
        relevantOccurrence: serializedOccurrence
            ? {
                  id: serializedOccurrence.id,
                  taskId: serializedOccurrence.taskId,
                  periodKey: serializedOccurrence.periodKey,
                  dueDate: serializedOccurrence.dueDate,
                  originalDueDate: serializedOccurrence.originalDueDate,
                  scheduleVersion: serializedOccurrence.scheduleVersion,
                  reminderVersion: serializedOccurrence.reminderVersion,
                  timingStatus: serializedOccurrence.timingStatus,
                  isOverdue: serializedOccurrence.isOverdue,
                  daysUntilDue: serializedOccurrence.daysUntilDue,
                  assignees: serializedOccurrence.assignees,
              }
            : null,
    };
}

function matchesRoutineTaskOccurrenceFilters(
    occurrence: RoutineOccurrenceRow | undefined,
    filters: RoutineOccurrenceFilters,
    today: string,
): boolean {
    if (!occurrence) return false;
    const dueDate = toBangkokCalendarDate(occurrence.dueDate);
    if (filters.dueFrom && dueDate < filters.dueFrom) return false;
    if (filters.dueTo && dueDate > filters.dueTo) return false;
    if (
        filters.timingStatus
        && getRoutineTimingStatus(today, dueDate) !== filters.timingStatus
    ) {
        return false;
    }
    return true;
}

export async function getRoutineOccurrences(
    filters: RoutineOccurrenceFilters,
    queryActor: RoutineQueryActor,
): Promise<{
    occurrences: SerializedRoutineOccurrence[];
    pagination: RoutinePagination;
}> {
    const employeeId = await resolveActorEmployeeId(queryActor);
    const capabilityAuthorization = await resolveRoutineCapabilityForMigration(
        queryActor.actor,
        employeeId,
        "routine.occurrence.read",
    );
    const where = buildOccurrenceWhere(
        filters,
        employeeId,
        capabilityAuthorization.scopes,
    );
    const [rows, total] = await Promise.all([
        prisma.routineOccurrence.findMany({
            where,
            select: ROUTINE_OCCURRENCE_SELECT,
            orderBy: [{ dueDate: "asc" }, { id: "asc" }],
            skip: (filters.page - 1) * filters.limit,
            take: filters.limit,
        }),
        prisma.routineOccurrence.count({ where }),
    ]);

    return {
        occurrences: rows.map((row) => serializeOccurrence(row)),
        pagination: {
            page: filters.page,
            limit: filters.limit,
            total,
            pages: Math.ceil(total / filters.limit),
        },
    };
}

export async function getRoutineTaskWorkItems(
    filters: RoutineOccurrenceFilters,
    queryActor: RoutineQueryActor,
    options: RoutineTaskWorkItemQueryOptions = {},
): Promise<{
    tasks: SerializedRoutineTaskWorkItem[];
    pagination: RoutinePagination;
}> {
    const employeeId = await resolveActorEmployeeId(queryActor);
    const today = getCurrentBangkokDate();
    const isDeferredExport = options.authorizationMode === "DEFERRED_EXPORT";
    const capabilityAuthorization = isDeferredExport
        ? null
        : await resolveRoutineCapabilityForMigration(
              queryActor.actor,
              employeeId,
              "routine.task.read",
              {
                  taskReadView: "work-item",
                  requestedScope: filters.scope,
              },
          );
    const mutationAuthorizations = capabilityAuthorization
        ? await resolveTaskMutationCapabilities(queryActor, employeeId)
        : undefined;
    const taskWhere = capabilityAuthorization
        ? buildRoutineTaskReadWhere(
              filters,
              queryActor.actor.id,
              employeeId,
              capabilityAuthorization,
          )
        : buildTaskWhere(filters, employeeId);
    const focusAuthorization = buildRoutineFocusAuthorizationWhere(
        filters,
        queryActor.actor.id,
        employeeId,
        isDeferredExport ? null : capabilityAuthorization?.scopes ?? [],
    );
    const focus = await resolveRoutineFocus(
        filters,
        taskWhere,
        focusAuthorization,
    );
    if (focus.kind === "DENIED") {
        return {
            tasks: [],
            pagination: {
                page: filters.page,
                limit: filters.limit,
                total: 0,
                pages: 0,
            },
        };
    }
    const hasAuthorizedFocus = focus.kind === "AUTHORIZED_OCCURRENCE";
    const focusedTaskWhere: Prisma.RoutineTaskWhereInput = {
        ...(hasAuthorizedFocus
            ? buildTaskMetadataWhere(filters)
            : taskWhere),
        ...(focus.kind !== "NONE" ? { id: focus.taskId } : {}),
        ...(hasAuthorizedFocus && !isDeferredExport
            ? focusAuthorization.task
            : {}),
    };
    const hasValidFocus =
        hasAuthorizedFocus;
    const mustResolveBeforePagination =
        !hasValidFocus
        && (
            filters.timingStatus !== undefined
            || filters.dueFrom !== undefined
            || filters.dueTo !== undefined
        );

    if (mustResolveBeforePagination) {
        const taskIdRows = await prisma.routineTask.findMany({
            where: focusedTaskWhere,
            select: { id: true },
            orderBy: [{ title: "asc" }, { id: "asc" }],
        });
        const taskIds = taskIdRows.map((task) => task.id);
        const occurrenceRows = await findRoutineOccurrenceRowsForTasks(taskIds);
        const relevantByTask = resolveOccurrenceRows(
            occurrenceRows,
            today,
            null,
        );
        const matchingTaskIds = taskIds.filter((taskId) =>
            matchesRoutineTaskOccurrenceFilters(
                relevantByTask.get(taskId),
                filters,
                today,
            ),
        );
        const total = matchingTaskIds.length;
        const pageTaskIds = matchingTaskIds.slice(
            (filters.page - 1) * filters.limit,
            filters.page * filters.limit,
        );
        if (pageTaskIds.length === 0) {
            return {
                tasks: [],
                pagination: {
                    page: filters.page,
                    limit: filters.limit,
                    total,
                    pages: Math.ceil(total / filters.limit),
                },
            };
        }

        const tasks = await prisma.routineTask.findMany({
            where: { ...focusedTaskWhere, id: { in: pageTaskIds } },
            select: ROUTINE_TASK_SELECT,
            orderBy: [{ title: "asc" }, { id: "asc" }],
        });
        const tasksById = new Map(tasks.map((task) => [task.id, task]));
        const serializedTasks = await Promise.all(
            pageTaskIds.map(async (taskId) => {
                const task = tasksById.get(taskId);
                if (!task) return null;
                return serializeRoutineTaskWorkItem(
                    task,
                    relevantByTask.get(taskId),
                    today,
                    await getRoutineTaskCapabilities(
                        task,
                        queryActor,
                        employeeId,
                        mutationAuthorizations,
                    ),
                );
            }),
        );
        return {
            tasks: serializedTasks.filter(
                (task): task is SerializedRoutineTaskWorkItem => task !== null,
            ),
            pagination: {
                page: filters.page,
                limit: filters.limit,
                total,
                pages: Math.ceil(total / filters.limit),
            },
        };
    }

    const [tasks, total] = await Promise.all([
        prisma.routineTask.findMany({
            where: focusedTaskWhere,
            select: ROUTINE_TASK_SELECT,
            orderBy: [{ title: "asc" }, { id: "asc" }],
            skip: (filters.page - 1) * filters.limit,
            take: filters.limit,
        }),
        prisma.routineTask.count({ where: focusedTaskWhere }),
    ]);
    const occurrenceRows = await findRoutineOccurrenceRowsForTasks(
        tasks.map((task) => task.id),
    );
    let focusOccurrenceId = hasValidFocus
        ? filters.occurrenceId ?? null
        : null;
    if (
        hasValidFocus
        && !occurrenceRows.some(
            (occurrence) => occurrence.id === focusOccurrenceId,
        )
    ) {
        const fallbackTask = await prisma.routineTask.findFirst({
            where: focusedTaskWhere,
            select: { id: true },
        });
        if (!fallbackTask) {
            return {
                tasks: [],
                pagination: {
                    page: filters.page,
                    limit: filters.limit,
                    total: 0,
                    pages: 0,
                },
            };
        }
        focusOccurrenceId = null;
    }
    const relevantByTask = resolveOccurrenceRows(
        occurrenceRows,
        today,
        focusOccurrenceId,
    );

    const serializedTasks = await Promise.all(
        tasks.map(async (task) => serializeRoutineTaskWorkItem(
            task,
            relevantByTask.get(task.id),
            today,
            await getRoutineTaskCapabilities(
                task,
                queryActor,
                employeeId,
                mutationAuthorizations,
            ),
        )),
    );
    return {
        tasks: serializedTasks,
        pagination: {
            page: filters.page,
            limit: filters.limit,
            total,
            pages: Math.ceil(total / filters.limit),
        },
    };
}

export async function getRoutineOccurrenceById(
    occurrenceId: number,
    queryActor: RoutineQueryActor,
): Promise<{
    occurrence: SerializedRoutineOccurrence;
    auditLogs: Array<{
        id: number;
        action: string;
        userId: number | null;
        userEmail: string | null;
        details: string | null;
        createdAt: string;
    }>;
} | null> {
    const employeeId = await resolveActorEmployeeId(queryActor);
    const capabilityAuthorization = await resolveRoutineCapabilityForMigration(
        queryActor.actor,
        employeeId,
        "routine.occurrence.read",
    );
    const where: Prisma.RoutineOccurrenceWhereInput = {
        id: occurrenceId,
        task: { isActive: true },
        ...buildRoutineOccurrenceScope(
            employeeId,
            capabilityAuthorization.scopes,
        ),
    };
    const row = await prisma.routineOccurrence.findFirst({
        where,
        select: ROUTINE_OCCURRENCE_SELECT,
    });
    if (!row) return null;

    const auditLogs = await getAuditEntityHistory({
        entityType: "RoutineOccurrence",
        entityId: occurrenceId,
        limit: 100,
    });

    return {
        occurrence: serializeOccurrence(row),
        auditLogs: auditLogs.map((log) => ({
            ...log,
            createdAt: log.createdAt.toISOString(),
        })),
    };
}

export async function getRoutineSummary(
    queryActor: RoutineQueryActor & { scope?: RoutineSummaryScope },
): Promise<{
    today: number;
    dueSoon: number;
    within30Days: number;
    asOfDate: string;
}> {
    const isAdmin = isRoutineAdminActor(
        queryActor.actor.role,
        queryActor.actor.mode,
    );
    const employeeId = await resolveActorEmployeeId(queryActor);
    const scope = queryActor.scope ?? (isAdmin ? "all" : "mine");
    const today = getCurrentBangkokDate();
    const nextThirtyDays = addCalendarDays(today, 30);

    const taskWhere = buildTaskWhere(
        {
            scope,
            page: 1,
            limit: 1,
        },
        employeeId,
    );
    const taskRows = await prisma.routineTask.findMany({
        where: taskWhere,
        select: { id: true },
        orderBy: [{ title: "asc" }, { id: "asc" }],
    });
    const occurrenceRows = taskRows.length === 0
        ? []
        : await prisma.routineOccurrence.findMany({
              where: { taskId: { in: taskRows.map((task) => task.id) } },
              select: ROUTINE_OCCURRENCE_DATE_SELECT,
              orderBy: [{ dueDate: "asc" }, { id: "asc" }],
          });
    const relevantByTask = resolveRelevantRoutineOccurrences(
        occurrenceRows.map((occurrence) => ({
            id: occurrence.id,
            taskId: occurrence.taskId,
            dueDate: toBangkokCalendarDate(occurrence.dueDate),
        })),
        today,
    );

    let todayCount = 0;
    let dueSoonCount = 0;
    let within30Days = 0;
    for (const occurrence of relevantByTask.values()) {
        const timingStatus = getRoutineTimingStatus(today, occurrence.dueDate);
        if (timingStatus === "DUE_TODAY") todayCount += 1;
        if (timingStatus === "DUE_SOON") dueSoonCount += 1;
        if (
            occurrence.dueDate >= today
            && occurrence.dueDate <= nextThirtyDays
        ) {
            within30Days += 1;
        }
    }

    return {
        today: todayCount,
        dueSoon: dueSoonCount,
        within30Days,
        asOfDate: today,
    };
}

export async function getRoutineTasks(
    filters: RoutineTaskFilters,
    queryActor: RoutineQueryActor,
): Promise<{
    tasks: RoutineTaskListRow[];
    pagination: RoutinePagination;
}> {
    const employeeId = await resolveActorEmployeeId(queryActor);
    const capabilityAuthorization = await resolveRoutineCapabilityForMigration(
        queryActor.actor,
        employeeId,
        "routine.task.read",
    );
    const mutationAuthorizations = await resolveTaskMutationCapabilities(
        queryActor,
        employeeId,
    );
    const search = filters.search?.trim();
    const isActive = filters.status === "active"
        ? true
        : filters.status === "inactive"
            ? false
            : filters.activeOnly;
    const where: Prisma.RoutineTaskWhereInput = {
        ...buildRoutineTaskAccessWhere(queryActor, capabilityAuthorization),
        ...(isActive !== undefined
            ? { isActive }
            : {}),
        ...(filters.unitId ? { unitId: filters.unitId } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(search
            ? {
                  AND: [{
                      OR: [
                          { title: { contains: search } },
                          { description: { contains: search } },
                          { unit: { name: { contains: search } } },
                          { category: { name: { contains: search } } },
                      ],
                  }],
              }
            : {}),
    };
    const [tasks, total] = await Promise.all([
        prisma.routineTask.findMany({
            where,
            select: ROUTINE_TASK_SELECT,
            orderBy: [{ isActive: "desc" }, { title: "asc" }],
            skip: (filters.page - 1) * filters.limit,
            take: filters.limit,
        }),
        prisma.routineTask.count({ where }),
    ]);

    const serializedTasks = await Promise.all(
        tasks.map(async (task) => ({
            ...redactRoutineSourceMetadata(
                task,
                capabilityAuthorization.isAdministrative,
            ),
            ...await getRoutineTaskCapabilities(
                task,
                queryActor,
                employeeId,
                mutationAuthorizations,
            ),
        })),
    );
    return {
        tasks: serializedTasks,
        pagination: {
            page: filters.page,
            limit: filters.limit,
            total,
            pages: Math.ceil(total / filters.limit),
        },
    };
}

async function findRoutineTaskDetail(
    taskId: number,
    where: Prisma.RoutineTaskWhereInput,
): Promise<RoutineTaskDetailResultBase> {
    const task = await prisma.routineTask.findFirst({
        where,
        select: {
            ...ROUTINE_TASK_SELECT,
            occurrences: {
                select: {
                    ...ROUTINE_OCCURRENCE_SELECT,
                },
                orderBy: [{ dueDate: "asc" }, { id: "asc" }],
                take: 100,
            },
        },
    });
    if (!task) throw new RoutineNotFoundError();
    return {
        ...task,
        contractStartDate: task.contractStartDate
            ? toBangkokCalendarDate(task.contractStartDate)
            : null,
        contractEndDate: task.contractEndDate
            ? toBangkokCalendarDate(task.contractEndDate)
            : null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        occurrences: task.occurrences.map((row) => serializeOccurrence(row)),
    };
}

export async function getRoutineTaskById(
    taskId: number,
    queryActor: RoutineQueryActor,
): Promise<RoutineTaskDetailResult> {
    const employeeId = await resolveActorEmployeeId(queryActor);
    const capabilityAuthorization = await resolveRoutineCapabilityForMigration(
        queryActor.actor,
        employeeId,
        "routine.task.read",
    );
    const mutationAuthorizations = await resolveTaskMutationCapabilities(
        queryActor,
        employeeId,
    );
    const task = await findRoutineTaskDetail(taskId, {
        id: taskId,
        ...buildRoutineTaskAccessWhere(queryActor, capabilityAuthorization),
    });
    const visibleTask = redactRoutineSourceMetadata(
        task,
        capabilityAuthorization.isAdministrative,
    );
    return {
        ...visibleTask,
        ...await getRoutineTaskCapabilities(
            task,
            queryActor,
            employeeId,
            mutationAuthorizations,
        ),
    };
}

function buildLiffRoutineTaskAccessWhere(
    taskId: number,
    queryActor: RoutineQueryActor,
    employeeId: number | null,
    authorization: RoutineCapabilityAuthorization,
): Prisma.RoutineTaskWhereInput {
    if (
        !authorization.usedMigrationCompatibility
        && !authorization.usedLiffSelfServiceCompatibility
    ) {
        return {
            id: taskId,
            ...buildRoutineTaskAccessScope(
                queryActor.actor.id,
                employeeId,
                authorization.scopes,
            ),
        };
    }

    return {
        id: taskId,
        OR: [
            { createdById: queryActor.actor.id },
            ...(employeeId === null
                ? []
                : [{
                      isActive: true,
                      assignees: {
                          some: {
                              employeeId,
                              employee: activeEmployeeWhere(),
                          },
                      },
                  },
                  {
                      isActive: true,
                      occurrences: {
                          some: {
                              assignees: {
                                  some: {
                                      employeeId,
                                      employee: activeEmployeeWhere(),
                                  },
                              },
                          },
                      },
                  }]),
        ],
    };
}

export async function getLiffRoutineTaskById(
    taskId: number,
    queryActor: RoutineQueryActor,
): Promise<RoutineTaskDetailResult> {
    const employeeId = await resolveActorEmployeeId(queryActor);
    const capabilityAuthorization = await resolveRoutineCapabilityForMigration(
        queryActor.actor,
        employeeId,
        "routine.task.read",
    );
    const mutationAuthorizations = await resolveTaskMutationCapabilities(
        queryActor,
        employeeId,
    );
    const task = await findRoutineTaskDetail(
        taskId,
        buildLiffRoutineTaskAccessWhere(
            taskId,
            queryActor,
            employeeId,
            capabilityAuthorization,
        ),
    );
    return {
        ...task,
        ...await getRoutineTaskCapabilities(
            task,
            queryActor,
            employeeId,
            mutationAuthorizations,
        ),
    };
}

export async function getRoutineReferenceData(
    queryActor: RoutineQueryActor,
): Promise<{
    units: Array<{ id: number; code: string; name: string }>;
    categories: Array<{ id: number; name: string; sortOrder: number }>;
    employees: Array<{
        id: number;
        firstName: string;
        lastName: string;
        nickname: string | null;
        departmentId: number;
        notificationReady: boolean;
    }>;
}> {
    const [units, categories, employees] = await Promise.all([
        prisma.routineUnit.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true },
            orderBy: { code: "asc" },
        }),
        prisma.routineCategory.findMany({
            where: { isActive: true },
            select: { id: true, name: true, sortOrder: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
        prisma.employee.findMany({
            where: isRoutineAdminActor(
                queryActor.actor.role,
                queryActor.actor.mode,
            )
                ? { status: "ACTIVE", deletedAt: null }
                : {
                      status: "ACTIVE",
                      deletedAt: null,
                      user: {
                          is: {
                              id: queryActor.actor.id,
                              isActive: true,
                              deletedAt: null,
                          },
                      },
                  },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                departmentId: true,
                status: true,
                deletedAt: true,
                user: {
                    select: {
                        isActive: true,
                        deletedAt: true,
                    },
                },
            },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        }),
    ]);
    return {
        units,
        categories,
        employees: employees.map((employee) => ({
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            nickname: employee.nickname,
            departmentId: employee.departmentId,
            notificationReady: isRoutineNotificationReady(employee),
        })),
    };
}
