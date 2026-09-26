import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import type {
    LiffCapabilities,
    LiffHomeResponse,
} from "./types";

type LiffHomeRoutineReadCapabilities = Pick<
    LiffCapabilities["routineCapabilities"],
    "canReadTasks"
>;

type LiffHomeStockCapabilities = Pick<
    LiffCapabilities["stockCapabilities"],
    "canReadCatalog" | "canReadOwnRequests" | "canProcessRequests"
>;

type LiffHomeLeaveCapabilities = Pick<
    LiffCapabilities["leaveCapabilities"],
    "canReadOwnRequests" | "canReadAssignedApprovals"
>;

type LiffHomeITCapabilities = Pick<
    LiffCapabilities["itCapabilities"],
    "canReadOwnTickets" | "canCreateOwnTickets"
>;

export function getLiffConfiguredModules(): LiffHomeResponse["modules"] {
    const leaveEnabled = isFeatureEnabled(FEATURE_KEYS.leave);
    const routineEnabled = isFeatureEnabled(FEATURE_KEYS.routine);

    return {
        stock: { enabled: true, status: "available" },
        leave: {
            enabled: leaveEnabled,
            status: leaveEnabled ? "available" : "unavailable",
        },
        routine: {
            enabled: routineEnabled,
            status: routineEnabled ? "available" : "unavailable",
        },
        it: { enabled: true, status: "available" },
    };
}

export function getLiffHomeModules(
    capabilities: {
        leaveCapabilities: LiffHomeLeaveCapabilities;
        routineCapabilities: LiffHomeRoutineReadCapabilities;
        stockCapabilities: LiffHomeStockCapabilities;
        itCapabilities: LiffHomeITCapabilities;
    },
): LiffHomeResponse["modules"] {
    const configuredModules = getLiffConfiguredModules();
    const stockEnabled = configuredModules.stock.enabled
        && (
            capabilities.stockCapabilities.canReadCatalog
            || capabilities.stockCapabilities.canReadOwnRequests
            || capabilities.stockCapabilities.canProcessRequests
        );
    const routineEnabled = configuredModules.routine.enabled
        && capabilities.routineCapabilities.canReadTasks === true;
    const leaveEnabled = configuredModules.leave.enabled
        && (
            capabilities.leaveCapabilities.canReadOwnRequests
            || capabilities.leaveCapabilities.canReadAssignedApprovals
        );
    const itEnabled = configuredModules.it.enabled
        && (
            capabilities.itCapabilities.canReadOwnTickets
            || capabilities.itCapabilities.canCreateOwnTickets
        );

    return {
        ...configuredModules,
        stock: {
            enabled: stockEnabled,
            status: stockEnabled ? "available" : "unavailable",
        },
        routine: {
            enabled: routineEnabled,
            status: routineEnabled ? "available" : "unavailable",
        },
        leave: {
            enabled: leaveEnabled,
            status: leaveEnabled ? "available" : "unavailable",
        },
        it: {
            enabled: itEnabled,
            status: itEnabled ? "available" : "unavailable",
        },
    };
}
