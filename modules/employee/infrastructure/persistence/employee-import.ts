import { prisma } from "@/lib/db/prisma";
import type { EmployeeStatusValue } from "../../domain/lifecycle";

export async function loadEmployeeImportReferenceData(): Promise<{
    departments: Array<{ id: number; code: string }>;
    existingEmployees: Array<{ email: string; firstName: string; lastName: string }>;
}> {
    const departments = await prisma.department.findMany();
    const existingEmployees = await prisma.employee.findMany({
        where: { deletedAt: null },
        select: { email: true, firstName: true, lastName: true },
    });
    return { departments, existingEmployees };
}

export async function createImportedEmployee(data: {
    firstName: string;
    lastName: string;
    nickname: string | null;
    email: string;
    phone: string | null;
    position: string;
    affiliation: string | null;
    departmentId: number;
    status: EmployeeStatusValue;
}): Promise<{
    firstName: string;
    lastName: string;
    nickname: string | null;
    email: string;
    phone: string | null;
    position: string;
    affiliation: string | null;
    dept: { name: string };
}> {
    return prisma.employee.create({ data, include: { dept: true } });
}
