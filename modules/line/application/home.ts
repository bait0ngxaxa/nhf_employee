import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import type {
    LiffCapabilities,
    LiffHomeResponse,
} from "./types";

type LiffHomeRoutineReadCapabilities = Pick<
    LiffCapabilities["routineCapabilities"],
    "canReadTasks"
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
    capabilities: { routineCapabilities: LiffHomeRoutineReadCapabilities },
): LiffHomeResponse["modules"] {
    const configuredModules = getLiffConfiguredModules();
    const routineEnabled = configuredModules.routine.enabled
        && capabilities.routineCapabilities.canReadTasks === true;

    return {
        ...configuredModules,
        routine: {
            enabled: routineEnabled,
            status: routineEnabled ? "available" : "unavailable",
        },
    };
}
