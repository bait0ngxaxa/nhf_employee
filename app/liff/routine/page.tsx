import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LiffRoutineApp } from "@/components/liff/routine/LiffRoutineApp";

export const metadata: Metadata = {
    title: "งาน Routine ของฉัน | NHFapp",
};

export default function Page(): ReactElement {
    return <LiffRoutineApp />;
}
