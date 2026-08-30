import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LiffModuleLanding } from "@/components/liff/LiffModuleLanding";

export const metadata: Metadata = {
    title: "Stock ผ่าน LINE | NHFapp",
};

export default function Page(): ReactElement {
    return <LiffModuleLanding module="stock" enabled />;
}
