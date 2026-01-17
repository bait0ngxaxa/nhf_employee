import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { type Employee } from "@/types/employees";
import {
    getEmployeeStatusLabel,
    getEmployeeStatusBadge,
} from "@/lib/helpers/employee-helpers";

interface EmployeeTableProps {
    employees: Employee[];
    userRole?: string;
    onEditEmployee?: (employee: Employee) => void;
}

export function EmployeeTable({
    employees,
    userRole,
    onEditEmployee,
}: EmployeeTableProps) {
    if (employees.length === 0) {
        return null;
    }

    return (
        <div className="overflow-x-auto border border-gray-200/60 rounded-2xl shadow-sm bg-white/60 backdrop-blur-md">
            <table className="min-w-full bg-white">
                <thead className="bg-gray-50/50 border-b border-gray-200/60">
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
                        {userRole === "ADMIN" && (
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                การจัดการ
                            </th>
                        )}
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
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs">
                                            {employee.nickname}
                                        </span>
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
                                <Badge variant="outline">
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
                                        employee.status
                                    )}
                                >
                                    {getEmployeeStatusLabel(employee.status)}
                                </Badge>
                            </td>
                            {userRole === "ADMIN" && onEditEmployee && (
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                onEditEmployee(employee)
                                            }
                                            className="flex items-center space-x-1 text-green-600 hover:text-green-700"
                                        >
                                            <Edit className="h-3 w-3" />
                                            <span>แก้ไข</span>
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
}
