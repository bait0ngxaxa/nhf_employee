import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import type { ReactElement } from "react";

import type { Employee } from "./types";
import { getEmployeeDisplayName } from "./formatters";

export function DetailsEmployeeButton({ employee, onViewEmployee }: {
    employee: Employee;
    onViewEmployee: (employee: Employee, trigger: HTMLButtonElement) => void;
}): ReactElement {
    return (
        <Button
            type="button"
            variant="outline"
            className="h-11 px-3"
            aria-label={`ดูรายละเอียด ${getEmployeeDisplayName(employee) || "ไม่ระบุชื่อ"}`}
            aria-haspopup="dialog"
            onClick={(event) => onViewEmployee(employee, event.currentTarget)}
        >
            ดูรายละเอียด
        </Button>
    );
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-surface text-xs font-bold text-brand-emphasis ring-1 ring-brand-ring-soft transition-colors group-hover:bg-brand-surface-strong"
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
            aria-label={`แก้ไขข้อมูล ${getEmployeeDisplayName(employee) || "ไม่ระบุชื่อ"}`}
            className="h-11 rounded-lg bg-status-success-surface px-3 text-sm text-status-success-foreground transition-colors duration-200 hover:bg-status-success-surface-strong hover:text-status-success-strong"
        >
            <Edit className="h-3.5 w-3.5" aria-hidden="true" />
            <span>แก้ไข</span>
        </Button>
    );
}
