import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AUTH_SIGNUP_MESSAGES } from "@/lib/auth-ssot";

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const { email, password, confirmPassword } = await request.json();

        if (!email || !password || !confirmPassword) {
            return NextResponse.json({ error: AUTH_SIGNUP_MESSAGES.requiredFieldsThai }, { status: 400 });
        }

        if (password !== confirmPassword) {
            return NextResponse.json({ error: AUTH_SIGNUP_MESSAGES.passwordMismatchThai }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: AUTH_SIGNUP_MESSAGES.passwordMinLengthThai }, { status: 400 });
        }

        if (!email.endsWith("@thainhf.org")) {
            return NextResponse.json({ error: AUTH_SIGNUP_MESSAGES.emailDomainOnlyThai }, { status: 400 });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json({ error: AUTH_SIGNUP_MESSAGES.emailAlreadyUsedThai }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const matchedEmployee = await prisma.employee.findUnique({
            where: { email: email.toLowerCase() },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                user: { select: { id: true } },
            },
        });

        if (!matchedEmployee) {
            return NextResponse.json({ error: AUTH_SIGNUP_MESSAGES.employeeNotFoundThai }, { status: 400 });
        }

        if (matchedEmployee.user) {
            return NextResponse.json({ error: AUTH_SIGNUP_MESSAGES.emailAlreadyUsedThai }, { status: 400 });
        }

        const employeeName = `${matchedEmployee.firstName} ${matchedEmployee.lastName}`;
        const assignedRole = email.toLowerCase() === "admin@thainhf.org" ? "ADMIN" : "USER";

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
                message: AUTH_SIGNUP_MESSAGES.signupSuccessThai,
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
        return NextResponse.json({ error: AUTH_SIGNUP_MESSAGES.signupFailedThai }, { status: 500 });
    }
}
