export interface LiffWorkforceIdentity {
    userId: number;
    employeeId: number;
    name: string | null;
}

export type LiffSessionResponse =
    | { linked: false }
    | { linked: true; workforce: LiffWorkforceIdentity };

export type LiffModuleStatus = "available" | "coming-soon" | "unavailable";

export interface LiffHomeModule {
    enabled: boolean;
    status: LiffModuleStatus;
}

export interface LiffHomeModules {
    stock: LiffHomeModule;
    leave: LiffHomeModule;
    routine: LiffHomeModule;
}

export interface LiffCapabilities {
    canRequestStock: boolean;
    canProcessStockRequests: boolean;
    canRequestLeave: boolean;
    canApproveLeave: boolean;
    canCreateOwnRoutine: boolean;
}

export interface LiffHomeResponse {
    workforce: LiffWorkforceIdentity;
    modules: LiffHomeModules;
    capabilities: LiffCapabilities;
}
