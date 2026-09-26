import { redirect } from "next/navigation";

import { IT_DASHBOARD_TABS, toDashboardITTabPath } from "@/lib/ssot/routes";

export default function ITTicketOperatorQueueCompatibilityPage(): never {
    redirect(toDashboardITTabPath(IT_DASHBOARD_TABS.queue));
}
