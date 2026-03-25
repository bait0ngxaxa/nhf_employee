import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { type Employee } from "@/types/employees";
import {
    getEmployeeStatusLabel,
    getEmployeeStatusBadge,
} from "@/lib/helpers/employee-helpers";
import { isAdminRole } from "@/lib/ssot/permissions";

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

    return (
        <div
            className="overflow-auto max-h-[70vh] border border-gray-200/60 rounded-2xl shadow-sm bg-white"
            style={{
                contentVisibility: "auto",
                containIntrinsicSize: "0 500px",
            }}
        >
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200/60 sticky top-0 z-10">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            ชื่อ-นามสกุล
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            ชื่อเล่น
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            ตำแหน่ง
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            สังกัด
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            แผนก
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            อีเมล
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            เบอร์โทร
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            สถานะ
                        </th>
                        {isAdminRole(userRole) ? (
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50">
                                การจัดการ
                            </th>
                        ) : null}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {employees.map((employee) => (
                        <tr
                            key={employee.id}
                            className="hover:bg-blue-50/30 transition-colors border-b border-gray-100 last:border-0"
                        >
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                    {employee.firstName} {employee.lastName}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {employee.nickname ? (
                                        <Badge variant="secondary" className="bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200/60 font-medium shadow-sm px-2.5">
                                            {employee.nickname}
                                        </Badge>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {employee.position}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {employee.affiliation || "-"}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200/80 font-medium shadow-sm hover:bg-slate-100 px-2.5">
                                    {employee.dept.name}
                                </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {employee.email.includes("@temp.local")
                                        ? "-"
                                        : employee.email}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {employee.phone || "-"}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <Badge
                                    className={getEmployeeStatusBadge(
                                        employee.status,
                                    )}
                                >
                                    {getEmployeeStatusLabel(employee.status)}
                                </Badge>
                            </td>
                            {isAdminRole(userRole) && onEditEmployee && (
                                <td className="px-6 py-4 whitespace-nowrap sticky right-0 bg-white">
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                onEditEmployee(employee)
                                            }
                                            className="h-8 group relative overflow-hidden bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border-0 shadow-sm transition-[box-shadow,background-color] duration-300 rounded-lg px-3"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-100/50 to-teal-100/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <span className="relative flex items-center gap-1.5 font-medium">
                                                <Edit className="h-3.5 w-3.5" />
                                                <span>แก้ไข</span>
                                            </span>
                                        </Button>
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
});
