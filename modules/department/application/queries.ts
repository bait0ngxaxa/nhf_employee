import {
    findAllDepartments,
    findDepartmentReferences,
} from "../infrastructure/persistence/department-repository";

export interface DepartmentRecord {
    id: number;
    name: string;
    code: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface DepartmentReference {
    id: number;
    code: string;
}

export async function listDepartments(): Promise<DepartmentRecord[]> {
    return findAllDepartments();
}

export async function listDepartmentReferences(): Promise<DepartmentReference[]> {
    return findDepartmentReferences();
}
