export const ROUTINE_REMINDER_RECIPIENT_SCOPES = [
    "ASSIGNEES",
    "ALL_READERS",
    "ASSIGNEES_AND_ALL_READERS",
] as const;

export type RoutineReminderRecipientScope =
    (typeof ROUTINE_REMINDER_RECIPIENT_SCOPES)[number];

export function includesRoutineAssignees(
    scope: RoutineReminderRecipientScope,
): boolean {
    return scope === "ASSIGNEES" || scope === "ASSIGNEES_AND_ALL_READERS";
}

export function includesRoutineAllReaders(
    scope: RoutineReminderRecipientScope,
): boolean {
    return scope === "ALL_READERS"
        || scope === "ASSIGNEES_AND_ALL_READERS";
}
