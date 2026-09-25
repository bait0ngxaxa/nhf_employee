import type { Metadata } from "next";

import { requireDashboardITOperatorReadAccess } from "@/app/dashboard/_lib/route-access";
import { ITTicketOperatorQueue } from "@/modules/it/client";

export const metadata: Metadata = {
    title: "คิว IT Ticket | NHFapp",
};

export default async function ITTicketOperatorQueuePage(): Promise<React.ReactElement> {
    await requireDashboardITOperatorReadAccess();
    return <ITTicketOperatorQueue />;
}
