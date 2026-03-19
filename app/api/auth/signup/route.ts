import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
    try {
        const { email, password, confirmPassword } = await request.json();

        if (!email || !password || !confirmPassword) {
            return NextResponse.json(
                { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
                { status: 400 },
            );
        }

        if (password !== confirmPassword) {
            return NextResponse.json(
                { error: "รหัสผ่านไม่ตรงกัน" },
                { status: 400 },
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
                { status: 400 },
            );
        }

        if (!email.endsWith("@thainhf.org")) {
            return NextResponse.json(
                { error: "กรุณาใช้อีเมลองค์กร (@thainhf.org) เท่านั้น" },
                { status: 400 },
            );
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: "อีเมลนี้ถูกใช้งานแล้ว" },
                { status: 400 },
            );
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Auto-link: find Employee with matching email to connect the accounts
        // Name is derived from Employee record — users cannot set their own name at signup
        const matchedEmployee = await prisma.employee.findUnique({
            where: { email: email.toLowerCase() },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                user: { select: { id: true } },
                dept: { select: { code: true } },
            },
        });

        // Reject signup if no Employee record is found for this email
        if (!matchedEmployee) {
            return NextResponse.json(
                {
                    error: "ไม่พบข้อมูลพนักงานที่ตรงกับอีเมลนี้ กรุณาติดต่อผู้ดูแล",
                },
                { status: 400 },
            );
        }

        // Reject if the Employee record is already claimed by another account
        if (matchedEmployee.user) {
            return NextResponse.json(
                { error: "อีเมลนี้ถูกใช้งานแล้ว" },
                { status: 400 },
            );
        }

        const employeeName = `${matchedEmployee.firstName} ${matchedEmployee.lastName}`;

        // Only the seeded admin account gets ADMIN role at signup.
        // All others start as USER; an admin must assign elevated roles manually.
        const assignedRole =
            email.toLowerCase() === "admin@thainhf.org" ? "ADMIN" : "USER";

        const user = await prisma.user.create({
            data: {
                name: employeeName,
                email: email.toLowerCase(),
                password: hashedPassword,
                role: assignedRole,
                isActive: true,
                employeeId: matchedEmployee.id,
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
            { status: 201 },
        );
    } catch (error) {
        console.error("Signup error:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการสมัครสมาชิก" },
            { status: 500 },
        );
    }
}
