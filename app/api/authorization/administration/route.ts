import { NextResponse } from "next/server";

import {
    getAuthorizationAdministrationOverview,
} from "@/modules/authorization";
import { operationFailed } from "@/lib/ssot/http";
import { requireAuthorizationAdministrationApiSession } from "./_lib/route-auth";

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;

        const overview = await getAuthorizationAdministrationOverview(
            auth.principal,
        );
        return NextResponse.json({ overview }, { status: 200 });
    } catch (error) {
        console.error("Error reading Authorization Administration overview:", error);
        return operationFailed(500);
    }
}
