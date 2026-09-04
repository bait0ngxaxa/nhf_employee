export type RoutineAssigneeRole = "OWNER" | "CO_OWNER";
export type RoutineAssigneeState = Record<number, RoutineAssigneeRole>;

function firstEmployeeId(
    assignees: Readonly<Record<number, RoutineAssigneeRole>>,
    excludedId: number | null = null,
): number | null {
    const employeeIds = Object.keys(assignees)
        .map(Number)
        .filter((employeeId) => Number.isInteger(employeeId) && employeeId !== excludedId)
        .sort((left, right) => left - right);
    return employeeIds[0] ?? null;
}

export function normalizeRoutineAssignees(
    assignees: Readonly<Record<number, RoutineAssigneeRole>>,
): RoutineAssigneeState {
    const entries = Object.entries(assignees)
        .map(([employeeId, role]) => [Number(employeeId), role] as const)
        .filter(([employeeId]) => Number.isInteger(employeeId));
    if (entries.length === 0) return {};

    const ownerId = entries.find(([, role]) => role === "OWNER")?.[0]
        ?? firstEmployeeId(assignees);
    return Object.fromEntries(
        entries.map(([employeeId]) => [
            employeeId,
            employeeId === ownerId ? "OWNER" : "CO_OWNER",
        ]),
    ) as RoutineAssigneeState;
}

export function addRoutineAssignee(
    assignees: Readonly<Record<number, RoutineAssigneeRole>>,
    employeeId: number,
): RoutineAssigneeState {
    const next = normalizeRoutineAssignees(assignees);
    if (next[employeeId] !== undefined) return next;
    next[employeeId] = Object.keys(next).length === 0 ? "OWNER" : "CO_OWNER";
    return next;
}

export function removeRoutineAssignee(
    assignees: Readonly<Record<number, RoutineAssigneeRole>>,
    employeeId: number,
): RoutineAssigneeState {
    const next = normalizeRoutineAssignees(assignees);
    const wasOwner = next[employeeId] === "OWNER";
    delete next[employeeId];
    if (wasOwner && Object.keys(next).length > 0) {
        const replacementId = firstEmployeeId(next);
        if (replacementId !== null) next[replacementId] = "OWNER";
    }
    return next;
}

export function setRoutineAssigneeRole(
    assignees: Readonly<Record<number, RoutineAssigneeRole>>,
    employeeId: number,
    role: RoutineAssigneeRole,
): RoutineAssigneeState {
    const next = normalizeRoutineAssignees(assignees);
    if (next[employeeId] === undefined) return next;
    if (role === "OWNER") {
        for (const id of Object.keys(next)) {
            next[Number(id)] = Number(id) === employeeId ? "OWNER" : "CO_OWNER";
        }
        return next;
    }

    if (next[employeeId] !== "OWNER") {
        next[employeeId] = "CO_OWNER";
        return next;
    }

    const replacementId = firstEmployeeId(next, employeeId);
    if (replacementId === null) return next;
    next[employeeId] = "CO_OWNER";
    next[replacementId] = "OWNER";
    return next;
}
