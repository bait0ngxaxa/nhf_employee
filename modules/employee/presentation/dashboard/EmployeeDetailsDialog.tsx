"use client";

import type { ReactElement, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogScrollArea, DialogTitle } from "@/components/ui/dialog";
import { getEmployeeFullName } from "../../domain/identity";
import { calculateEmploymentTenure, formatEmploymentHireDate, formatEmploymentTenure } from "../../domain/tenure";
import { formatEmployeePhone, getEmployeeStatusBadge, getEmployeeStatusLabel, isTemporaryEmail } from "./formatters";
import { EmployeeAvatar } from "./EmployeeTablePrimitives";
import { useEmploymentAsOfDate } from "./useEmploymentAsOfDate";
import type { Employee } from "./types";

interface EmployeeDetailsDialogProps {
    employee: Employee;
    onClose: () => void;
    onCloseAutoFocus: (event: Event) => void;
}

export function EmployeeDetailsDialog({ employee, onClose, onCloseAutoFocus }: EmployeeDetailsDialogProps): ReactElement {
    const asOfDate = useEmploymentAsOfDate();
    const status = <Badge className={getEmployeeStatusBadge(employee.status)}>{getEmployeeStatusLabel(employee.status)}</Badge>;

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-2xl" closeLabel="ปิดรายละเอียด" onCloseAutoFocus={onCloseAutoFocus}>
                <DialogHeader className="shrink-0 pr-10 text-left">
                    <div className="flex min-w-0 items-start gap-3">
                        <EmployeeAvatar employee={employee} />
                        <div className="min-w-0 space-y-2">
                            <DialogTitle className="leading-7 text-content-heading [overflow-wrap:anywhere]">
                                {getEmployeeFullName(employee.firstName, employee.lastName) || "ไม่ระบุชื่อ"}
                            </DialogTitle>
                            <p className="text-sm text-content-secondary [overflow-wrap:anywhere]">ชื่อเล่น: {employee.nickname?.trim() || "-"}</p>
                            {status}
                        </div>
                    </div>
                    <DialogDescription>รายละเอียดข้อมูลส่วนตัว การติดต่อ และการทำงานของพนักงาน</DialogDescription>
                </DialogHeader>
                <DialogScrollArea className="space-y-6 pr-2">
                    <section aria-labelledby="employee-personal-heading">
                        <h3 id="employee-personal-heading" className="mb-4 text-sm font-semibold text-content-heading">ข้อมูลส่วนตัวและการติดต่อ</h3>
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                            <Detail label="ชื่อ">{employee.firstName.trim() || "-"}</Detail>
                            <Detail label="นามสกุล">{employee.lastName.trim() || "-"}</Detail>
                            <Detail label="ชื่อเล่น">{employee.nickname?.trim() || "-"}</Detail>
                            <Detail label="อีเมล">{isTemporaryEmail(employee.email) ? "-" : employee.email || "-"}</Detail>
                            <Detail label="เบอร์โทร">{formatEmployeePhone(employee.phone)}</Detail>
                        </dl>
                    </section>
                    <section aria-labelledby="employee-employment-heading" className="border-t border-border-muted pt-6">
                        <h3 id="employee-employment-heading" className="mb-4 text-sm font-semibold text-content-heading">ข้อมูลการทำงาน</h3>
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                            <Detail label="ตำแหน่ง">{employee.position || "-"}</Detail>
                            <Detail label="แผนก">{employee.dept.name || "-"}</Detail>
                            <Detail label="สังกัด">{employee.affiliation?.trim() || "-"}</Detail>
                            <Detail label="วันที่เริ่มงาน">{formatEmploymentHireDate(employee.hireDate)}</Detail>
                            <Detail label="อายุงาน">{formatEmploymentTenure(calculateEmploymentTenure(employee.hireDate, asOfDate))}</Detail>
                            <Detail label="สถานะ">{status}</Detail>
                        </dl>
                    </section>
                </DialogScrollArea>
            </DialogContent>
        </Dialog>
    );
}

function Detail({ label, children }: { label: string; children: ReactNode }): ReactElement {
    return (
        <div className="min-w-0 space-y-1">
            <dt className="text-xs font-medium text-content-muted">{label}</dt>
            <dd className="text-sm leading-6 text-content-strong [overflow-wrap:anywhere]">{children}</dd>
        </div>
    );
}
