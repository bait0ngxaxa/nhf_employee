"use client";

import { useId, useMemo, useState, type JSX } from "react";
import { CircleAlert, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type {
    RoutineAssigneeRole,
    RoutineEmployee,
} from "./types";

interface RoutineAssigneePickerProps {
    employees: readonly RoutineEmployee[];
    assignees: Readonly<Record<number, RoutineAssigneeRole>>;
    onToggle: (employeeId: number) => void;
    onRoleChange: (employeeId: number, role: RoutineAssigneeRole) => void;
    error?: string;
    note?: string;
    disabled?: boolean;
}

const MAX_VISIBLE_SEARCH_RESULTS = 8;

function employeeName(employee: RoutineEmployee): string {
    const fullName = `${employee.firstName} ${employee.lastName}`.trim();
    if (!fullName) return `ไม่พบข้อมูลพนักงาน (ID: ${employee.id})`;
    if (!employee.nickname || employee.nickname === "-") return fullName;
    return `${fullName} (${employee.nickname})`;
}

function employeeSearchText(employee: RoutineEmployee): string {
    return [
        String(employee.id),
        employeeName(employee),
        employee.firstName,
        employee.lastName,
        employee.nickname,
    ]
        .filter((value): value is string => Boolean(value && value !== "-"))
        .join(" ")
        .toLocaleLowerCase();
}

function isUnavailable(employee: RoutineEmployee): boolean {
    return (
        employee.status !== undefined
        && employee.status !== "ACTIVE"
    ) || Boolean(employee.deletedAt);
}

function unavailableLabel(employee: RoutineEmployee): string | null {
    if (!employee.firstName && !employee.lastName) return "ไม่พบข้อมูลพนักงาน";
    if (employee.deletedAt) return "ถูกลบแล้ว";
    if (employee.status && employee.status !== "ACTIVE") return "ไม่พร้อมใช้งาน";
    return null;
}

function notificationWarningLabel(employee: RoutineEmployee): string | null {
    return employee.notificationReady === false
        ? "บัญชียังไม่พร้อมใช้งาน · จะยังไม่ได้รับการแจ้งเตือน"
        : null;
}

function isAssigneeRole(value: string): value is RoutineAssigneeRole {
    return value === "OWNER" || value === "CO_OWNER";
}

export function RoutineAssigneePicker({
    employees,
    assignees,
    onToggle,
    onRoleChange,
    error,
    note,
    disabled = false,
}: RoutineAssigneePickerProps): JSX.Element {
    const [searchQuery, setSearchQuery] = useState("");
    const searchId = useId();
    const resultListId = `routine-assignee-results-${searchId.replaceAll(":", "")}`;
    const selectedIds = useMemo(
        () => new Set(Object.keys(assignees).map(Number)),
        [assignees],
    );
    const selectedEmployees = useMemo(() => {
        const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
        return Array.from(selectedIds)
            .map((employeeId) => employeesById.get(employeeId) ?? {
                id: employeeId,
                firstName: "",
                lastName: "",
                nickname: null,
                status: "INACTIVE",
            })
            .sort((left, right) => employeeName(left).localeCompare(employeeName(right), "th"));
    }, [employees, selectedIds]);
    const query = searchQuery.trim().toLocaleLowerCase();
    const matchingEmployees = useMemo(() => {
        if (!query) return [];
        return employees
            .filter((employee) => !selectedIds.has(employee.id))
            .filter((employee) => employeeSearchText(employee).includes(query))
            .sort((left, right) => employeeName(left).localeCompare(employeeName(right), "th"));
    }, [employees, query, selectedIds]);
    const visibleEmployees = matchingEmployees.slice(0, MAX_VISIBLE_SEARCH_RESULTS);

    return (
        <fieldset className="space-y-4 rounded-xl border border-border-subtle bg-surface-subtle p-4 sm:p-5">
            <legend className="px-1 text-base font-semibold text-content-heading">ผู้รับผิดชอบ</legend>
            {note ? <p className="max-w-prose text-sm leading-6 text-content-secondary">{note}</p> : null}
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="grid gap-1 text-sm font-medium text-content-body" htmlFor={searchId}>
                    ค้นหาพนักงาน
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
                        <Input
                            id={searchId}
                            data-routine-field="assignees"
                            aria-controls={resultListId}
                            aria-expanded={query.length > 0}
                            aria-invalid={Boolean(error)}
                            className="pl-9"
                            type="search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="พิมพ์ชื่อหรือชื่อเล่นเพื่อค้นหา"
                            disabled={disabled}
                        />
                    </div>
                </label>
                <span className="text-sm font-medium text-content-secondary">
                    เลือกแล้ว <strong className="text-content-heading">{selectedIds.size}</strong> คน
                </span>
            </div>

            {query.length > 0 ? (
                <div id={resultListId} className="rounded-lg border border-border-subtle bg-background p-1" role="listbox" aria-label="ผลการค้นหาพนักงาน">
                    {visibleEmployees.length > 0 ? visibleEmployees.map((employee) => {
                        const unavailable = isUnavailable(employee);
                        const name = employeeName(employee);
                        const unavailableText = unavailableLabel(employee);
                        const notificationWarning = unavailable
                            ? null
                            : notificationWarningLabel(employee);
                        return (
                            <label
                                key={employee.id}
                                className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                                role="option"
                                aria-selected={false}
                                aria-label={`เพิ่ม ${name} เป็นผู้รับผิดชอบ`}
                            >
                                <input
                                    type="checkbox"
                                    checked={false}
                                    disabled={disabled || unavailable}
                                    aria-label={`เลือก ${name}`}
                                    onChange={() => {
                                        if (disabled || unavailable) return;
                                        onToggle(employee.id);
                                        setSearchQuery("");
                                    }}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block break-words text-sm font-medium leading-6 text-content-body [overflow-wrap:anywhere]">{name}</span>
                                    {unavailableText ? <span className="block text-xs text-status-danger-foreground">{unavailableText} · เลือกเพิ่มไม่ได้</span> : null}
                                    {notificationWarning ? (
                                        <span className="mt-0.5 flex items-start gap-1 text-xs leading-5 text-status-warning-foreground">
                                            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                            <span>{notificationWarning}</span>
                                        </span>
                                    ) : null}
                                </span>
                            </label>
                        );
                    }) : (
                        <p className="px-3 py-2 text-sm text-content-secondary">ไม่พบพนักงานที่ตรงกับคำค้น</p>
                    )}
                    {matchingEmployees.length > MAX_VISIBLE_SEARCH_RESULTS ? (
                        <p className="px-3 py-2 text-xs text-content-secondary">
                            แสดง {MAX_VISIBLE_SEARCH_RESULTS} จาก {matchingEmployees.length} รายการ พิมพ์คำค้นให้ละเอียดขึ้น
                        </p>
                    ) : null}
                </div>
            ) : employees.length === 0 ? (
                <p className="rounded-md border border-dashed border-border-subtle bg-background px-3 py-2 text-sm text-content-secondary">
                    ยังไม่มีข้อมูลพนักงานให้เลือก
                </p>
            ) : null}

            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-content-body">รายชื่อที่เลือก</h4>
                    {selectedEmployees.length > 0 ? <span className="text-xs text-content-secondary">กำหนดบทบาทได้จากรายการนี้</span> : null}
                </div>
                {selectedEmployees.length > 0 ? (
                    <div className="max-h-52 space-y-2 overflow-y-auto">
                        {selectedEmployees.map((employee) => {
                            const name = employeeName(employee);
                            const unavailableText = unavailableLabel(employee);
                            const notificationWarning = unavailableText
                                ? null
                                : notificationWarningLabel(employee);
                            return (
                                <div key={employee.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-border-subtle bg-background px-3 py-2">
                                    <span className="min-w-0 flex-1">
                                        <span className="block break-words text-sm font-medium text-content-body">
                                            {name}
                                            {unavailableText ? <span className="ml-1 text-xs text-status-danger-foreground">({unavailableText})</span> : null}
                                        </span>
                                        {notificationWarning ? (
                                            <span className="mt-0.5 flex items-start gap-1 text-xs leading-5 text-status-warning-foreground">
                                                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                                <span>{notificationWarning}</span>
                                            </span>
                                        ) : null}
                                    </span>
                                    <select
                                        className="h-11 max-w-40 rounded-md border border-input bg-background px-2 text-sm sm:h-9 sm:text-xs"
                                        value={assignees[employee.id]}
                                        onChange={(event) => {
                                            if (isAssigneeRole(event.target.value)) onRoleChange(employee.id, event.target.value);
                                        }}
                                        aria-label={`บทบาทของ ${name}`}
                                        disabled={disabled}
                                    >
                                        <option value="OWNER">หลัก</option>
                                        <option value="CO_OWNER">ร่วม</option>
                                    </select>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => onToggle(employee.id)}
                                        aria-label={`นำ ${name} ออกจากผู้รับผิดชอบ`}
                                        disabled={disabled}
                                    >
                                        <X />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="rounded-md border border-dashed border-border-subtle bg-background px-3 py-2 text-sm text-content-secondary">
                        ยังไม่ได้เลือกผู้รับผิดชอบ
                    </p>
                )}
            </div>
            {error ? <p className="text-sm font-normal text-status-danger-foreground" role="alert">{error}</p> : null}
        </fieldset>
    );
}
