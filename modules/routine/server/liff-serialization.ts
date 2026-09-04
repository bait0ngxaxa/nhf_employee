import {
    ROUTINE_BUSINESS_DAY_POLICIES,
    ROUTINE_SCHEDULE_TYPES,
} from "../domain/schedule";
import type { getLiffRoutineTaskById, getRoutineReferenceData, getRoutineTaskWorkItems } from "../application/queries";
import type {
    LiffRoutineReferenceData,
    LiffRoutineTaskDetail,
    LiffRoutineTasksResponse,
} from "../presentation/liff/types";

type RoutineTaskWorkItemsResult = Awaited<
    ReturnType<typeof getRoutineTaskWorkItems>
>;
type RoutineReferenceDataResult = Awaited<
    ReturnType<typeof getRoutineReferenceData>
>;
type LiffRoutineTaskDetailResult = Awaited<
    ReturnType<typeof getLiffRoutineTaskById>
>;

export function serializeLiffRoutineTasks(
    result: RoutineTaskWorkItemsResult,
): LiffRoutineTasksResponse {
    return {
        tasks: result.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            scheduleType: task.scheduleType,
            scheduleText: task.scheduleText,
            unit: {
                code: task.unit.code,
                name: task.unit.name,
            },
            category: {
                name: task.category.name,
            },
            relevantOccurrence: task.relevantOccurrence
                ? {
                      dueDate: task.relevantOccurrence.dueDate,
                      timingStatus: task.relevantOccurrence.timingStatus,
                      isOverdue: task.relevantOccurrence.isOverdue,
                      daysUntilDue: task.relevantOccurrence.daysUntilDue,
                  }
                : null,
        })),
        pagination: result.pagination,
    };
}

export function serializeLiffRoutineReference(
    result: RoutineReferenceDataResult,
): LiffRoutineReferenceData {
    return {
        units: result.units.map((unit) => ({
            id: unit.id,
            code: unit.code,
            name: unit.name,
        })),
        categories: result.categories.map((category) => ({
            id: category.id,
            name: category.name,
            sortOrder: category.sortOrder,
        })),
        scheduleTypes: [...ROUTINE_SCHEDULE_TYPES],
        businessDayPolicies: [...ROUTINE_BUSINESS_DAY_POLICIES],
    };
}

export function serializeLiffRoutineTaskDetail(
    task: LiffRoutineTaskDetailResult,
): LiffRoutineTaskDetail {
    return {
        id: task.id,
        title: task.title,
        description: task.description,
        scheduleType: task.scheduleType,
        scheduleConfig: task.scheduleConfig,
        scheduleText: task.scheduleText,
        contractStartDate: task.contractStartDate,
        contractEndDate: task.contractEndDate,
        contractText: task.contractText,
        extraDetails: task.extraDetails,
        businessDayPolicy: task.businessDayPolicy,
        isActive: task.isActive,
        version: task.version,
        unit: {
            id: task.unit.id,
            code: task.unit.code,
            name: task.unit.name,
        },
        category: {
            id: task.category.id,
            name: task.category.name,
        },
        reminderRules: task.canEdit
            ? task.reminderRules.map((rule) => ({
                  daysBefore: rule.daysBefore,
                  sendHour: rule.sendHour,
                  channel: "IN_APP" as const,
                  recipientScope: "ASSIGNEES" as const,
                  isActive: rule.isActive,
              }))
            : [],
        occurrences: task.occurrences.map((occurrence) => ({
            id: occurrence.id,
            taskId: occurrence.taskId,
            periodKey: occurrence.periodKey,
            dueDate: occurrence.dueDate,
            originalDueDate: occurrence.originalDueDate,
            timingStatus: occurrence.timingStatus,
            isOverdue: occurrence.isOverdue,
            daysUntilDue: occurrence.daysUntilDue,
        })),
        canEdit: task.canEdit,
        canDelete: task.canDelete,
    };
}
