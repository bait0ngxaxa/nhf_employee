import { useRef, useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import type { KeyedMutator } from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/ui/state";
import { calendarDateToDate } from "@/lib/routine/schedule";
import { API_ROUTES } from "@/lib/ssot/routes";

import {
    formatRoutineDueLabel,
    getRoutineTimingStatusClass,
    ROUTINE_TIMING_STATUS_LABELS,
} from "./labels";
import type {
    PaginatedRoutineTaskWorkItemsResponse,
    RoutineAssignee,
    RoutineAssigneeRole,
    RoutineEmployee,
    RoutineTaskWorkItem,
    RoutineTaskWorkItemOccurrence,
} from "./types";

interface RoutineOccurrenceListProps {
    data: PaginatedRoutineTaskWorkItemsResponse | undefined;
    error: Error | undefined;
    isLoading: boolean;
    isAdmin: boolean;
    focusTaskId: number | null;
    onRetry: () => void;
    onPageChange: (page: number) => void;
    onEditTask: (taskId: number) => void;
    mutate: KeyedMutator<PaginatedRoutineTaskWorkItemsResponse>;
    employees: RoutineEmployee[];
}

interface RoutineOccurrenceEditorState {
    id: number;
    dueDate: string;
    note: string;
    assignees: Record<number, RoutineAssigneeRole>;
}

function employeeNames(assignees: RoutineAssignee[]): string {
    return assignees
        .map((assignee) => assignee.employee.displayName
            ?? `${assignee.employee.firstName} ${assignee.employee.lastName}`)
        .join(", ");
}

function displayEmployeeName(employee: RoutineEmployee): string {
    const name = `${employee.firstName} ${employee.lastName}`.trim();
    return employee.nickname ? `${name} (${employee.nickname})` : name;
}

function errorMessage(body: unknown): string {
    if (typeof body === "object" && body !== null && "error" in body) {
        const value = body.error;
        return typeof value === "string" ? value : "บันทึกรายการไม่สำเร็จ";
    }
    return "บันทึกรายการไม่สำเร็จ";
}

async function sendRoutineMutation(
    url: string,
    payload: unknown,
): Promise<void> {
    const response = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(body));
}

function formatDate(date: string): string {
    return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Bangkok",
    }).format(calendarDateToDate(date));
}

function editorAssignees(
    occurrence: RoutineTaskWorkItemOccurrence,
): Record<number, RoutineAssigneeRole> {
    return Object.fromEntries(
        occurrence.assignees.map((assignee) => [assignee.employeeId, assignee.role]),
    );
}

