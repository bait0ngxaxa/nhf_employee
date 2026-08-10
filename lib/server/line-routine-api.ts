import type { getRoutineTaskWorkItems } from "@/lib/services/routine";
import type { LiffRoutineTasksResponse } from "@/lib/line/routine-types";

type RoutineTaskWorkItemsResult = Awaited<
    ReturnType<typeof getRoutineTaskWorkItems>
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
