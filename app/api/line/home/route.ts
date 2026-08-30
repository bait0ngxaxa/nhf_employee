import { NextResponse } from "next/server";

import {
    getLiffCapabilities,
    requireLiffWorkforceSession,
} from "@/lib/auth/liff";
import { getLiffHomeModules } from "@/lib/line/liff-home";
import type { LiffHomeResponse } from "@/lib/line/liff-types";
import { serverError } from "@/lib/ssot/http";

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireLiffWorkforceSession();
        if (!auth.ok) return auth.response;

        const [modules, capabilities] = await Promise.all([
            getLiffHomeModules(),
            getLiffCapabilities(auth),
        ]);

        const response: LiffHomeResponse = {
            workforce: {
                userId: auth.user.id,
                employeeId: auth.employeeId,
                name: auth.user.name,
            },
            modules,
            capabilities,
        };
        return NextResponse.json(response);
    } catch (error) {
        console.error("Error fetching LIFF home contract", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
