import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";

import { type Employee } from "@/types/employees";

export function getEmployeeFullName(employee: Employee): string {
    const fullName = `${employee.firstName} ${employee.lastName}`.trim();
    return fullName || "ไม่ระบุชื่อ";
}

export function getEmployeeAvatarLetter(employee: Employee): string {
    const firstName = employee.firstName.trim();
    const firstCharacter = Array.from(firstName)[0];
    if (!firstCharacter) {
        return "N";
    }

    if (!/^[เแโใไ]$/.test(firstCharacter)) {
        return firstCharacter;
    }

    return firstName.match(/[ก-ฮ]/)?.[0] ?? firstCharacter;
}

export function isTemporaryEmail(email: string): boolean {
    return email.includes("@temp.local");
}

export function EmployeeAvatar({ employee }: { employee: Employee }) {
    return (
        <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-xs font-bold text-sky-700 ring-1 ring-sky-100 transition-colors group-hover:bg-sky-100"
            aria-hidden="true"
        >
            {getEmployeeAvatarLetter(employee)}
        </div>
    );
}

export function EditEmployeeButton({
    employee,
    onEditEmployee,
}: {
    employee: Employee;
    onEditEmployee: (employee: Employee) => void;
}) {
    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => onEditEmployee(employee)}
            aria-label={`แก้ไขข้อมูล ${getEmployeeFullName(employee)}`}
            className="h-8 rounded-lg bg-emerald-50 px-3 text-emerald-700 transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-emerald-100 hover:text-emerald-800 motion-reduce:hover:translate-y-0"
        >
            <Edit className="h-3.5 w-3.5" aria-hidden="true" />
            <span>แก้ไข</span>
        </Button>
    );
}
