import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { sendEmail } from "@/lib/email";
import { generatePasswordResetEmailHTML } from "@/lib/email/templates/password-reset";

const MAX_REQUESTS_PER_HOUR = 3;
const TOKEN_EXPIRY_HOURS = 1;

/**
 * Hash token with SHA-256 for secure storage
 */
function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Check rate limit: max 3 requests per email per hour
 */
async function isRateLimited(email: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentRequests = await prisma.passwordResetToken.count({
        where: {
            email,
            createdAt: { gte: oneHourAgo },
        },
    });

    return recentRequests >= MAX_REQUESTS_PER_HOUR;
}

// POST - Request password reset
export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();

        // Validate input
        const result = forgotPasswordSchema.safeParse(body);
        if (!result.success) {
            // Always return success to prevent email enumeration
            return NextResponse.json({
                success: true,
                message:
                    "หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล",
            });
        }

        const { email } = result.data;
        const normalizedEmail = email.toLowerCase().trim();

        // Rate limit check
        if (await isRateLimited(normalizedEmail)) {
            // Still return success to prevent enumeration
            return NextResponse.json({
                success: true,
                message:
                    "หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล",
            });
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, name: true, email: true, isActive: true },
        });

        if (!user || !user.isActive) {
            // Return success even if user doesn't exist (prevent enumeration)
            return NextResponse.json({
                success: true,
                message:
                    "หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล",
            });
        }

        // Delete existing unused tokens for this email
        await prisma.passwordResetToken.deleteMany({
            where: {
                email: normalizedEmail,
                used: false,
            },
        });

        // Generate secure token
        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = hashToken(rawToken);
        const expiresAt = new Date(
            Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
        );

        // Save hashed token to DB
        await prisma.passwordResetToken.create({
            data: {
                token: hashedToken,
                email: normalizedEmail,
                expiresAt,
            },
        });

        // Build reset URL
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

        // Send email
        await sendEmail({
            to: user.email,
            subject: "[NHF IT] รีเซ็ตรหัสผ่าน",
            html: generatePasswordResetEmailHTML(resetUrl, user.name),
            text: `สวัสดีคุณ ${user.name},\n\nกรุณาคลิกลิงก์ด้านล่างเพื่อรีเซ็ตรหัสผ่าน:\n${resetUrl}\n\nลิงก์จะหมดอายุภายใน 1 ชั่วโมง\n\nหากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้`,
        });

        return NextResponse.json({
            success: true,
            message:
                "หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล",
        });
    } catch (error) {
        console.error("Error in forgot-password:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
            { status: 500 },
        );
    }
}
