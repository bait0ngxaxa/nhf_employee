import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
    try {
        const { name, email, password, confirmPassword } = await request.json();

        // Validation
        if (!name || !email || !password || !confirmPassword) {
            return NextResponse.json(
                { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
                { status: 400 }
            );
        }

        if (password !== confirmPassword) {
            return NextResponse.json(
                { error: "รหัสผ่านไม่ตรงกัน" },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: "อีเมลนี้ถูกใช้งานแล้ว" },
                { status: 400 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user account only
        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: email.toLowerCase(),
                password: hashedPassword,
                role: "USER",
                isActive: true,
            },
        });

        // Log audit event
        await createAuditLog({
            action: "USER_CREATE",
            entityType: "User",
            entityId: user.id,
            userId: user.id,
            userEmail: user.email,
            details: {
                after: {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            },
        });

        // Return success response (don't include password)
        return NextResponse.json(
            {
                message: "สมัครสมาชิกสำเร็จ",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Signup error:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการสมัครสมาชิก" },
            { status: 500 }
        );
    }
}
