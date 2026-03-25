import { Badge } from "@/components/ui/badge";
import type { ApproverEmployeeItem } from "@/lib/services/leave/client";

interface ApproverTableProps {
    employees: ApproverEmployeeItem[];
    allEmployees: ApproverEmployeeItem[];
    assignments: Map<number, number | null>;
    noApproverValue: string;
    formatName: (employee: { firstName: string; lastName: string; nickname: string | null }) => string;
    getManagerId: (employee: ApproverEmployeeItem) => number | null;
    onAssign: (employeeId: number, rawValue: string) => void;
}

function EmployeeRow({
    employee,
    managerId,
    hasChange,
    allEmployees,
    noApproverValue,
    formatName,
    onAssign,
}: {
    employee: ApproverEmployeeItem;
    managerId: number | null;
    hasChange: boolean;
    allEmployees: ApproverEmployeeItem[];
    noApproverValue: string;
    formatName: (employee: { firstName: string; lastName: string; nickname: string | null }) => string;
    onAssign: (employeeId: number, value: string) => void;
}) {
    return (
        <div
            className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl border transition-colors ${
                hasChange
                    ? "border-indigo-300 bg-indigo-50/50"
                    : !managerId
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-gray-100 hover:bg-gray-50"
            }`}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{formatName(employee)}</span>
                    {hasChange ? (
                        <Badge variant="outline" className="text-indigo-600 border-indigo-300 text-xs">
                            แก้ไขแล้ว
                        </Badge>
                    ) : null}
                    {!managerId && !hasChange ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                            ยังไม่กำหนด
                        </Badge>
                    ) : null}
                </div>
                <p className="text-sm text-gray-500 truncate">
                    {employee.position} • {employee.dept?.name ?? "ไม่ระบุแผนก"}
                </p>
            </div>

            <select
                value={managerId ? String(managerId) : noApproverValue}
                onChange={(event) => onAssign(employee.id, event.target.value)}
                className="w-full sm:w-[240px] h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus-visible:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label={`เลือกผู้อนุมัติสำหรับ ${formatName(employee)}`}
            >
                <option value={noApproverValue}>- ไม่ระบุ -</option>
                {allEmployees
                    .filter((candidate) => candidate.id !== employee.id)
                    .map((candidate) => (
                        <option key={candidate.id} value={String(candidate.id)}>
                            {formatName(candidate)} {candidate.dept ? `(${candidate.dept.name})` : ""}
                        </option>
                    ))}
            </select>
        </div>
    );
}

export function ApproverTable({
    employees,
    allEmployees,
    assignments,
    noApproverValue,
    formatName,
    getManagerId,
    onAssign,
}: ApproverTableProps) {
    if (employees.length === 0) {
        return <p className="text-center text-gray-400 py-8">ไม่พบพนักงานที่ตรงกับการค้นหา</p>;
    }

    return (
        <div className="space-y-2">
            {employees.map((employee) => (
                <EmployeeRow
                    key={employee.id}
                    employee={employee}
                    managerId={getManagerId(employee)}
                    hasChange={assignments.has(employee.id)}
                    allEmployees={allEmployees}
                    noApproverValue={noApproverValue}
                    formatName={formatName}
                    onAssign={onAssign}
                />
            ))}
        </div>
    );
}
