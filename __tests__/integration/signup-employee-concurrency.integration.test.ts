import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as signupRoute } from "@/app/api/auth/signup/route";
import { resetAuthRateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db/prisma";
import { updateEmployee } from "@/lib/services/employee/mutations";

const DEPARTMENT_NAME = "Signup Employee Concurrency Integration";
const DEPARTMENT_CODE = "SIGNUP-EMPLOYEE-RACE";
const ORIGINAL_EMAIL = "signup-employee-race@thainhf.org";
const UPDATED_EMAIL = "signup-employee-race-updated@thainhf.org";

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) {
        throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");
    }

    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (
        url.protocol !== "mysql:"
        || !/(?:_integration|_test)$/.test(databaseName)
    ) {
        throw new Error(
            "ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test",
        );
    }
}

function buildSignupRequest(): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
        method: "POST",
        headers: {
            origin: "http://localhost",
            "x-requested-with": "XMLHttpRequest",
            "content-type": "application/json",
        },
        body: JSON.stringify({
            email: ORIGINAL_EMAIL,
            password: "SignupRace1",
            confirmPassword: "SignupRace1",
        }),
    });
}

async function cleanFixtures(): Promise<void> {
    resetAuthRateLimit();
    await prisma.auditLog.deleteMany({
        where: { userEmail: { in: [ORIGINAL_EMAIL, UPDATED_EMAIL] } },
    });

    const department = await prisma.department.findUnique({
        where: { code: DEPARTMENT_CODE },
        select: { id: true },
    });
    if (!department) {
        await prisma.user.deleteMany({
            where: { email: { in: [ORIGINAL_EMAIL, UPDATED_EMAIL] } },
        });
        return;
    }

    const employees = await prisma.employee.findMany({
        where: { departmentId: department.id },
        select: { id: true },
    });
    const employeeIds = employees.map(({ id }) => id);

    await prisma.user.deleteMany({
        where: {
            OR: [
                { email: { in: [ORIGINAL_EMAIL, UPDATED_EMAIL] } },
                { employeeId: { in: employeeIds } },
            ],
        },
    });
    await prisma.employee.deleteMany({
        where: { id: { in: employeeIds } },
    });
    await prisma.department.delete({ where: { id: department.id } });
}

describe.sequential("signup and Employee identity concurrency with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(cleanFixtures);

    afterAll(async () => {
        await cleanFixtures();
        await prisma.$disconnect();
    });

    it("never leaves mismatched emails when signup races an Employee email update", async () => {
        const department = await prisma.department.create({
            data: {
                name: DEPARTMENT_NAME,
                code: DEPARTMENT_CODE,
            },
        });
        const employee = await prisma.employee.create({
            data: {
                firstName: "Signup",
                lastName: "Race",
                email: ORIGINAL_EMAIL,
                position: "Integration Test",
                departmentId: department.id,
            },
        });

        const [signupResponse, employeeUpdate] = await Promise.all([
            signupRoute(buildSignupRequest()),
            updateEmployee(employee.id, { email: UPDATED_EMAIL }),
        ]);

        expect([201, 400]).toContain(signupResponse.status);
        expect(employeeUpdate.success).toBe(true);

        const finalEmployee = await prisma.employee.findUniqueOrThrow({
            where: { id: employee.id },
            select: {
                email: true,
                user: { select: { email: true } },
            },
        });

        expect(finalEmployee.email).toBe(UPDATED_EMAIL);
        if (finalEmployee.user) {
            expect(finalEmployee.user.email).toBe(finalEmployee.email);
        }
    });
});
