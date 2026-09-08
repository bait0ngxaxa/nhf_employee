import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LiffStockApp } from "@/modules/stock/client";

export const metadata: Metadata = {
    title: "Stock ผ่าน LINE | NHFapp",
};

export default function Page(): ReactElement {
    return <LiffStockApp />;
}
