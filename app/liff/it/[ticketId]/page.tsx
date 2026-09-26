import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LiffITApp } from "@/modules/it/client";

export const metadata: Metadata = {
    title: "รายละเอียด IT Ticket | NHFapp",
};

interface PageProps {
    readonly params: Promise<{ readonly ticketId: string }>;
}

export default async function Page({ params }: PageProps): Promise<ReactElement> {
    const { ticketId } = await params;
    return <LiffITApp ticketId={ticketId} />;
}
