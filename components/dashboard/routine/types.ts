import type { RoutineTimingStatus } from "@/lib/routine/timing";
import type { RoutineScheduleType } from "@/lib/routine/schedule";
import type { RoutineAssigneeRole } from "@/lib/routine/assignees";

export type { RoutineTimingStatus } from "@/lib/routine/timing";
export type { RoutineAssigneeRole } from "@/lib/routine/assignees";

export type RoutineReminderRecipientScope =
    | "ASSIGNEES"
    | "ADMINS"
    | "ASSIGNEES_AND_ADMINS";

export interface RoutineReminderRule {
    id: number;
    daysBefore: number;
    sendHour: number;
    channel: "IN_APP";
    recipientScope: RoutineReminderRecipientScope;
    isActive: boolean;
}

export interface RoutineEmployee {
    id: number;
    firstName: string;
    lastName: string;
    nickname: string | null;
    status?: string;
    deletedAt?: string | null;
    displayName?: string;
    departmentId?: number;
    notificationReady?: boolean;
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
    scheduleVersion: number;
    reminderVersion: number;
    createdAt: string;
    updatedAt: string;
    timingStatus: RoutineTimingStatus;
    isOverdue: boolean;
    daysUntilDue: number;
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

export interface RoutineTaskWorkItemOccurrence {
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
    assignees: RoutineAssignee[];
}

export interface RoutineTaskWorkItem {
    id: number;
    title: string;
    description: string | null;
    scheduleType: RoutineScheduleType;
    scheduleText: string | null;
    isActive: boolean;
    unit: { id: number; code: string; name: string };
    category: { id: number; name: string };
    assignees: RoutineAssignee[];
    relevantOccurrence: RoutineTaskWorkItemOccurrence | null;
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
    reminderRules: RoutineReminderRule[];
    _count: { occurrences: number };
}

export interface RoutineSummary {
    today: number;
    dueSoon: number;
    within30Days: number;
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

export interface PaginatedRoutineTaskWorkItemsResponse {
    tasks: RoutineTaskWorkItem[];
    pagination: { page: number; limit: number; total: number; pages: number };
}

export interface PaginatedTasksResponse {
    tasks: RoutineTask[];
    pagination: { page: number; limit: number; total: number; pages: number };
}

export interface RoutineSummaryResponse {
    summary: RoutineSummary;
}

export interface RoutineTaskByIdResponse {
    task: RoutineTask;
}

export interface RoutineApiError {
    error?: string;
}
