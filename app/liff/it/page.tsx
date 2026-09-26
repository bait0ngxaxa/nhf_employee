import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LiffITApp } from "@/modules/it/client";

export const metadata: Metadata = {
    title: "IT Ticket ของฉัน | NHFapp",
};

export default function Page(): ReactElement {
    return <LiffITApp />;
}
