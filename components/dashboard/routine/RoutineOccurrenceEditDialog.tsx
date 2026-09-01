"use client";

import { Save } from "lucide-react";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    addRoutineAssignee,
    normalizeRoutineAssignees,
    removeRoutineAssignee,
    setRoutineAssigneeRole,
} from "@/lib/routine/assignees";
import { API_ROUTES } from "@/lib/ssot/routes";

import { RoutineAssigneePicker } from "./RoutineAssigneePicker";
import type {
    RoutineAssigneeRole,
    RoutineEmployee,
    RoutineTaskWorkItem,
    RoutineTaskWorkItemOccurrence,
} from "./types";

interface RoutineOccurrenceEditorState {
    assignees: Record<number, RoutineAssigneeRole>;
    dueDate: string;
    id: number;
    note: string;
}

interface RoutineOccurrenceEditDialogProps {
    employees: readonly RoutineEmployee[];
    onOpenChange: (open: boolean) => void;
    onSaved: () => void | Promise<void>;
    open: boolean;
    task: RoutineTaskWorkItem | null;
}

function editorAssignees(
    occurrence: RoutineTaskWorkItemOccurrence,
): Record<number, RoutineAssigneeRole> {
    return normalizeRoutineAssignees(Object.fromEntries(
        occurrence.assignees.map((assignee) => [assignee.employeeId, assignee.role]),
    ));
}

function editorState(
    occurrence: RoutineTaskWorkItemOccurrence,
): RoutineOccurrenceEditorState {
    return {
        id: occurrence.id,
        dueDate: occurrence.dueDate,
        note: "",
        assignees: editorAssignees(occurrence),
    };
}

function errorMessage(body: unknown): string {
    if (typeof body === "object" && body !== null && "error" in body) {
        const value = body.error;
        return typeof value === "string" ? value : "บันทึกรายการไม่สำเร็จ";
    }
    return "บันทึกรายการไม่สำเร็จ";
}

async function sendRoutineMutation(url: string, payload: unknown): Promise<void> {
    const response = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(body));
}

export function RoutineOccurrenceEditDialog({
    employees,
    onOpenChange,
    onSaved,
    open,
    task,
}: RoutineOccurrenceEditDialogProps): ReactElement {
    const occurrence = task?.relevantOccurrence ?? null;
    const [editor, setEditor] = useState<RoutineOccurrenceEditorState | null>(
        () => occurrence ? editorState(occurrence) : null,
    );
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const saveLockRef = useRef(false);

    useEffect(() => {
        if (!open || !occurrence) return;
        setEditor(editorState(occurrence));
        setError(null);
    }, [occurrence, open]);

    function closeWhenIdle(): void {
        if (!isSaving && !saveLockRef.current) onOpenChange(false);
    }

    function toggleAssignee(employeeId: number): void {
        setEditor((current) => current
            ? {
                  ...current,
                  assignees: current.assignees[employeeId]
                      ? removeRoutineAssignee(current.assignees, employeeId)
                      : addRoutineAssignee(current.assignees, employeeId),
              }
            : current);
    }

    function updateAssigneeRole(employeeId: number, role: RoutineAssigneeRole): void {
        setEditor((current) => current
            ? { ...current, assignees: setRoutineAssigneeRole(current.assignees, employeeId, role) }
            : current);
    }

    async function save(): Promise<void> {
        if (!task || !occurrence || !editor || saveLockRef.current) return;
        const ownerCount = Object.values(editor.assignees)
            .filter((role) => role === "OWNER")
            .length;
        if (!editor.dueDate || ownerCount !== 1 || Object.keys(editor.assignees).length === 0) {
            setError("กรุณาระบุวันกำหนดและผู้รับผิดชอบหลัก 1 คน");
            return;
        }

        saveLockRef.current = true;
        setIsSaving(true);
        setError(null);
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
            await onSaved();
            toast.success(`ปรับเฉพาะรอบของ “${task.title}” สำเร็จ`);
            onOpenChange(false);
        } catch (saveError) {
            const message = saveError instanceof Error
                ? saveError.message
                : "บันทึกรายการไม่สำเร็จ";
            setError(message);
            toast.error(message);
        } finally {
            setIsSaving(false);
            saveLockRef.current = false;
        }
    }

    if (!task || !occurrence || !editor) {
        return <Dialog open={false} onOpenChange={onOpenChange} />;
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) closeWhenIdle();
            }}
        >
            <DialogContent
                closeLabel="ปิดการปรับรอบ Routine"
                showCloseButton={!isSaving}
                scrollMode="area"
                className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl"
            >
                <DialogHeader className="shrink-0 gap-2 border-b border-border-subtle bg-surface-subtle px-5 py-4 pr-12 text-left sm:px-6">
                    <DialogTitle className="text-xl font-semibold leading-7 tracking-tight text-content-heading">
                        ปรับเฉพาะรอบนี้
                    </DialogTitle>
                    <DialogDescription className="max-w-[70ch] break-words text-sm leading-6 text-content-secondary [overflow-wrap:anywhere]">
                        แก้วันกำหนดและผู้รับผิดชอบเฉพาะรอบ {occurrence.periodKey} ของ “{task.title}” โดยไม่เปลี่ยนแม่แบบ Routine หรือรอบอื่น
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save();
                    }}
                >
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
                        {error ? (
                            <p className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm leading-6 text-status-danger-foreground" role="alert">
                                {error}
                            </p>
                        ) : null}
                        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                            <label className="grid gap-1 text-sm font-medium text-content-body">
                                วันกำหนด
                                <Input
                                    type="date"
                                    value={editor.dueDate}
                                    disabled={isSaving}
                                    onChange={(event) => setEditor((current) => current
                                        ? { ...current, dueDate: event.target.value }
                                        : current)}
                                />
                            </label>
                            <label className="grid gap-1 text-sm font-medium text-content-body">
                                หมายเหตุ (ถ้ามี)
                                <Textarea
                                    value={editor.note}
                                    maxLength={1000}
                                    disabled={isSaving}
                                    onChange={(event) => setEditor((current) => current
                                        ? { ...current, note: event.target.value }
                                        : current)}
                                    placeholder="บันทึกเหตุผลหรือรายละเอียดเพิ่มเติมได้ตามต้องการ"
                                />
                            </label>
                        </div>
                        <RoutineAssigneePicker
                            employees={employees}
                            assignees={editor.assignees}
                            onToggle={toggleAssignee}
                            onRoleChange={updateAssigneeRole}
                            disabled={isSaving}
                        />
                    </div>
                    <DialogFooter className="shrink-0 border-t border-border-subtle bg-surface-subtle px-5 py-4 sm:px-6">
                        <Button type="button" variant="outline" disabled={isSaving} onClick={closeWhenIdle}>
                            ยกเลิก
                        </Button>
                        <Button type="submit" disabled={isSaving} aria-busy={isSaving}>
                            <Save aria-hidden="true" />
                            {isSaving ? "กำลังบันทึก..." : "บันทึกการปรับรอบนี้"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
