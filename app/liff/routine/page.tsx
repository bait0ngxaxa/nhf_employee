import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LiffModuleLanding } from "@/components/liff/LiffModuleLanding";
import { LiffRoutineApp } from "@/modules/routine/client";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";

export const metadata: Metadata = {
    title: "งาน Routine ของฉัน | NHFapp",
};

export default function Page(): ReactElement {
    if (isFeatureEnabled(FEATURE_KEYS.routine)) {
        return <LiffRoutineApp />;
    }

    return <LiffModuleLanding module="routine" enabled={false} />;
}
