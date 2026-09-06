import { prisma } from "@/lib/db/prisma";

export async function findAllDepartments(): Promise<Array<{
    id: number;
    name: string;
    code: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}>> {
    return prisma.department.findMany({
        orderBy: { name: "asc" },
    });
}

export async function findDepartmentReferences(): Promise<Array<{
    id: number;
    code: string;
}>> {
    return prisma.department.findMany({
        select: { id: true, code: true },
    });
}
