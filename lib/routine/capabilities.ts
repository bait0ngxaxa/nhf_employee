export interface RoutineTaskCapabilities {
    canEdit: boolean;
    canDelete: boolean;
}

export interface RoutineTaskCapabilityActor {
    actorId: number;
    employeeId: number | null;
    isAdmin: boolean;
}

export interface RoutineTaskCapabilityAssignee {
    employeeId: number;
    employee: {
        status: string;
        deletedAt: Date | null;
    } | null;
}

export interface RoutineTaskCapabilityTarget {
    createdById: number;
    assignees: readonly RoutineTaskCapabilityAssignee[];
}

export function resolveRoutineTaskCapabilities(
    task: RoutineTaskCapabilityTarget,
    actor: RoutineTaskCapabilityActor,
): RoutineTaskCapabilities {
    const isCreator = task.createdById === actor.actorId;
    const isCurrentMasterAssignee = actor.employeeId !== null
        && task.assignees.some(
            (assignee) => assignee.employeeId === actor.employeeId
                && assignee.employee?.status === "ACTIVE"
                && assignee.employee.deletedAt === null,
        );

    return {
        canEdit: actor.isAdmin || isCreator || isCurrentMasterAssignee,
        canDelete: actor.isAdmin || isCreator,
    };
}
