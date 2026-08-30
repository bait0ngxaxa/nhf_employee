import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LiffStockApp } from "@/components/liff/stock/LiffStockApp";

export const metadata: Metadata = {
    title: "Stock ผ่าน LINE | NHFapp",
};

export default function Page(): ReactElement {
    return <LiffStockApp />;
}
