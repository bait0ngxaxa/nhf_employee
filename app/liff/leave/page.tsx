import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LiffModuleLanding } from "@/components/liff/LiffModuleLanding";
import { LiffLeaveApp } from "@/components/liff/leave/LiffLeaveApp";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";

export const metadata: Metadata = {
    title: "Leave ผ่าน LINE | NHFapp",
};

export default function Page(): ReactElement {
    const leaveEnabled = isFeatureEnabled(FEATURE_KEYS.leave);

    if (leaveEnabled) {
        return <LiffLeaveApp />;
    }

    return (
        <LiffModuleLanding
            module="leave"
            enabled={false}
        />
    );
}
