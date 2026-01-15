import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createEmployeeSchema } from "@/lib/validations/employee";
import { logEmployeeEvent } from "@/lib/audit";
import { EmployeeStatus, Prisma } from "@prisma/client";

// GET - ดึงข้อมูลพนักงาน (with pagination and filters)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { error: "ไม่มีสิทธิ์เข้าถึง" },
                { status: 403 }
            );
        }

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";

        // Calculate skip
        const skip = (page - 1) * limit;

        // Build where clause
        const where: Prisma.EmployeeWhereInput = {};

        // Status filter
        if (status && status !== "all") {
            where.status = status as EmployeeStatus;
        }

        // Search filter (search in multiple fields)
        if (search) {
            where.OR = [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { nickname: { contains: search } },
                { email: { contains: search } },
                { position: { contains: search } },
                { affiliation: { contains: search } },
                { dept: { name: { contains: search } } },
            ];
        }

        // Get total count and employees in parallel
        const [total, employees] = await Promise.all([
            prisma.employee.count({ where }),
            prisma.employee.findMany({
                where,
                include: {
                    dept: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
                skip,
                take: limit,
            }),
        ]);

        return NextResponse.json({
            success: true,
            employees,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching employees:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
            { status: 500 }
        );
    }
}

// POST - เพิ่มพนักงานใหม่
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { error: "ไม่มีสิทธิ์เข้าถึง" },
                { status: 403 }
            );
        }

        const body = await request.json();

        // Validate input with Zod
        const result = createEmployeeSchema.safeParse(body);

        if (!result.success) {
            const errors = result.error.flatten();
            return NextResponse.json(
                {
                    error: "ข้อมูลไม่ถูกต้อง",
                    details: errors.fieldErrors,
                },
                { status: 400 }
            );
        }

        const validatedData = result.data;

        // Check if email already exists
        const existingEmployee = await prisma.employee.findUnique({
            where: { email: validatedData.email },
        });

        if (existingEmployee) {
            return NextResponse.json(
                { error: "อีเมลนี้ถูกใช้งานแล้ว" },
                { status: 400 }
            );
        }

        // Create employee directly
        const employee = await prisma.employee.create({
            data: {
                firstName: validatedData.firstName,
                lastName: validatedData.lastName,
                nickname: validatedData.nickname,
                email: validatedData.email,
                phone: validatedData.phone,
                position: validatedData.position,
                affiliation: validatedData.affiliation,
                departmentId: validatedData.departmentId,
            },
            include: {
                dept: true,
            },
        });

        // Log audit event
        await logEmployeeEvent(
            "EMPLOYEE_CREATE",
            employee.id,
            parseInt(session.user.id),
            session.user.email || "",
            {
                after: {
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    email: employee.email,
                    position: employee.position,
                    departmentId: employee.departmentId,
                },
            }
        );

        return NextResponse.json(
            {
                message: "เพิ่มพนักงานสำเร็จ",
                employee,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error creating employee:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการเพิ่มพนักงาน" },
            { status: 500 }
        );
    }
}
