export const FEATURE_KEYS = {
    leave: "leave",
    itSupport: "itSupport",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

const FEATURE_DASHBOARD_TABS: Record<FeatureKey, readonly string[]> = {
    leave: ["leave-management", "manager-approval", "leave-history"],
    itSupport: ["it-support"],
};

function parseBooleanFlag(value: string | undefined): boolean | null {
    if (!value) {
        return null;
    }

    const normalizedValue = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalizedValue)) {
        return true;
    }
    if (["0", "false", "no", "off"].includes(normalizedValue)) {
        return false;
    }

    return null;
}

function getFeatureOverride(feature: FeatureKey): boolean | null {
    if (feature === FEATURE_KEYS.leave) {
        return parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_LEAVE);
    }

    if (feature === FEATURE_KEYS.itSupport) {
        return parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_ITSUPPORT);
    }

    return null;
}

export function isFeatureEnabled(feature: FeatureKey): boolean {
    return getFeatureOverride(feature) ?? process.env.NODE_ENV !== "production";
}

export function getFeatureForDashboardTab(tab: string): FeatureKey | null {
    const matchedFeature = Object.entries(FEATURE_DASHBOARD_TABS).find(
        ([, tabs]) => tabs.includes(tab),
    );

    return matchedFeature ? (matchedFeature[0] as FeatureKey) : null;
}

export function isDashboardTabEnabled(tab: string): boolean {
    const feature = getFeatureForDashboardTab(tab);
    return feature ? isFeatureEnabled(feature) : true;
}
