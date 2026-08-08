import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { type Employee } from "@/types/employees";
import {
    getEmployeeDepartmentBadgeClass,
    getEmployeeStatusLabel,
    getEmployeeStatusBadge,
    formatEmployeePhone,
} from "@/lib/helpers/employee-helpers";
import { isAdminRole } from "@/lib/ssot/permissions";
import { EmployeeMobileCard } from "./EmployeeMobileCard";
import {
    EditEmployeeButton,
    EmployeeAvatar,
    getEmployeeFullName,
    isTemporaryEmail,
} from "./EmployeeTablePrimitives";

interface EmployeeTableProps {
    employees: Employee[];
    userRole?: string;
    onEditEmployee?: (employee: Employee) => void;
}

export const EmployeeTable = memo(function EmployeeTable({
    employees,
    userRole,
    onEditEmployee,
}: EmployeeTableProps) {
    if (employees.length === 0) {
        return null;
    }

    const canEdit = isAdminRole(userRole) && Boolean(onEditEmployee);

    return (
        <div className="space-y-3">
            <div className="grid gap-3 xl:hidden">
                {employees.map((employee) => (
                    <EmployeeMobileCard
                        key={employee.id}
                        employee={employee}
                        canEdit={canEdit}
                        onEditEmployee={onEditEmployee}
                    />
                ))}
            </div>

            <div
                className="hidden max-h-[70vh] overflow-auto rounded-xl border border-border-subtle bg-surface-raised xl:block"
                style={{
                    contentVisibility: "auto",
                    containIntrinsicSize: "0 500px",
                }}
            >
                <table className="w-max min-w-[1360px] text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-border-subtle bg-surface-subtle">
                    <tr>
                        <th className="px-5 py-4 text-left text-xs font-semibold text-content-secondary">
                            ชื่อ-นามสกุล
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-content-secondary">
                            ชื่อเล่น
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-content-secondary">
                            ตำแหน่ง
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-content-secondary">
                            สังกัด
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-content-secondary">
                            แผนก
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-content-secondary">
                            อีเมล
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-content-secondary">
                            เบอร์โทร
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-content-secondary">
                            สถานะ
                        </th>
                        {canEdit ? (
                        <th className="sticky right-0 bg-surface-subtle px-4 py-4 text-left text-xs font-semibold text-content-secondary employee-table-sticky-shadow">
                                การจัดการ
                            </th>
                        ) : null}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                    {employees.map((employee) => (
                        <tr
                            key={employee.id}
                            className="group border-b border-border-muted transition-colors hover:bg-sky-50/40 last:border-0"
                        >
                            <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <EmployeeAvatar employee={employee} />
                                    <div>
                                        <div className="whitespace-nowrap text-sm font-semibold text-content-heading">
                                            {getEmployeeFullName(employee)}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <NicknameBadge nickname={employee.nickname} />
                            </td>
                            <td className="px-4 py-4">
                                <div
                                    className="line-clamp-2 text-sm leading-6 text-content-strong [overflow-wrap:anywhere]"
                                    title={employee.position}
                                >
                                    {employee.position}
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <div
                                    className="line-clamp-2 text-sm leading-6 text-content-body [overflow-wrap:anywhere]"
                                    title={employee.affiliation || undefined}
                                >
                                    {employee.affiliation || "-"}
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <Badge
                                    variant="outline"
                                    className={`${getEmployeeDepartmentBadgeClass(employee.dept.name)} max-w-full px-2.5 font-medium`}
                                    title={employee.dept.name}
                                >
                                    <span className="truncate">
                                        {employee.dept.name}
                                    </span>
                                </Badge>
                            </td>
                            <td className="px-4 py-4">
                                <EmailValue email={employee.email} />
                            </td>
                            <td className="px-4 py-4">
                                <div className="whitespace-nowrap text-sm text-content-strong">
                                    {formatEmployeePhone(employee.phone)}
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <Badge
                                    className={getEmployeeStatusBadge(
                                        employee.status,
                                    )}
                                >
                                    {getEmployeeStatusLabel(employee.status)}
                                </Badge>
                            </td>
                            {canEdit && onEditEmployee ? (
                                <td className="sticky right-0 bg-surface-raised px-4 py-4 employee-table-sticky-shadow group-hover:bg-sky-50">
                                    <EditEmployeeButton
                                        employee={employee}
                                        onEditEmployee={onEditEmployee}
                                    />
                                </td>
                            ) : null}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        </div>
    );
});

function NicknameBadge({ nickname }: { nickname?: string }) {
    if (!nickname) {
        return <span className="text-sm text-content-subtle">-</span>;
    }

    return (
        <Badge
            variant="secondary"
            className="max-w-full border border-violet-200/70 bg-violet-50 px-2.5 font-medium text-violet-700 hover:bg-violet-50"
            title={nickname}
        >
            <span className="truncate">{nickname}</span>
        </Badge>
    );
}

function EmailValue({ email }: { email: string }) {
    if (isTemporaryEmail(email)) {
        return <span className="text-sm text-content-subtle">-</span>;
    }

    return (
        <div className="whitespace-nowrap text-sm text-content-strong">
            {email}
        </div>
    );
}
