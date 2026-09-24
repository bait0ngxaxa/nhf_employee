import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireDashboardITReadAccess } from "@/app/dashboard/_lib/route-access";
import { ITTicketDetail } from "@/modules/it/client";

export const metadata: Metadata = {
    title: "รายละเอียด IT Ticket | NHFapp",
};

export default async function ITTicketDetailPage({
    params,
}: {
    readonly params: Promise<{ readonly ticketId: string }>;
}): Promise<React.ReactElement> {
    await requireDashboardITReadAccess();
    const { ticketId: rawTicketId } = await params;
    if (!/^[1-9]\d*$/.test(rawTicketId)) notFound();
    const ticketId = Number(rawTicketId);
    if (!Number.isSafeInteger(ticketId)) notFound();

    return <ITTicketDetail ticketId={ticketId} />;
}
