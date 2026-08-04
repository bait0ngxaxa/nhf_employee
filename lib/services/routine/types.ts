export interface RoutineCommandActor {
    id: number;
    role: string;
    email: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    correlationId?: string;
}

export interface RoutineQueryActor {
    actor: RoutineCommandActor;
    employeeId: number | null;
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
