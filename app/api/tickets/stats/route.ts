import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { ticketService } from "@/lib/services/ticket";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { jsonError, notFound } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

export async function GET(): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.itSupport)) {
            return notFound();
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const stats = await ticketService.getTicketStats(auth.user);
        return NextResponse.json({ stats }, { status: 200 });
    } catch (error) {
        console.error("Error fetching ticket stats:", error);
        return jsonError(COMMON_API_MESSAGES.failedToFetchTickets, 500);
    }
}
