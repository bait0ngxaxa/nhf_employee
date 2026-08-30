import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LiffModuleLanding } from "@/components/liff/LiffModuleLanding";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";

export const metadata: Metadata = {
    title: "Leave ผ่าน LINE | NHFapp",
};

export default function Page(): ReactElement {
    return (
        <LiffModuleLanding
            module="leave"
            enabled={isFeatureEnabled(FEATURE_KEYS.leave)}
        />
    );
}
