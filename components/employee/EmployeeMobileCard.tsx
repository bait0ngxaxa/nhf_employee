import { Badge } from "@/components/ui/badge";
import {
    AtSign,
    BriefcaseBusiness,
    Phone,
    ShieldCheck,
    UserRound,
    type LucideIcon,
} from "lucide-react";

import { type Employee } from "@/types/employees";
import {
    formatEmployeePhone,
    getEmployeeDisplayName,
    getEmployeeStatusBadge,
    getEmployeeStatusLabel,
} from "@/lib/helpers/employee-helpers";
import {
    EmployeeAvatar,
    EditEmployeeButton,
    isTemporaryEmail,
} from "./EmployeeTablePrimitives";

interface EmployeeMobileCardProps {
    employee: Employee;
    canEdit: boolean;
    onEditEmployee?: (employee: Employee) => void;
}

export function EmployeeMobileCard({
    employee,
    canEdit,
    onEditEmployee,
}: EmployeeMobileCardProps) {
    return (
        <article className="rounded-xl border border-border-subtle bg-surface-raised p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <EmployeeAvatar employee={employee} />
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold leading-6 text-content-heading [overflow-wrap:anywhere]">
                            {getEmployeeDisplayName(employee) || "ไม่ระบุชื่อ"}
                        </h3>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-content-secondary [overflow-wrap:anywhere]">
                            {employee.position}
                        </p>
                    </div>
                </div>
                <Badge className={getEmployeeStatusBadge(employee.status)}>
                    {getEmployeeStatusLabel(employee.status)}
                </Badge>
            </div>

            <dl className="mt-4 grid gap-3 text-sm">
                <MobileDetail
                    icon={UserRound}
                    label="ชื่อเล่น"
                    value={employee.nickname?.trim() || "-"}
                />
                <MobileDetail
                    icon={ShieldCheck}
                    label="แผนก"
                    value={employee.dept.name}
                />
                <MobileDetail
                    icon={BriefcaseBusiness}
                    label="สังกัด"
                    value={employee.affiliation || "-"}
                />
                <MobileDetail
                    icon={AtSign}
                    label="อีเมล"
                    value={isTemporaryEmail(employee.email) ? "-" : employee.email}
                />
                <MobileDetail
                    icon={Phone}
                    label="เบอร์โทร"
                    value={formatEmployeePhone(employee.phone)}
                />
            </dl>

            {canEdit && onEditEmployee ? (
                <div className="mt-4 flex justify-end border-t border-border-muted pt-3">
                    <EditEmployeeButton
                        employee={employee}
                        onEditEmployee={onEditEmployee}
                    />
                </div>
            ) : null}
        </article>
    );
}

function MobileDetail({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
}) {
    return (
        <div className="grid grid-cols-[1rem_minmax(5rem,7rem)_minmax(0,1fr)] items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 text-content-subtle" aria-hidden="true" />
            <dt className="text-xs font-medium text-content-muted">{label}</dt>
            <dd className="min-w-0 text-right text-xs font-medium leading-5 text-content-strong [overflow-wrap:anywhere]">
                {value}
            </dd>
        </div>
    );
}
