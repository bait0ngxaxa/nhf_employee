export interface RoutineCommandActor {
    id: number;
    role: string;
    email: string;
    mode?: "LIFF_SELF_SERVICE";
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    correlationId?: string;
}

export interface RoutineQueryActor {
    actor: RoutineCommandActor;
    employeeId: number | null;
}

export interface RoutinePresentationCapabilities {
    readonly canReadTasks: boolean;
    readonly canCreateTasks: boolean;
    readonly canUpdateTasks: boolean;
    readonly canDeleteTasks: boolean;

    readonly canReadOccurrences: boolean;
    readonly canOverrideOccurrences: boolean;
    readonly canReassignOccurrences: boolean;
    readonly canChangeOccurrenceDueDate: boolean;

    readonly canManageImports: boolean;
}

export interface RoutineGenerationResult {
    evaluated: number;
    created: number;
    existing: number;
}

export interface RoutineAssigneeSnapshot {
    employeeId: number;
    role: string;
}
