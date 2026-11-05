"use client";

import { memo, useRef, useState, type ReactElement, type RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { getEmployeeFullName } from "../../domain/identity";
import type { Employee } from "./types";
import { getEmployeeStatusLabel, getEmployeeStatusBadge, isTemporaryEmail } from "./formatters";
import { EmployeeMobileCard } from "./EmployeeMobileCard";
import { EmployeeDetailsDialog } from "./EmployeeDetailsDialog";
import { DetailsEmployeeButton, EditEmployeeButton, EmployeeAvatar } from "./EmployeeTablePrimitives";

interface EmployeeTableProps {
    employees: Employee[];
    canUpdateEmployees: boolean;
    onEditEmployee?: (employee: Employee) => void;
    detailsFocusFallbackRef?: RefObject<HTMLDivElement | null>;
}

export const EmployeeTable = memo(function EmployeeTable({
    employees,
    canUpdateEmployees,
    onEditEmployee,
    detailsFocusFallbackRef,
}: EmployeeTableProps): ReactElement | null {
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
    const detailsTrigger = useRef<HTMLButtonElement | null>(null);
    const tableRef = useRef<HTMLDivElement>(null);
    const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);

    // Forget removed selections so they cannot reopen when an ID returns later.
    if (selectedEmployeeId !== null && !selectedEmployee) {
        setSelectedEmployeeId(null);
    }
    if (employees.length === 0) return null;

    const canEdit = canUpdateEmployees && Boolean(onEditEmployee);
    const openDetails = (employee: Employee, trigger: HTMLButtonElement): void => {
        detailsTrigger.current = trigger;
        setSelectedEmployeeId(employee.id);
    };
    const editEmployee = (employee: Employee): void => {
        if (!canEdit) return;
        setSelectedEmployeeId(null);
        onEditEmployee?.(employee);
    };

    return (
        <div ref={tableRef} tabIndex={-1} className="min-w-0 space-y-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <div className="grid gap-3 xl:hidden">
                {employees.map((employee) => (
                    <EmployeeMobileCard
                        key={employee.id}
                        employee={employee}
                        canUpdateEmployees={canEdit}
                        onViewEmployee={openDetails}
                        onEditEmployee={editEmployee}
                    />
                ))}
            </div>
            <div className="hidden max-h-[70vh] overflow-auto rounded-xl border border-border-subtle bg-surface-raised xl:block">
                <table className="w-full table-fixed text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-border-subtle bg-surface-subtle">
                        <tr>
                            <th scope="col" className="w-[27%] px-4 py-4 text-xs font-semibold text-content-secondary">ชื่อ-นามสกุล</th>
                            <th scope="col" className="w-[13%] px-3 py-4 text-xs font-semibold text-content-secondary">ชื่อเล่น</th>
                            <th scope="col" className="w-[26%] px-3 py-4 text-xs font-semibold text-content-secondary">อีเมล</th>
                            <th scope="col" className="w-[14%] px-3 py-4 text-xs font-semibold text-content-secondary">สถานะ</th>
                            <th scope="col" className="w-[20%] px-3 py-4 text-xs font-semibold text-content-secondary">การจัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-muted">
                        {employees.map((employee) => (
                            <tr key={employee.id} className="group transition-colors hover:bg-brand-surface/40">
                                <td className="px-4 py-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <EmployeeAvatar employee={employee} />
                                        <span className="min-w-0 font-semibold leading-6 text-content-heading [overflow-wrap:anywhere]">
                                            {getEmployeeFullName(employee.firstName, employee.lastName) || "ไม่ระบุชื่อ"}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-content-body [overflow-wrap:anywhere]">{employee.nickname?.trim() || "-"}</td>
                                <td className="px-3 py-3 text-content-strong [overflow-wrap:anywhere]">{isTemporaryEmail(employee.email) ? "-" : employee.email}</td>
                                <td className="px-3 py-3">
                                    <Badge className={getEmployeeStatusBadge(employee.status)}>{getEmployeeStatusLabel(employee.status)}</Badge>
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex flex-wrap gap-2">
                                        <DetailsEmployeeButton employee={employee} onViewEmployee={openDetails} />
                                        {canEdit ? <EditEmployeeButton employee={employee} onEditEmployee={editEmployee} /> : null}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {selectedEmployee ? (
                <EmployeeDetailsDialog
                    employee={selectedEmployee}
                    onClose={() => setSelectedEmployeeId(null)}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        const target = detailsTrigger.current?.isConnected
                            ? detailsTrigger.current
                            : detailsFocusFallbackRef?.current ?? tableRef.current;
                        target?.focus();
                    }}
                />
            ) : null}
        </div>
    );
});
