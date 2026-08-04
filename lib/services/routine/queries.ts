import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    addCalendarDays,
    calendarDayDifference,
    calendarDateToDate,
    getCurrentBangkokDate,
    toBangkokCalendarDate,
} from "@/lib/routine/schedule";
import {
    getRoutineTimingStatus,
    type RoutineTimingStatus,
} from "@/lib/routine/timing";
import type {
    RoutineOccurrenceFilters,
    RoutineTaskFilters,
} from "@/lib/validations/routine";

import { RoutineNotFoundError } from "./errors";
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

type RoutineOccurrenceRow = Prisma.RoutineOccurrenceGetPayload<{
    select: typeof ROUTINE_OCCURRENCE_SELECT;
}>;

type RoutineTaskRow = Prisma.RoutineTaskGetPayload<{
    select: typeof ROUTINE_TASK_SELECT;
}>;

type RoutineTaskDetailRow = RoutineTaskRow & {
    occurrences: RoutineOccurrenceRow[];
};

function serializeEmployeeName(employee: {
    firstName: string;
    lastName: string;
    nickname: string | null;
}): string {
    const name = `${employee.firstName} ${employee.lastName}`.trim();
    return employee.nickname ? `${name} (${employee.nickname})` : name;
}

function serializeOccurrence(row: RoutineOccurrenceRow) {
    const dueDate = toBangkokCalendarDate(row.dueDate);
    const today = getCurrentBangkokDate();
    const daysUntilDue = calendarDayDifference(today, dueDate);
    const timingStatus = getRoutineTimingStatus(today, dueDate);
    return {
        ...row,
        dueDate,
        originalDueDate: toBangkokCalendarDate(row.originalDueDate),
        timingStatus,
        isOverdue: timingStatus === "OVERDUE",
        daysUntilDue,
        assignees: row.assignees.map((assignee) => ({
            employeeId: assignee.employeeId,
            role: assignee.role,
            employee: {
                ...assignee.employee,
                displayName: serializeEmployeeName(assignee.employee),
            },
        })),
    };
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
    isAdmin: boolean,
): Prisma.RoutineOccurrenceWhereInput {
    const occurrenceWhere = buildWorkOccurrenceWhere(filters, employeeId, isAdmin);
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
    isAdmin: boolean,
): Prisma.RoutineOccurrenceWhereInput {
    const shouldScopeToMine = !isAdmin || filters.scope === "mine";
    const assigneeId = shouldScopeToMine
        ? employeeId
        : filters.assigneeId ?? null;
    const dueDate = buildOccurrenceDueDateFilter(
        filters,
        getCurrentBangkokDate(),
    );

    return {
        ...(filters.occurrenceId ? { id: filters.occurrenceId } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(shouldScopeToMine || filters.assigneeId !== undefined
            ? scopedAssigneeWhere(assigneeId)
            : {}),
    };
}

export async function getRoutineOccurrences(
    filters: RoutineOccurrenceFilters,
    queryActor: RoutineQueryActor,
): Promise<{
    occurrences: SerializedRoutineOccurrence[];
    pagination: RoutinePagination;
}> {
    const isAdmin = queryActor.actor.role === "ADMIN";
    const employeeId = await resolveActorEmployeeId(queryActor);
    const where = buildOccurrenceWhere(filters, employeeId, isAdmin);
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
        occurrences: rows.map(serializeOccurrence),
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
): Promise<{
    occurrences: SerializedRoutineOccurrence[];
    pagination: RoutinePagination;
}> {
    const isAdmin = queryActor.actor.role === "ADMIN";
    const employeeId = await resolveActorEmployeeId(queryActor);
    const occurrenceWhere = buildWorkOccurrenceWhere(filters, employeeId, isAdmin);
    const search = filters.search?.trim();
    const taskWhere: Prisma.RoutineTaskWhereInput = {
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
        occurrences: { some: occurrenceWhere },
    };
    const [tasks, total] = await Promise.all([
        prisma.routineTask.findMany({
            where: taskWhere,
            select: {
                ...ROUTINE_TASK_SELECT,
                occurrences: {
                    where: occurrenceWhere,
                    select: ROUTINE_OCCURRENCE_SELECT,
                    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
                    take: 1,
                },
            },
            orderBy: [{ title: "asc" }, { id: "asc" }],
            skip: (filters.page - 1) * filters.limit,
            take: filters.limit,
        }),
        prisma.routineTask.count({ where: taskWhere }),
    ]);

    return {
        occurrences: tasks.flatMap((task) =>
            task.occurrences.length > 0
                ? [serializeOccurrence(task.occurrences[0])]
                : [],
        ),
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
    const isAdmin = queryActor.actor.role === "ADMIN";
    const employeeId = await resolveActorEmployeeId(queryActor);
    const where: Prisma.RoutineOccurrenceWhereInput = {
        id: occurrenceId,
        task: { isActive: true },
        ...(!isAdmin ? scopedAssigneeWhere(employeeId) : {}),
    };
    const row = await prisma.routineOccurrence.findFirst({
        where,
        select: ROUTINE_OCCURRENCE_SELECT,
    });
    if (!row) return null;

    const auditLogs = await prisma.auditLog.findMany({
        where: { entityType: "RoutineOccurrence", entityId: occurrenceId },
        select: {
            id: true,
            action: true,
            userId: true,
            userEmail: true,
            details: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
    });

    return {
        occurrence: serializeOccurrence(row),
        auditLogs: auditLogs.map((log) => ({
            ...log,
            createdAt: log.createdAt.toISOString(),
        })),
    };
}

export async function getRoutineSummary(queryActor: RoutineQueryActor): Promise<{
    today: number;
    dueSoon: number;
    overdue: number;
    within30Days: number;
    asOfDate: string;
}> {
    const isAdmin = queryActor.actor.role === "ADMIN";
    const employeeId = await resolveActorEmployeeId(queryActor);
    const assigneeScope = isAdmin ? {} : scopedAssigneeWhere(employeeId);
    const today = getCurrentBangkokDate();
    const nextSevenDays = addCalendarDays(today, 7);
    const nextThirtyDays = addCalendarDays(today, 30);

    const countTasksByDueDate = (dueDate: Prisma.DateTimeFilter) =>
        prisma.routineTask.count({
            where: {
                isActive: true,
                occurrences: {
                    some: { dueDate, ...assigneeScope },
                },
            },
        });
    const [todayCount, dueSoonCount, overdueCount, within30Days] =
        await Promise.all([
            countTasksByDueDate({ equals: calendarDateToDate(today) }),
            countTasksByDueDate({
                gt: calendarDateToDate(today),
                lte: calendarDateToDate(nextSevenDays),
            }),
            countTasksByDueDate({ lt: calendarDateToDate(today) }),
            countTasksByDueDate({
                gte: calendarDateToDate(today),
                lte: calendarDateToDate(nextThirtyDays),
            }),
        ]);

    return {
        today: todayCount,
        dueSoon: dueSoonCount,
        overdue: overdueCount,
        within30Days,
        asOfDate: today,
    };
}

export async function getRoutineTasks(
    filters: RoutineTaskFilters,
): Promise<{
    tasks: RoutineTaskRow[];
    pagination: RoutinePagination;
}> {
    const search = filters.search?.trim();
    const where: Prisma.RoutineTaskWhereInput = {
        ...(filters.activeOnly !== undefined
            ? { isActive: filters.activeOnly }
            : {}),
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

    return {
        tasks,
        pagination: {
            page: filters.page,
            limit: filters.limit,
            total,
            pages: Math.ceil(total / filters.limit),
        },
    };
}

export async function getRoutineTaskById(
    taskId: number,
): Promise<Omit<
    RoutineTaskDetailRow,
    "contractStartDate" | "contractEndDate" | "createdAt" | "updatedAt" | "occurrences"
> & {
    contractStartDate: string | null;
    contractEndDate: string | null;
    createdAt: string;
    updatedAt: string;
    occurrences: SerializedRoutineOccurrence[];
}> {
    const task = await prisma.routineTask.findUnique({
        where: { id: taskId },
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
        occurrences: task.occurrences.map(serializeOccurrence),
    };
}

export async function getRoutineReferenceData(): Promise<{
    units: Array<{ id: number; code: string; name: string }>;
    categories: Array<{ id: number; name: string; sortOrder: number }>;
    employees: Array<{
        id: number;
        firstName: string;
        lastName: string;
        nickname: string | null;
        departmentId: number;
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
            where: { status: "ACTIVE", deletedAt: null },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                departmentId: true,
            },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        }),
    ]);
    return { units, categories, employees };
}
