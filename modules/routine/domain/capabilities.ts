import type { AuthorizationScope } from "@/modules/authorization";

export interface RoutineTaskCapabilities {
    canEdit: boolean;
    canDelete: boolean;
}

export interface RoutineTaskCapabilityActor {
    actorId: number;
    employeeId: number | null;
    /** Retained for callers that only expose legacy presentation projections. */
    isAdmin?: boolean;
    editScopes?: readonly AuthorizationScope[];
    deleteScopes?: readonly AuthorizationScope[];
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

    const canUseScope = (
        scopes: readonly AuthorizationScope[] | undefined,
        fallback: boolean,
    ): boolean => {
        if (scopes === undefined) return fallback;
        if (scopes.includes("ALL")) return true;
        return (
            (scopes.includes("CREATED") && isCreator)
            || (scopes.includes("ASSIGNED") && isCurrentMasterAssignee)
        );
    };

    return {
        canEdit: canUseScope(
            actor.editScopes,
            actor.isAdmin === true || isCreator || isCurrentMasterAssignee,
        ),
        canDelete: canUseScope(
            actor.deleteScopes,
            actor.isAdmin === true || isCreator,
        ),
    };
}
