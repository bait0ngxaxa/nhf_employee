import type { ReactElement } from "react";
import type { Metadata } from "next";
import { DashboardMoreSection } from "@/components/dashboard/sections/DashboardMoreSection";

export const metadata: Metadata = { title: "เพิ่มเติม | NHFapp" };

// Authentication remains authoritative in the parent Dashboard server layout.
export default function DashboardMorePage(): ReactElement {
    return <DashboardMoreSection />;
}
