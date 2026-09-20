import {
    ROUTINE_REMINDER_RECIPIENT_SCOPES,
    type RoutineReminderRecipientScope,
} from "../domain/reminder-recipients";

/**
 * These values are accepted only at persisted-data boundaries while the
 * MySQL enum is expanded. They are never part of the Routine business
 * vocabulary and must be normalized before application evaluation.
 */
export const LEGACY_ROUTINE_REMINDER_RECIPIENT_SCOPES = [
    "ADMINS",
    "ASSIGNEES_AND_ADMINS",
] as const;

export type PersistedRoutineReminderRecipientScope =
    | RoutineReminderRecipientScope
    | (typeof LEGACY_ROUTINE_REMINDER_RECIPIENT_SCOPES)[number];

export function normalizeRoutineReminderRecipientScope(
    value: string,
): RoutineReminderRecipientScope {
    if (value === "ADMINS") return "ALL_READERS";
    if (value === "ASSIGNEES_AND_ADMINS") {
        return "ASSIGNEES_AND_ALL_READERS";
    }
    if (isCanonicalRoutineReminderRecipientScope(value)) return value;
    throw new Error(`Unsupported Routine reminder recipient scope: ${value}`);
}

function isCanonicalRoutineReminderRecipientScope(
    value: string,
): value is RoutineReminderRecipientScope {
    return (ROUTINE_REMINDER_RECIPIENT_SCOPES as readonly string[]).includes(value);
}

export function normalizeRoutineReminderRules<
    T extends { readonly recipientScope: string },
>(
    rules: readonly T[],
): Array<Omit<T, "recipientScope"> & {
    recipientScope: RoutineReminderRecipientScope;
}> {
    return rules.map((rule) => {
        const { recipientScope, ...rest } = rule;
        return {
            ...rest,
            recipientScope: normalizeRoutineReminderRecipientScope(recipientScope),
        };
    });
}

export function normalizeRoutineReminderTask<
    T extends {
        readonly reminderRules: readonly { readonly recipientScope: string }[];
    },
>(
    task: T,
): Omit<T, "reminderRules"> & {
    reminderRules: ReturnType<typeof normalizeRoutineReminderRules<T["reminderRules"][number]>>;
} {
    return {
        ...task,
        reminderRules: normalizeRoutineReminderRules(task.reminderRules),
    };
}
