import type { RoutineScheduleType } from "@/lib/routine/schedule";
import type { RoutineTimingStatus } from "@/lib/routine/timing";

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

export type LiffRoutineTimingFilter = "" | RoutineTimingStatus;
