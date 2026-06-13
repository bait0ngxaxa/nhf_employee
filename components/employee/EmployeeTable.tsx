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
            <div className="grid gap-3 lg:hidden">
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
                className="hidden max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white lg:block"
                style={{
                    contentVisibility: "auto",
                    containIntrinsicSize: "0 500px",
                }}
            >
                <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
                    <colgroup>
                        <col className="w-[19%]" />
                        <col className="w-[9%]" />
                        <col className="w-[16%]" />
                        <col className="w-[13%]" />
                        <col className="w-[11%]" />
                        <col className="w-[17%]" />
                        <col className="w-[9%]" />
                        <col className="w-[10%]" />
                        {canEdit ? <col className="w-[8%]" /> : null}
                    </colgroup>
                    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                    <tr>
                        <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600">
                            ชื่อ-นามสกุล
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600">
                            ชื่อเล่น
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600">
                            ตำแหน่ง
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600">
                            สังกัด
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600">
                            แผนก
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600">
                            อีเมล
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600">
                            เบอร์โทร
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600">
                            สถานะ
                        </th>
                        {canEdit ? (
                            <th className="sticky right-0 bg-slate-50 px-4 py-4 text-left text-xs font-semibold text-slate-600 shadow-[-10px_0_18px_-18px_rgba(15,23,42,0.45)]">
                                การจัดการ
                            </th>
                        ) : null}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {employees.map((employee) => (
                        <tr
                            key={employee.id}
                            className="group border-b border-slate-100 transition-colors hover:bg-sky-50/40 last:border-0"
                        >
                            <td className="px-5 py-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <EmployeeAvatar employee={employee} />
                                    <div className="min-w-0">
                                        <div
                                            className="truncate text-sm font-semibold text-slate-950"
                                            title={getEmployeeFullName(employee)}
                                        >
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
                                    className="line-clamp-2 text-sm leading-6 text-slate-800 [overflow-wrap:anywhere]"
                                    title={employee.position}
                                >
                                    {employee.position}
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <div
                                    className="line-clamp-2 text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]"
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
                                <div className="whitespace-nowrap text-sm text-slate-800">
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
                                <td className="sticky right-0 bg-white px-4 py-4 shadow-[-10px_0_18px_-18px_rgba(15,23,42,0.45)] group-hover:bg-sky-50">
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
        return <span className="text-sm text-slate-400">-</span>;
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
        return <span className="text-sm text-slate-400">-</span>;
    }

    return (
        <div
            className="truncate text-sm text-slate-800"
            title={email}
        >
            {email}
        </div>
    );
}
