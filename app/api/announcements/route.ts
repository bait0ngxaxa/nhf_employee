import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api";
import { getPublishedAnnouncement } from "@/modules/announcements";
import { operationFailed } from "@/lib/ssot/http";

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;
        return NextResponse.json({ announcement: await getPublishedAnnouncement() }, {
            headers: { "Cache-Control": "private, no-store" },
        });
    } catch (error) {
        console.error("Error reading announcement:", error);
        return operationFailed();
    }
}
