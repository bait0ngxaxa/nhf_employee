import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { getEmployeeFullName } from "../../domain/identity";
import type { Employee } from "./types";
import { getEmployeeStatusBadge, getEmployeeStatusLabel, isTemporaryEmail } from "./formatters";
import { EmployeeAvatar, DetailsEmployeeButton, EditEmployeeButton } from "./EmployeeTablePrimitives";

interface EmployeeMobileCardProps {
    employee: Employee;
    canUpdateEmployees: boolean;
    onViewEmployee: (employee: Employee, trigger: HTMLButtonElement) => void;
    onEditEmployee?: (employee: Employee) => void;
}

export function EmployeeMobileCard({ employee, canUpdateEmployees, onViewEmployee, onEditEmployee }: EmployeeMobileCardProps): ReactElement {
    return (
        <article className="min-w-0 rounded-xl border border-border-subtle bg-surface-raised p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <EmployeeAvatar employee={employee} />
                    <h3 className="min-w-0 text-sm font-semibold leading-6 text-content-heading [overflow-wrap:anywhere]">
                        {getEmployeeFullName(employee.firstName, employee.lastName) || "ไม่ระบุชื่อ"}
                    </h3>
                </div>
                <Badge className={getEmployeeStatusBadge(employee.status)}>{getEmployeeStatusLabel(employee.status)}</Badge>
            </div>
            <dl className="mt-3 grid gap-2 text-sm">
                <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3">
                    <dt className="text-content-muted">ชื่อเล่น</dt>
                    <dd className="text-content-strong [overflow-wrap:anywhere]">{employee.nickname?.trim() || "-"}</dd>
                </div>
                <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3">
                    <dt className="text-content-muted">อีเมล</dt>
                    <dd className="text-content-strong [overflow-wrap:anywhere]">{isTemporaryEmail(employee.email) ? "-" : employee.email}</dd>
                </div>
            </dl>
            <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border-muted pt-3">
                <DetailsEmployeeButton employee={employee} onViewEmployee={onViewEmployee} />
                {canUpdateEmployees && onEditEmployee ? <EditEmployeeButton employee={employee} onEditEmployee={onEditEmployee} /> : null}
            </div>
        </article>
    );
}
