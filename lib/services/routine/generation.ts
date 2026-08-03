import type { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { buildRoutineScheduleDefinition } from "@/lib/validations/routine";
import {
    calculateRoutineOccurrences,
    calendarDateToDate,
    compareCalendarDates,
    getRoutineGenerationWindow,
    toBangkokCalendarDate,
    type RoutineScheduleType,
} from "@/lib/routine/schedule";
import { runSerializableTransaction } from "@/lib/db/transaction";

import { RoutineValidationError } from "./errors";
import type { RoutineGenerationResult } from "./types";

function isOccurrenceUniqueConflict(error: unknown): boolean {
    if (
        typeof error !== "object"
        || error === null
        || !("code" in error)
        || error.code !== "P2002"
        || !("meta" in error)
        || typeof error.meta !== "object"
        || error.meta === null
        || !("target" in error.meta)
        || !Array.isArray(error.meta.target)
    ) {
        return false;
    }

    return (
        error.meta.target.includes("taskId")
        && error.meta.target.includes("periodKey")
    );
}

export async function generateRoutineTaskOccurrences(
    taskId: number,
    now = new Date(),
): Promise<RoutineGenerationResult> {
    return runSerializableTransaction((tx) =>
        generateRoutineTaskOccurrencesInTransaction(tx, taskId, now),
    );
}

export async function generateRoutineTaskOccurrencesInTransaction(
    tx: Prisma.TransactionClient,
    taskId: number,
    now = new Date(),
): Promise<RoutineGenerationResult> {
    const task = await tx.routineTask.findUnique({
        where: { id: taskId },
        select: {
            id: true,
            isActive: true,
            scheduleType: true,
            scheduleConfig: true,
            businessDayPolicy: true,
            version: true,
            contractStartDate: true,
            contractEndDate: true,
            assignees: {
                select: { employeeId: true, role: true },
            },
        },
    });

    if (!task || !task.isActive || task.scheduleType === "MANUAL") {
        return { evaluated: 0, created: 0, existing: 0 };
    }

    let definition;
    try {
        definition = buildRoutineScheduleDefinition(
            task.scheduleType as RoutineScheduleType,
            task.scheduleConfig,
        );
    } catch (error) {
        if (error instanceof ZodError) {
            throw new RoutineValidationError(
                "กำหนดค่าตารางงานประจำไม่ถูกต้อง",
            );
        }
        throw error;
    }

    const window = getRoutineGenerationWindow(now);
    const scheduledOccurrences = calculateRoutineOccurrences(
        definition,
        window,
        task.businessDayPolicy,
    );
    const contractStartDate = task.contractStartDate
        ? toBangkokCalendarDate(task.contractStartDate)
        : null;
    const contractEndDate = task.contractEndDate
        ? toBangkokCalendarDate(task.contractEndDate)
        : null;

    const eligibleOccurrences = scheduledOccurrences.filter((occurrence) => {
        if (
            contractStartDate
            && compareCalendarDates(occurrence.dueDate, contractStartDate) < 0
        ) {
            return false;
        }
        if (
            contractEndDate
            && compareCalendarDates(occurrence.dueDate, contractEndDate) > 0
        ) {
            return false;
        }
        return true;
    });

    let created = 0;
    let existing = 0;
    for (const occurrence of eligibleOccurrences) {
        const current = await tx.routineOccurrence.findUnique({
            where: {
                taskId_periodKey: {
                    taskId: task.id,
                    periodKey: occurrence.periodKey,
                },
            },
            select: { id: true },
        });
        if (current) {
            existing += 1;
            continue;
        }

        try {
            await tx.routineOccurrence.upsert({
                where: {
                    taskId_periodKey: {
                        taskId: task.id,
                        periodKey: occurrence.periodKey,
                    },
                },
                update: {},
                create: {
                    taskId: task.id,
                    periodKey: occurrence.periodKey,
                    dueDate: calendarDateToDate(occurrence.dueDate),
                    originalDueDate: calendarDateToDate(occurrence.originalDueDate),
                    status: "TODO",
                    scheduleVersion: task.version,
                    assignees: {
                        create: task.assignees.map((assignee) => ({
                            employeeId: assignee.employeeId,
                            role: assignee.role,
                        })),
                    },
                },
            });
            created += 1;
        } catch (error) {
            if (!isOccurrenceUniqueConflict(error)) {
                throw error;
            }
            existing += 1;
        }
    }

    return {
        evaluated: eligibleOccurrences.length,
        created,
        existing,
    };
}
