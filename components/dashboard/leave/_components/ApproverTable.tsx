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
            className={`flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center ${
                hasChange
                    ? "border-sky-300 bg-sky-50"
                    : !managerId
                      ? "border-amber-200 bg-amber-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="break-words font-medium text-slate-950">{formatName(employee)}</span>
                    {hasChange ? (
                        <Badge variant="outline" className="border-sky-300 text-xs text-sky-700">
                            แก้ไขแล้ว
                        </Badge>
                    ) : null}
                    {!managerId && !hasChange ? (
                        <Badge variant="outline" className="border-amber-300 text-xs text-amber-700">
                            ยังไม่กำหนด
                        </Badge>
                    ) : null}
                </div>
                <p className="break-words text-sm text-slate-600">
                    {employee.position} • {employee.dept?.name ?? "ไม่ระบุแผนก"}
                </p>
            </div>

            <select
                value={managerId ? String(managerId) : noApproverValue}
                onChange={(event) => onAssign(employee.id, event.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-[240px]"
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
        return (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm font-medium text-slate-800">
                    ไม่พบพนักงานที่ตรงกับการค้นหา
                </p>
                <p className="mt-1 text-sm text-slate-500">
                    ลองเปลี่ยนคำค้นหาหรือตัวกรองผู้อนุมัติ
                </p>
            </div>
        );
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
