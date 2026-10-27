import { NextResponse } from "next/server";
import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { findLinkedUserIdsByUserIds } from "@/modules/line";
import { serverError } from "@/lib/ssot/http";

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) {
            if (auth.response.status === 403 || auth.response.status === 404) {
                return NextResponse.json({ status: "unavailable" }, { headers: { "Cache-Control": "no-store" } });
            }
            return auth.response;
        }
        const links = await findLinkedUserIdsByUserIds([auth.user.id]);
        return NextResponse.json({ status: links.includes(auth.user.id) ? "linked" : "unlinked" }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("LINE account status lookup failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        return serverError();
    }
}
