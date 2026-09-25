import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireDashboardITOperatorReadAccess } from "@/app/dashboard/_lib/route-access";
import { ITTicketOperatorDetail } from "@/modules/it/client";

export const metadata: Metadata = {
    title: "ดำเนินการ IT Ticket | NHFapp",
};

export default async function ITTicketOperatorDetailPage({
    params,
}: {
    readonly params: Promise<{ readonly ticketId: string }>;
}): Promise<React.ReactElement> {
    const capabilities = await requireDashboardITOperatorReadAccess();
    const { ticketId: rawTicketId } = await params;
    if (!/^[1-9]\d*$/.test(rawTicketId)) notFound();
    const ticketId = Number(rawTicketId);
    if (!Number.isSafeInteger(ticketId)) notFound();

    return <ITTicketOperatorDetail key={ticketId} ticketId={ticketId} capabilities={capabilities} />;
}
