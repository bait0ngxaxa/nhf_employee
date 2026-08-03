import { Edit3, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/ui/state";

import { ROUTINE_SCHEDULE_LABELS } from "./labels";
import type { PaginatedTasksResponse, RoutineTask } from "./types";

interface RoutineTaskListProps {
    data: PaginatedTasksResponse | undefined;
    error: Error | undefined;
    isLoading: boolean;
    onRetry: () => void;
    onCreate: () => void;
    onEdit: (task: RoutineTask) => void;
    onPageChange: (page: number) => void;
}

export function RoutineTaskList({
    data,
    error,
    isLoading,
    onRetry,
    onCreate,
    onEdit,
    onPageChange,
}: RoutineTaskListProps) {
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
                                <td className="px-4 py-4"><span className={task.isActive ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"}>{task.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</span><p className="mt-2 text-xs text-content-secondary">สร้างแล้ว {task._count.occurrences} รอบ</p></td>
                                <td className="px-4 py-4 text-right"><Button type="button" variant="outline" size="sm" onClick={() => onEdit(task)}><Edit3 aria-hidden="true" /> แก้ไข</Button></td>
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
        </div>
    );
}
