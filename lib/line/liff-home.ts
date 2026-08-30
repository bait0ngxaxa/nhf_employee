import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import type { LiffHomeResponse } from "./liff-types";

export function getLiffHomeModules(): LiffHomeResponse["modules"] {
    const leaveEnabled = isFeatureEnabled(FEATURE_KEYS.leave);
    const routineEnabled = isFeatureEnabled(FEATURE_KEYS.routine);

    return {
        stock: { enabled: true, status: "coming-soon" },
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
