import { useRef, useState } from "react";
import { Edit3, Power, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/ui/state";
import { getCurrentBangkokDate } from "@/lib/routine/schedule";

import { ROUTINE_SCHEDULE_LABELS } from "./labels";
import type { PaginatedTasksResponse, RoutineTask } from "./types";

interface RoutineTaskListProps {
    data: PaginatedTasksResponse | undefined;
    error: Error | undefined;
    isLoading: boolean;
    onRetry: () => void;
    onCreate: () => void;
    onEdit: (task: RoutineTask) => void;
    onToggleActive: (task: RoutineTask) => Promise<void>;
    onDelete: (task: RoutineTask) => Promise<void>;
    pendingTaskId?: number | null;
    onPageChange: (page: number) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function taskInformationBadges(task: RoutineTask, today: string): string[] {
    const badges: string[] = [];
    if (task.contractEndDate && task.contractEndDate < today) {
        badges.push("สัญญาสิ้นสุดแล้ว");
    }
    if (task.scheduleType === "ONE_TIME" && isRecord(task.scheduleConfig)) {
        const date = task.scheduleConfig.date;
        if (typeof date === "string" && date < today) badges.push("กำหนดครั้งเดียวผ่านแล้ว");
    }
    if (task.scheduleType === "MANUAL") badges.push("กำหนดการแบบ Manual");
    return badges;
}

export function RoutineTaskList({
    data,
    error,
    isLoading,
    onRetry,
    onCreate,
    onEdit,
    onToggleActive,
    onDelete,
    pendingTaskId = null,
    onPageChange,
}: RoutineTaskListProps) {
    const [deleteTask, setDeleteTask] = useState<RoutineTask | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const deleteLockRef = useRef(false);
    const today = getCurrentBangkokDate();
    if (isLoading) return <LoadingState label="กำลังโหลดแม่แบบงานประจำ..." compact />;
    if (error) return <ErrorState compact action={{ label: "ลองใหม่", onClick: onRetry }} description={error.message} />;
    if (!data || data.tasks.length === 0) {
        return (
            <EmptyState
                compact
                title="ยังไม่มีแม่แบบงานประจำ"
                description="สร้างแม่แบบงานเพื่อให้ระบบสร้างงานแต่ละรอบอัตโนมัติ"
                action={{ label: "สร้างแม่แบบงาน", onClick: onCreate, icon: <Plus aria-hidden="true" /> }}
            />
        );
    }
    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <Button type="button" size="sm" onClick={onCreate}><Plus aria-hidden="true" /> สร้างแม่แบบงาน</Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-raised">
                <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-border-subtle bg-surface-subtle text-xs text-content-secondary">
                        <tr><th className="px-4 py-3 font-semibold">งาน</th><th className="px-4 py-3 font-semibold">หน่วยงาน</th><th className="px-4 py-3 font-semibold">กำหนดการ</th><th className="px-4 py-3 font-semibold">ผู้รับผิดชอบ</th><th className="px-4 py-3 font-semibold">สถานะ</th><th className="px-4 py-3" /></tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                        {data.tasks.map((task) => (
                            <tr key={task.id} className="align-top">
                                <td className="px-4 py-4"><p className="font-semibold text-content-heading">{task.title}</p><p className="mt-1 text-xs text-content-secondary">{task.category.name}</p></td>
                                <td className="px-4 py-4 text-content-body">{task.unit.code}</td>
                                <td className="px-4 py-4 text-content-body">{ROUTINE_SCHEDULE_LABELS[task.scheduleType] ?? task.scheduleType}<p className="mt-1 text-xs text-content-secondary">{task.scheduleText ?? "ไม่ได้ระบุคำอธิบาย"}</p></td>
                                <td className="px-4 py-4 text-content-body">{task.assignees.map((assignee) => assignee.employee.displayName ?? `${assignee.employee.firstName} ${assignee.employee.lastName}`).join(", ")}</td>
                                <td className="px-4 py-4"><span className={task.isActive ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"}>{task.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</span><div className="mt-2 flex flex-wrap gap-1">{taskInformationBadges(task, today).map((badge) => <span key={badge} className="rounded-full border border-status-warning-border bg-status-warning-surface px-2 py-1 text-[11px] font-medium text-status-warning-foreground">{badge}</span>)}</div><p className="mt-2 text-xs text-content-secondary">รอบแจ้งเตือนภายใน {task._count.occurrences} รอบ</p></td>
                                <td className="px-4 py-4 text-right"><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => onEdit(task)} disabled={pendingTaskId === task.id}><Edit3 aria-hidden="true" /> แก้ไข</Button><Button type="button" variant="outline" size="sm" disabled={pendingTaskId === task.id} onClick={() => void onToggleActive(task)}><Power aria-hidden="true" /> {pendingTaskId === task.id ? "กำลังบันทึก..." : task.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</Button><Button type="button" variant="ghost" size="sm" className="text-status-danger-foreground" disabled={pendingTaskId === task.id} onClick={() => setDeleteTask(task)}><Trash2 aria-hidden="true" /> ลบ</Button></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {data.pagination.pages > 1 ? (
                <div className="flex items-center justify-between border-t border-border-subtle pt-4 text-sm text-content-secondary">
                    <span>หน้า {data.pagination.page} จาก {data.pagination.pages}</span>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={data.pagination.page <= 1} onClick={() => onPageChange(data.pagination.page - 1)}>ก่อนหน้า</Button>
                        <Button type="button" variant="outline" size="sm" disabled={data.pagination.page >= data.pagination.pages} onClick={() => onPageChange(data.pagination.page + 1)}>ถัดไป</Button>
                    </div>
                </div>
            ) : null}
            <AlertDialog open={deleteTask !== null} onOpenChange={(open) => { if (!open && !isDeleting && !deleteLockRef.current) setDeleteTask(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ยืนยันการลบ Routine</AlertDialogTitle>
                        <AlertDialogDescription>
                            คุณกำลังจะลบ “{deleteTask?.title}” ข้อมูลรอบแจ้งเตือนและกฎแจ้งเตือนของรายการนี้จะถูกลบ และไม่สามารถกู้คืนได้
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={isDeleting}
                            onClick={(event) => {
                                event.preventDefault();
                                if (!deleteTask || isDeleting || deleteLockRef.current) return;
                                deleteLockRef.current = true;
                                setIsDeleting(true);
                                void onDelete(deleteTask)
                                    .then(() => setDeleteTask(null))
                                    .catch(() => undefined)
                                    .finally(() => {
                                        setIsDeleting(false);
                                        deleteLockRef.current = false;
                                    });
                            }}
                        >{isDeleting ? "กำลังลบ..." : "ลบรายการ"}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
