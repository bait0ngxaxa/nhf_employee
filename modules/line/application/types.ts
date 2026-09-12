import type { RoutinePresentationCapabilities } from "@/modules/routine";
import type { StockPresentationCapabilities } from "@/modules/stock";

export interface LiffWorkforceIdentity {
    userId: number;
    employeeId: number;
    name: string | null;
}

export interface LiffWorkforceUser {
    id: number;
    role: string;
    email: string;
    name: string | null;
}

export interface VerifiedLineIdentity {
    lineUserId: string;
}

export interface LiffWorkforceSession {
    user: LiffWorkforceUser;
    employeeId: number;
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
    stockCapabilities: StockPresentationCapabilities;
    canRequestStock: boolean;
    canProcessStockRequests: boolean;
    canRequestLeave: boolean;
    canApproveLeave: boolean;
    canCreateOwnRoutine: boolean;
    routineCapabilities: RoutinePresentationCapabilities;
}

export interface LiffHomeResponse {
    workforce: LiffWorkforceIdentity;
    modules: LiffHomeModules;
    capabilities: LiffCapabilities;
}
