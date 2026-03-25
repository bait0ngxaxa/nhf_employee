import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

const CLEANUP_SECRET_HEADER = "x-cleanup-secret";

export async function POST(request: Request): Promise<NextResponse> {
    const expectedSecret = process.env.AUTH_CLEANUP_SECRET?.trim();
    if (!expectedSecret) {
        return jsonError(COMMON_API_MESSAGES.cleanupNotConfigured, 503);
    }

    const providedSecret = request.headers.get(CLEANUP_SECRET_HEADER);
    if (providedSecret !== expectedSecret) {
        return forbidden();
    }

    try {
        const retentionCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const { count } = await prisma.authRefreshToken.deleteMany({
            where: {
                OR: [
                    { revokedAt: { not: null, lt: retentionCutoff } },
                    { expiresAt: { lt: retentionCutoff } },
                ],
            },
        });

        return NextResponse.json({ success: true, deletedCount: count });
    } catch {
        return serverError();
    }
}
