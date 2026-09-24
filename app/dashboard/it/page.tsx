import type { Metadata } from "next";

import { requireDashboardITSelfServiceAccess } from "@/app/dashboard/_lib/route-access";
import { ITTicketSelfService } from "@/modules/it/client";

export const metadata: Metadata = {
    title: "IT Ticket | NHFapp",
};

export default async function ITTicketDashboardPage(): Promise<React.ReactElement> {
    const capabilities = await requireDashboardITSelfServiceAccess();
    return <ITTicketSelfService capabilities={capabilities} />;
}
