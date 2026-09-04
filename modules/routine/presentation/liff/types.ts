import type {
    RoutineBusinessDayPolicy,
    RoutineScheduleType,
} from "../../domain/schedule";
import type { RoutineTimingStatus } from "../../domain/timing";

export interface LiffRoutineSummary {
    today: number;
    dueSoon: number;
    within30Days: number;
    asOfDate: string;
}

export interface LiffRoutineTaskOccurrence {
    dueDate: string;
    timingStatus: RoutineTimingStatus;
    isOverdue: boolean;
    daysUntilDue: number;
}

export interface LiffRoutineTaskWorkItem {
    id: number;
    title: string;
    description: string | null;
    scheduleType: RoutineScheduleType;
    scheduleText: string | null;
    unit: { code: string; name: string };
    category: { name: string };
    relevantOccurrence: LiffRoutineTaskOccurrence | null;
}

export interface LiffRoutineTasksResponse {
    tasks: LiffRoutineTaskWorkItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface LiffRoutineReferenceData {
    units: Array<{ id: number; code: string; name: string }>;
    categories: Array<{ id: number; name: string; sortOrder: number }>;
    scheduleTypes: readonly RoutineScheduleType[];
    businessDayPolicies: readonly RoutineBusinessDayPolicy[];
}

export interface LiffRoutineTaskDetailOccurrence {
    id: number;
    taskId: number;
    periodKey: string;
    dueDate: string;
    originalDueDate: string;
    timingStatus: RoutineTimingStatus;
    isOverdue: boolean;
    daysUntilDue: number;
}

export interface LiffRoutineTaskReminderRule {
    daysBefore: number;
    sendHour: number;
    channel: "IN_APP";
    recipientScope: "ASSIGNEES";
    isActive: boolean;
}

export interface LiffRoutineTaskDetail {
    id: number;
    title: string;
    description: string | null;
    scheduleType: RoutineScheduleType;
    scheduleConfig: unknown;
    scheduleText: string | null;
    contractStartDate: string | null;
    contractEndDate: string | null;
    contractText: string | null;
    extraDetails: string | null;
    businessDayPolicy: RoutineBusinessDayPolicy;
    isActive: boolean;
    version: number;
    unit: { id: number; code: string; name: string };
    category: { id: number; name: string };
    reminderRules: LiffRoutineTaskReminderRule[];
    occurrences: LiffRoutineTaskDetailOccurrence[];
    canEdit: boolean;
    canDelete: boolean;
}

export interface LiffRoutineTaskDetailResponse {
    task: LiffRoutineTaskDetail;
}

export interface LiffRoutineTaskMutationResponse {
    task: LiffRoutineTaskDetail;
}

export interface LiffRoutineTaskCreateResponse
    extends LiffRoutineTaskMutationResponse {
    replayed: boolean;
}

export type LiffRoutineTimingFilter = "" | RoutineTimingStatus;
