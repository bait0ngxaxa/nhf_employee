export interface RoutineCommandActor {
    id: number;
    role: string;
    email: string;
    /** Server-derived employee ID used only as a workforce row-lock hint. */
    employeeIdHint?: number | null;
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
    readonly canReadAllTasks: boolean;
    readonly canCreateTasks: boolean;
    readonly canCreateTasksForOthers: boolean;
    readonly canUpdateTasks: boolean;
    readonly canUpdateAllTasks: boolean;
    readonly canDeleteTasks: boolean;
    readonly canDeleteAllTasks: boolean;

    readonly canReadOccurrences: boolean;
    readonly canOverrideOccurrences: boolean;
    readonly canReassignOccurrences: boolean;
    readonly canChangeOccurrenceDueDate: boolean;

    readonly canExportTasks: boolean;
    readonly canReadSummary: boolean;
    readonly canReadAllSummary: boolean;
    readonly canReadReference: boolean;
    readonly canReadAllReferences: boolean;
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
