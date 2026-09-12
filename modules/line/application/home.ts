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
    };
}

export function getLiffHomeModules(
    capabilities: {
        routineCapabilities: LiffHomeRoutineReadCapabilities;
        stockCapabilities: LiffHomeStockCapabilities;
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
    };
}
