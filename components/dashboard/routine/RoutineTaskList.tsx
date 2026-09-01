import { Edit3, Eye, Power, Plus, Trash2, X } from "lucide-react";
import { useId, useRef, useState, type ReactElement } from "react";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { getCurrentBangkokDate } from "@/lib/routine/schedule";
import type { RoutineTaskStatusFilter } from "@/lib/validations/routine";

import {
    formatRoutineAssigneeSummary,
    formatRoutineScheduleSummary,
    formatRoutineUnitLabel,
    uniqueRoutineUnits,
} from "./labels";
import { RoutineDetailsDialog } from "./RoutineDetailsDialog";
import { RoutineTaskListSkeleton } from "./RoutineSkeletons";
import type { PaginatedTasksResponse, RoutineTask } from "./types";

interface RoutineTaskListProps {
    categories: readonly { id: number; name: string }[];
    categoryId: string;
    data: PaginatedTasksResponse | undefined;
    error: Error | undefined;
    isAdmin: boolean;
    isLoading: boolean;
    onCategoryChange: (value: string) => void;
    onCreate: () => void;
    onDelete: (task: RoutineTask) => Promise<void>;
    onEdit: (task: RoutineTask) => void;
    onPageChange: (page: number) => void;
    onRetry: () => void;
    onSearchChange: (value: string) => void;
    onStatusChange: (value: RoutineTaskStatusFilter | "") => void;
    onToggleActive: (task: RoutineTask) => Promise<void>;
    onUnitChange: (value: string) => void;
    pendingTaskId?: number | null;
    search: string;
    status: RoutineTaskStatusFilter | "";
    unitId: string;
    units: readonly { id: number; code: string; name: string }[];
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
    categories,
    categoryId,
    data,
    error,
    isAdmin,
    isLoading,
    onCategoryChange,
    onCreate,
    onDelete,
    onEdit,
    onPageChange,
    onRetry,
    onSearchChange,
    onStatusChange,
    onToggleActive,
    onUnitChange,
    pendingTaskId = null,
    search,
    status,
    unitId,
    units,
}: RoutineTaskListProps): ReactElement {
    const [deleteTask, setDeleteTask] = useState<RoutineTask | null>(null);
    const [detailsTask, setDetailsTask] = useState<RoutineTask | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const deleteLockRef = useRef(false);
    const filterId = useId();
    const today = getCurrentBangkokDate();
    const hasFilters = search.trim().length > 0
        || unitId.length > 0
        || categoryId.length > 0
        || status.length > 0;
    const taskUnits = uniqueRoutineUnits(units);
    const searchId = `${filterId}-search`;
    const unitIdField = `${filterId}-unit`;
    const categoryIdField = `${filterId}-category`;
    const statusId = `${filterId}-status`;
    const isInitialLoading = isLoading && !data;

    function openDetails(task: RoutineTask): void {
        setDetailsTask(task);
        setDetailsOpen(true);
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-brand-border/70 bg-transparent p-4 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_minmax(10rem,0.4fr)_minmax(10rem,0.4fr)_minmax(9rem,0.3fr)_auto] xl:items-end">
                <div className="grid min-w-0 gap-1 text-xs/5 font-semibold text-content-secondary sm:col-span-2 xl:col-span-1">
                    <label htmlFor={searchId}>ค้นหาแม่แบบงาน</label>
                    <div className="relative">
                        <Input
                            id={searchId}
                            type="search"
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            className="pr-12 sm:pr-10 [&::-webkit-search-cancel-button]:appearance-none"
                            placeholder="ชื่องาน หมวดหมู่ หรือหน่วยงาน"
                        />
                        {search.trim().length > 0 ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onSearchChange("")}
                                className="absolute right-1.5 top-1/2 size-11 -translate-y-1/2 rounded-md text-content-muted hover:bg-surface-muted hover:text-content-body sm:size-7"
                                aria-label="ล้างคำค้นหาแม่แบบงาน"
                            >
                                <X className="size-4" aria-hidden="true" />
                            </Button>
                        ) : null}
                    </div>
                </div>
                <label className="grid min-w-0 gap-1 text-xs/5 font-semibold text-content-secondary" htmlFor={unitIdField}>
                    หน่วยงาน
                    <select
                        id={unitIdField}
                        className="h-11 min-w-0 rounded-md border border-brand-border bg-surface-raised px-3 text-sm focus-visible:border-brand-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid/40"
                        value={unitId}
                        onChange={(event) => onUnitChange(event.target.value)}
                    >
                        <option value="">ทุกหน่วยงาน</option>
                        {taskUnits.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                                {formatRoutineUnitLabel(unit)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid min-w-0 gap-1 text-xs/5 font-semibold text-content-secondary" htmlFor={categoryIdField}>
                    หมวดหมู่งาน
                    <select
                        id={categoryIdField}
                        className="h-11 min-w-0 rounded-md border border-brand-border bg-surface-raised px-3 text-sm focus-visible:border-brand-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid/40"
                        value={categoryId}
                        onChange={(event) => onCategoryChange(event.target.value)}
                    >
                        <option value="">ทุกหมวดหมู่</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                    </select>
                </label>
                <label className="grid min-w-0 gap-1 text-xs/5 font-semibold text-content-secondary" htmlFor={statusId}>
                    สถานะ
                    <select
                        id={statusId}
                        className="h-11 min-w-0 rounded-md border border-brand-border bg-surface-raised px-3 text-sm focus-visible:border-brand-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid/40"
                        value={status}
                        onChange={(event) => {
                            const value = event.target.value;
                            if (value === "" || value === "active" || value === "inactive") {
                                onStatusChange(value);
                            }
                        }}
                    >
                        <option value="">ทั้งหมด</option>
                        <option value="active">ใช้งาน</option>
                        <option value="inactive">ปิดใช้งาน</option>
                    </select>
                </label>
                <Button type="button" size="sm" className="xl:justify-self-end" onClick={onCreate}>
                    <Plus aria-hidden="true" />
                    สร้างแม่แบบงาน
                </Button>
            </div>

            {isInitialLoading ? <RoutineTaskListSkeleton /> : null}
            {error ? <ErrorState compact action={{ label: "ลองใหม่", onClick: onRetry }} description={error.message} /> : null}
            {!isInitialLoading && !error && (!data || data.tasks.length === 0) ? (
                <EmptyState
                    compact
                    title={hasFilters ? "ไม่พบแม่แบบงานที่ตรงกับตัวกรอง" : "ยังไม่มีแม่แบบงานประจำ"}
                    description={hasFilters ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "สร้างแม่แบบงานเพื่อให้ระบบสร้างงานแต่ละรอบอัตโนมัติ"}
                />
            ) : null}

            {!error && data && data.tasks.length > 0 ? (
                <>
                    <div className="overflow-hidden rounded-xl border border-brand-border/70 bg-surface-raised lg:overflow-x-auto">
                        <table className="block w-full text-left text-sm lg:table lg:min-w-[900px]">
                            <thead className="hidden border-b border-brand-border/70 bg-brand-surface text-xs/5 font-semibold text-brand-strong lg:table-header-group">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">งาน</th>
                                    <th className="px-4 py-3 font-semibold">หน่วยงาน</th>
                                    <th className="px-4 py-3 font-semibold">กำหนดการ</th>
                                    <th className="px-4 py-3 font-semibold">ผู้รับผิดชอบ</th>
                                    <th className="px-4 py-3 font-semibold">สถานะ</th>
                                    <th className="sticky right-0 z-20 border-l border-brand-border/70 bg-brand-surface px-4 py-3">
                                        <span className="sr-only">การดำเนินการ</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="block divide-y divide-border-subtle lg:table-row-group">
                                {data.tasks.map((task) => (
                                    <tr key={task.id} className="block p-4 align-top lg:table-row lg:p-0">
                                        <td className="block pb-3 lg:table-cell lg:px-4 lg:py-4">
                                            <p className="break-words text-base font-semibold leading-6 tracking-tight text-content-heading [overflow-wrap:anywhere]">
                                                {task.title}
                                            </p>
                                            <p className="mt-1 break-words text-xs/5 text-content-muted [overflow-wrap:anywhere]">{task.category.name}</p>
                                        </td>
                                        <td className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-t border-border-subtle py-3 text-sm font-medium text-content-body lg:table-cell lg:border-0 lg:px-4 lg:py-4">
                                            <span className="text-xs/5 font-semibold text-content-muted lg:hidden">หน่วยงาน</span>
                                            <span className="min-w-0 break-words">{formatRoutineUnitLabel(task.unit)}</span>
                                        </td>
                                        <td className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-t border-border-subtle py-3 text-sm font-medium text-content-body lg:table-cell lg:max-w-64 lg:border-0 lg:px-4 lg:py-4">
                                            <span className="text-xs/5 font-semibold text-content-muted lg:hidden">กำหนดการ</span>
                                            <span className="min-w-0 break-words leading-6">{formatRoutineScheduleSummary(task)}</span>
                                        </td>
                                        <td className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-t border-border-subtle py-3 text-sm font-medium text-content-body lg:table-cell lg:max-w-56 lg:border-0 lg:px-4 lg:py-4">
                                            <span className="text-xs/5 font-semibold text-content-muted lg:hidden">ผู้รับผิดชอบ</span>
                                            <span className="min-w-0 break-words">{formatRoutineAssigneeSummary(task.assignees)}</span>
                                        </td>
                                        <td className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-t border-border-subtle py-3 text-sm font-medium text-content-body lg:table-cell lg:border-0 lg:px-4 lg:py-4">
                                            <span className="text-xs/5 font-semibold text-content-muted lg:hidden">สถานะ</span>
                                            <span className="min-w-0">
                                                <span className={task.isActive
                                                    ? "inline-flex items-center whitespace-nowrap rounded-full bg-status-success-surface px-2.5 py-1 text-xs/5 font-semibold text-status-success-foreground"
                                                    : "inline-flex items-center whitespace-nowrap rounded-full bg-surface-subtle px-2.5 py-1 text-xs/5 font-semibold text-content-secondary"}
                                                >
                                                    {task.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                                                </span>
                                                <span className="mt-2 flex flex-wrap gap-1">
                                                    {taskInformationBadges(task, today).map((badge) => (
                                                        <span key={badge} className="inline-flex items-center whitespace-nowrap rounded-full border border-status-warning-border bg-status-warning-surface px-2 py-1 text-xs font-medium text-status-warning-foreground">
                                                            {badge}
                                                        </span>
                                                    ))}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="block border-t border-border-subtle bg-surface-raised pt-3 lg:sticky lg:right-0 lg:z-10 lg:table-cell lg:whitespace-nowrap lg:border-l lg:px-4 lg:py-4 lg:text-right lg:[box-shadow:var(--employee-table-sticky-shadow)]">
                                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end" role="group" aria-label={`การดำเนินการสำหรับ ${task.title}`}>
                                                <Button type="button" variant="outline" size="sm" onClick={() => openDetails(task)}>
                                                    <Eye aria-hidden="true" />
                                                    ดูรายละเอียด
                                                </Button>
                                                {task.canEdit ? (
                                                    <Button type="button" variant="outline" size="sm" onClick={() => onEdit(task)} disabled={pendingTaskId === task.id}>
                                                        <Edit3 aria-hidden="true" />
                                                        แก้ไข
                                                    </Button>
                                                ) : null}
                                                {task.canDelete ? (
                                                    <>
                                                        <Button type="button" variant="outline" size="sm" disabled={pendingTaskId === task.id} onClick={() => void onToggleActive(task)}>
                                                            <Power aria-hidden="true" />
                                                            {pendingTaskId === task.id ? "กำลังบันทึก..." : task.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                                                        </Button>
                                                        <Button type="button" variant="ghost" size="sm" className="text-status-danger-foreground" disabled={pendingTaskId === task.id} onClick={() => setDeleteTask(task)}>
                                                            <Trash2 aria-hidden="true" />
                                                            ลบ
                                                        </Button>
                                                    </>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {data.pagination.pages > 1 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4 text-sm text-content-secondary">
                            <span>หน้า {data.pagination.page} จาก {data.pagination.pages}</span>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" size="sm" disabled={data.pagination.page <= 1} onClick={() => onPageChange(data.pagination.page - 1)}>ก่อนหน้า</Button>
                                <Button type="button" variant="outline" size="sm" disabled={data.pagination.page >= data.pagination.pages} onClick={() => onPageChange(data.pagination.page + 1)}>ถัดไป</Button>
                            </div>
                        </div>
                    ) : null}
                </>
            ) : null}

            <RoutineDetailsDialog
                task={detailsTask}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                isAdmin={isAdmin}
            />

            <AlertDialog
                open={deleteTask !== null}
                onOpenChange={(open) => {
                    if (!open && !isDeleting && !deleteLockRef.current) setDeleteTask(null);
                }}
            >
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
                        >
                            {isDeleting ? "กำลังลบ..." : "ลบรายการ"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
