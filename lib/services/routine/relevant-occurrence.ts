import {
    compareCalendarDates,
    type CalendarDate,
} from "@/lib/routine/schedule";

export interface RoutineRelevantOccurrenceCandidate {
    id: number;
    taskId: number;
    dueDate: CalendarDate;
}

function compareFutureCandidates(
    left: RoutineRelevantOccurrenceCandidate,
    right: RoutineRelevantOccurrenceCandidate,
): number {
    const dateComparison = compareCalendarDates(left.dueDate, right.dueDate);
    return dateComparison !== 0 ? dateComparison : left.id - right.id;
}

export function resolveRelevantRoutineOccurrence<
    T extends RoutineRelevantOccurrenceCandidate,
>(
    occurrences: readonly T[],
    today: CalendarDate,
    focusOccurrenceId: number | null = null,
): T | null {
    if (focusOccurrenceId !== null) {
        const focused = occurrences.find(
            (occurrence) => occurrence.id === focusOccurrenceId,
        );
        if (focused) return focused;
    }

    const future = occurrences
        .filter((occurrence) => compareCalendarDates(occurrence.dueDate, today) >= 0)
        .sort(compareFutureCandidates);
    return future[0] ?? null;
}

export function resolveRelevantRoutineOccurrences<
    T extends RoutineRelevantOccurrenceCandidate,
>(
    occurrences: readonly T[],
    today: CalendarDate,
    focusOccurrenceId: number | null = null,
): Map<number, T> {
    const byTask = new Map<number, T[]>();
    for (const occurrence of occurrences) {
        const taskOccurrences = byTask.get(occurrence.taskId) ?? [];
        taskOccurrences.push(occurrence);
        byTask.set(occurrence.taskId, taskOccurrences);
    }

    const relevantByTask = new Map<number, T>();
    for (const [taskId, taskOccurrences] of byTask) {
        const relevant = resolveRelevantRoutineOccurrence(
            taskOccurrences,
            today,
            focusOccurrenceId,
        );
        if (relevant) relevantByTask.set(taskId, relevant);
    }
    return relevantByTask;
}