export function RoutineOccurrenceList({
    data,
    error,
    isLoading,
    isAdmin,
    focusTaskId,
    onRetry,
    onPageChange,
    onEditTask,
    mutate,
    employees,
}: RoutineOccurrenceListProps) {
    const [busyId, setBusyId] = useState<number | null>(null);
    const [editor, setEditor] = useState<RoutineOccurrenceEditorState | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const saveLockRef = useRef(false);

    function beginEdit(occurrence: RoutineTaskWorkItemOccurrence): void {
        setActionError(null);
        setEditor({
            id: occurrence.id,
            dueDate: occurrence.dueDate,
            note: "",
            assignees: editorAssignees(occurrence),
        });
    }

    function toggleAssignee(employeeId: number): void {
        setEditor((current) => {
            if (!current) return current;
            const assignees = { ...current.assignees };
            if (assignees[employeeId]) {
                delete assignees[employeeId];
            } else {
                assignees[employeeId] = Object.keys(assignees).length === 0
                    ? "OWNER"
                    : "CO_OWNER";
            }
            return { ...current, assignees };
        });
    }

    async function saveEdit(
        task: RoutineTaskWorkItem,
        occurrence: RoutineTaskWorkItemOccurrence,
    ): Promise<void> {
        if (!editor || editor.id !== occurrence.id || saveLockRef.current) return;
        const ownerCount = Object.values(editor.assignees)
            .filter((role) => role === "OWNER")
            .length;
        if (!editor.dueDate || ownerCount !== 1 || Object.keys(editor.assignees).length === 0) {
            setActionError("กรุณาระบุวันกำหนดและผู้รับผิดชอบหลัก 1 คน");
            return;
        }

        saveLockRef.current = true;
        setBusyId(occurrence.id);
        setActionError(null);
        try {
            const assignees = Object.entries(editor.assignees).map(
                ([employeeId, role]) => ({ employeeId: Number(employeeId), role }),
            );
            await sendRoutineMutation(
                API_ROUTES.routines.occurrenceById(occurrence.id),
                {
                    expectedReminderVersion: occurrence.reminderVersion,
                    dueDate: editor.dueDate,
                    note: editor.note.trim() || null,
                    assignees,
                },
            );
            await mutate();
            toast.success(`ปรับเฉพาะรอบของ “${task.title}” สำเร็จ`);
            setEditor(null);
        } catch (saveError) {
            const message = saveError instanceof Error ? saveError.message : "บันทึกรายการไม่สำเร็จ";
            setActionError(message);
            toast.error(message);
        } finally {
            setBusyId(null);
            saveLockRef.current = false;
        }
    }

    if (isLoading) return <LoadingState label="กำลังโหลดรายการ Routine..." compact />;
    if (error) {
        return (
            <ErrorState
                compact
                action={{ label: "ลองใหม่", onClick: onRetry }}
                description={error.message}
            />
        );
    }
    if (!data || data.tasks.length === 0) {
        return (
            <EmptyState
                compact
                title={focusTaskId === null ? "ยังไม่มีรายการ Routine" : "ไม่พบรายการ Routine นี้"}
                description={focusTaskId === null
                    ? "รายการตามกำหนดการจะแสดงที่นี่เมื่อมีแม่แบบงานที่รับผิดชอบ"
                    : "รายการอาจถูกลบ ปิดใช้งาน หรือคุณไม่มีสิทธิ์เข้าถึงรายการนี้"}
            />
        );
    }

    return (
        <div className="space-y-3" aria-label="รายการ Routine">
            {actionError ? (
                <p className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-foreground" role="alert">
                    {actionError}
                </p>
            ) : null}
            {data.tasks.map((task) => {
                const occurrence = task.relevantOccurrence;
                const isEditing = occurrence !== null && editor?.id === occurrence.id;
                const isBusy = occurrence !== null && busyId === occurrence.id;
                return (
                    <article
                        key={task.id}
                        className="rounded-xl border border-border-subtle bg-surface-raised p-4 shadow-sm sm:p-5"
                    >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
                                    <span>{task.unit.name}</span>
                                    <span aria-hidden="true">•</span>
                                    <span>{task.category.name}</span>
                                </div>
                                <h3 className="text-base font-semibold text-content-heading">
                                    {task.title}
                                </h3>
                                <div className="grid gap-2 text-sm text-content-secondary sm:grid-cols-2">
                                    <p>
                                        ผู้รับผิดชอบ: <span className="text-content-body">{employeeNames(task.assignees) || "ยังไม่ได้ระบุ"}</span>
                                    </p>
                                    <p>
                                        กำหนด: {occurrence ? (
                                            <span className={occurrence.isOverdue ? "font-semibold text-status-danger-foreground" : "text-content-body"}>
                                                {formatDate(occurrence.dueDate)} ({formatRoutineDueLabel(occurrence)})
                                            </span>
                                        ) : (
                                            <span className="text-content-body">ยังไม่มีรอบกำหนด</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
                                {occurrence ? (
                                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRoutineTimingStatusClass(occurrence.timingStatus)}`}>
                                        {ROUTINE_TIMING_STATUS_LABELS[occurrence.timingStatus]}
                                    </span>
                                ) : (
                                    <span className="rounded-full border border-border-subtle bg-surface-subtle px-3 py-1 text-xs font-semibold text-content-secondary">
                                        ยังไม่มีรอบกำหนด
                                    </span>
                                )}
                                {isAdmin ? (
                                    <div className="flex flex-wrap gap-2 lg:justify-end">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onEditTask(task.id)}
                                            disabled={isBusy}
                                        >
                                            <Pencil aria-hidden="true" />
                                            แก้ไข Routine
                                        </Button>
                                        {occurrence ? (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={isBusy}
                                                onClick={() => (isEditing ? setEditor(null) : beginEdit(occurrence))}
                                            >
                                                {isEditing ? <X aria-hidden="true" /> : <Pencil aria-hidden="true" />}
                                                {isEditing ? "ปิดการแก้ไข" : "ปรับเฉพาะรอบนี้"}
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {isEditing && editor && occurrence ? (
                            <div className="mt-4 space-y-4 rounded-lg border border-border-subtle bg-surface-subtle p-4">
                                <div>
                                    <p className="text-sm font-semibold text-content-heading">ปรับเฉพาะรอบนี้</p>
                                    <p className="mt-1 text-xs text-content-secondary">
                                        มีผลกับรอบ {occurrence.periodKey} ของรายการนี้เท่านั้น ไม่เปลี่ยนแม่แบบงานหรือรอบอื่น
                                    </p>
                                </div>
                                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                                    <label className="grid gap-1 text-sm font-medium text-content-body">
                                        วันกำหนด
                                        <Input
                                            type="date"
                                            value={editor.dueDate}
                                            onChange={(event) => setEditor((current) => current ? { ...current, dueDate: event.target.value } : current)}
                                        />
                                    </label>
                                    <label className="grid gap-1 text-sm font-medium text-content-body">
                                        หมายเหตุ (ถ้ามี)
                                        <Textarea
                                            value={editor.note}
                                            onChange={(event) => setEditor((current) => current ? { ...current, note: event.target.value } : current)}
                                            placeholder="บันทึกเหตุผลหรือรายละเอียดเพิ่มเติมได้ตามต้องการ"
                                        />
                                    </label>
                                </div>
                                <fieldset className="grid gap-2">
                                    <legend className="text-sm font-medium text-content-body">ผู้รับผิดชอบของรอบนี้</legend>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {employees.map((employee) => {
                                            const selectedRole = editor.assignees[employee.id];
                                            return (
                                                <div key={employee.id} className="flex items-center gap-3 rounded-lg border border-border-subtle bg-background px-3 py-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRole !== undefined}
                                                        onChange={() => toggleAssignee(employee.id)}
                                                        aria-label={`เลือก ${displayEmployeeName(employee)}`}
                                                    />
                                                    <span className="min-w-0 flex-1 text-sm text-content-body">{displayEmployeeName(employee)}</span>
                                                    {selectedRole ? (
                                                        <select
                                                            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                                                            value={selectedRole}
                                                            onChange={(event) => setEditor((current) => current ? {
                                                                ...current,
                                                                assignees: {
                                                                    ...current.assignees,
                                                                    [employee.id]: event.target.value as RoutineAssigneeRole,
                                                                },
                                                            } : current)}
                                                            aria-label={`บทบาท ${displayEmployeeName(employee)}`}
                                                        >
                                                            <option value="OWNER">ผู้รับผิดชอบหลัก</option>
                                                            <option value="CO_OWNER">ผู้ร่วมรับผิดชอบ</option>
                                                        </select>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {employees.length === 0 ? <p className="text-sm text-content-secondary">ไม่พบพนักงานที่พร้อมรับผิดชอบ</p> : null}
                                </fieldset>
                                <div className="flex flex-wrap justify-end gap-2">
                                    <Button type="button" variant="outline" disabled={isBusy} onClick={() => setEditor(null)}>ปิด</Button>
                                    <Button type="button" disabled={isBusy} onClick={() => void saveEdit(task, occurrence)}>
                                        <Save aria-hidden="true" />
                                        {isBusy ? "กำลังบันทึก..." : "บันทึกการปรับรอบนี้"}
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </article>
                );
            })}
            {data.pagination.pages > 1 ? (
                <div className="flex items-center justify-between border-t border-border-subtle pt-4 text-sm text-content-secondary">
                    <span>หน้า {data.pagination.page} จาก {data.pagination.pages}</span>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={data.pagination.page <= 1} onClick={() => onPageChange(data.pagination.page - 1)}>ก่อนหน้า</Button>
                        <Button type="button" variant="outline" size="sm" disabled={data.pagination.page >= data.pagination.pages} onClick={() => onPageChange(data.pagination.page + 1)}>ถัดไป</Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
