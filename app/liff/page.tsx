import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LiffHomeApp } from "@/components/liff/home/LiffHomeApp";

export const metadata: Metadata = {
    title: "บริการผ่าน LINE | NHFapp",
};

export default function Page(): ReactElement {
    return <LiffHomeApp />;
}
