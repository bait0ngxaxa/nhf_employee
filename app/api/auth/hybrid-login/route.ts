import bcrypt from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { logAuthEvent } from "@/lib/audit";
import { setHybridAuthCookies, getClientMetadata } from "@/lib/hybrid-auth-session";
import { buildRefreshTokenRecord, issueAccessToken } from "@/lib/hybrid-auth-tokens";
import { prisma } from "@/lib/prisma";

const hybridLoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();
        const parsed = hybridLoginSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid credentials payload" }, { status: 400 });
        }

        const normalizedEmail = parsed.data.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: {
                id: true,
                email: true,
                name: true,
                password: true,
                role: true,
                isActive: true,
                deletedAt: true,
            },
        });

        const isPasswordValid = user
            ? await bcrypt.compare(parsed.data.password, user.password)
            : false;

        if (!user || !isPasswordValid || !user.isActive || user.deletedAt) {
            await logAuthEvent("LOGIN_FAILED", user?.id, normalizedEmail, {
                metadata: { method: "hybrid_login", reason: "invalid_credentials_or_inactive" },
            });
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }

        const metadata = getClientMetadata(request);
        const refreshDraft = buildRefreshTokenRecord({
            userId: user.id,
            userAgent: metadata.userAgent,
            ipAddress: metadata.ipAddress,
        });

        const accessToken = await issueAccessToken({
            userId: user.id,
            role: user.role,
            sessionId: refreshDraft.record.familyId,
            tokenVersion: 1,
        });

        await prisma.authRefreshToken.create({
            data: {
                userId: refreshDraft.record.userId,
                tokenHash: refreshDraft.record.tokenHash,
                familyId: refreshDraft.record.familyId,
                expiresAt: refreshDraft.record.expiresAt,
                userAgent: refreshDraft.record.userAgent,
                ipAddress: refreshDraft.record.ipAddress,
            },
        });

        await logAuthEvent("LOGIN_SUCCESS", user.id, user.email, {
            metadata: { method: "hybrid_login" },
        });

        const response = NextResponse.json({
            success: true,
            user: {
                id: String(user.id),
                email: user.email,
                name: user.name,
                role: user.role,
            },
        });
        setHybridAuthCookies(response, accessToken, refreshDraft.rawToken);
        return response;
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
