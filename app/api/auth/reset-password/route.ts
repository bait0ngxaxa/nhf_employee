import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { logAuthEvent } from "@/lib/audit";

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Hash token with SHA-256 to match stored hash
 */
function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

// POST - Reset password with token
export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();

        // Validate input
        const result = resetPasswordSchema.safeParse(body);
        if (!result.success) {
            const errors = result.error.flatten();
            return NextResponse.json(
                { error: "ข้อมูลไม่ถูกต้อง", details: errors.fieldErrors },
                { status: 400 },
            );
        }

        const { token, password } = result.data;
        const hashedToken = hashToken(token);

        // Find the token in DB
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token: hashedToken },
        });

        if (!resetToken) {
            return NextResponse.json(
                { error: "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง" },
                { status: 400 },
            );
        }

        // Check if token is already used
        if (resetToken.used) {
            return NextResponse.json(
                { error: "ลิงก์รีเซ็ตรหัสผ่านนี้ถูกใช้งานแล้ว" },
                { status: 400 },
            );
        }

        // Check if token is expired
        if (new Date() > resetToken.expiresAt) {
            return NextResponse.json(
                { error: "ลิงก์รีเซ็ตรหัสผ่านหมดอายุแล้ว กรุณาขอลิงก์ใหม่" },
                { status: 400 },
            );
        }

        // Find the user
        const user = await prisma.user.findUnique({
            where: { email: resetToken.email },
            select: { id: true, email: true },
        });

        if (!user) {
            return NextResponse.json(
                { error: "ไม่พบผู้ใช้งานในระบบ" },
                { status: 400 },
            );
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        // Update password and mark token as used in a transaction
        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { password: hashedPassword },
            }),
            prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { used: true },
            }),
        ]);

        // Log audit event
        await logAuthEvent("PASSWORD_RESET", user.id, user.email, {
            metadata: { method: "email_token" },
        });

        return NextResponse.json({
            success: true,
            message: "รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่",
        });
    } catch (error) {
        console.error("Error in reset-password:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
            { status: 500 },
        );
    }
}
