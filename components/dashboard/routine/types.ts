export type RoutineStatus =
    | "TODO"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "SKIPPED"
    | "CANCELLED";

export type RoutineAssigneeRole = "OWNER" | "CO_OWNER";

export interface RoutineEmployee {
    id: number;
    firstName: string;
    lastName: string;
    nickname: string | null;
    status?: string;
    deletedAt?: string | null;
    displayName?: string;
    departmentId?: number;
}

export interface RoutineAssignee {
    employeeId: number;
    role: RoutineAssigneeRole;
    employee: RoutineEmployee;
}

export interface RoutineOccurrence {
    id: number;
    taskId: number;
    periodKey: string;
    dueDate: string;
    originalDueDate: string;
    status: RoutineStatus;
    scheduleVersion: number;
    startedAt: string | null;
    completedAt: string | null;
    completedById: number | null;
    completionNote: string | null;
    referenceNo: string | null;
    skippedAt: string | null;
    skippedById: number | null;
    skipReason: string | null;
    cancelledAt: string | null;
    cancelledById: number | null;
    cancellationReason: string | null;
    createdAt: string;
    updatedAt: string;
    isOverdue?: boolean;
    daysUntilDue?: number;
    task: {
        id: number;
        title: string;
        description: string | null;
        scheduleType: string;
        scheduleText: string | null;
        unit: { id: number; code: string; name: string };
        category: { id: number; name: string };
    };
    assignees: RoutineAssignee[];
}

export interface RoutineTask {
    id: number;
    unitId: number;
    categoryId: number;
    title: string;
    description: string | null;
    scheduleType: string;
    scheduleConfig: unknown;
    scheduleText: string | null;
    contractStartDate: string | null;
    contractEndDate: string | null;
    contractText: string | null;
    extraDetails: string | null;
    businessDayPolicy: string;
    isActive: boolean;
    version: number;
    sourceFileName: string | null;
    sourceSheet: string | null;
    sourceRow: number | null;
    createdById: number;
    updatedById: number;
    createdAt: string;
    updatedAt: string;
    unit: { id: number; code: string; name: string; isActive?: boolean };
    category: { id: number; name: string; sortOrder?: number; isActive?: boolean };
    assignees: RoutineAssignee[];
    _count: { occurrences: number };
}

export interface RoutineSummary {
    today: number;
    dueSoon: number;
    overdue: number;
    completedThisMonth: number;
    asOfDate: string;
}

export interface RoutineReferenceData {
    units: Array<{ id: number; code: string; name: string }>;
    categories: Array<{ id: number; name: string; sortOrder: number }>;
    employees: RoutineEmployee[];
}

export interface PaginatedOccurrencesResponse {
    occurrences: RoutineOccurrence[];
    pagination: { page: number; limit: number; total: number; pages: number };
}

export interface PaginatedTasksResponse {
    tasks: RoutineTask[];
    pagination: { page: number; limit: number; total: number; pages: number };
}

export interface RoutineSummaryResponse {
    summary: RoutineSummary;
}

export interface RoutineApiError {
    error?: string;
}
