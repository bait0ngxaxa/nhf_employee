"use client";

import { type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Search, RefreshCw } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { useAuditLogsContext } from "@/components/dashboard/context/audit-logs/AuditLogsContext";
import type { AuditLog } from "@/components/dashboard/context/audit-logs/types";
import {
    AUDIT_ACTION_FILTER_OPTIONS,
    AUDIT_ENTITY_TYPE_OPTIONS,
} from "@/constants/audit";
import {
    formatAuditLogDisplay,
    type AuditLogDisplay,
} from "@/lib/audit-log/display";
import { formatThaiDateTime } from "@/lib/helpers/date-helpers";
import { AuditActionBadge } from "./AuditActionBadge";

interface AuditLogViewerProps {
    className?: string;
}

interface AuditLogMobileCardProps {
    log: AuditLog;
    display: AuditLogDisplay;
}

function AuditLogMobileCard({
    log,
    display,
}: AuditLogMobileCardProps): ReactElement {
    return (
        <article className="space-y-4 rounded-xl border border-border-neutral-default bg-surface-raised p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <AuditActionBadge
                    action={log.action}
                    className="max-w-full"
                />
                <time
                    dateTime={log.createdAt}
                    className="text-xs font-medium text-content-neutral-secondary"
                >
                    {formatThaiDateTime(log.createdAt)}
                </time>
            </div>
            <p className="text-sm leading-6 text-content-neutral-strong [overflow-wrap:anywhere]">
                {display.summary}
            </p>
            <dl className="grid gap-3 border-t border-border-neutral-muted pt-3 sm:grid-cols-2">
                <div className="min-w-0">
                    <dt className="text-xs font-semibold text-content-neutral-muted">
                        ผู้ดำเนินการ
                    </dt>
                    <dd className="mt-1 min-w-0 text-sm text-content-neutral-primary [overflow-wrap:anywhere]">
                        <span className="font-medium">
                            {log.user?.name || "-"}
                        </span>
                        <span className="mt-0.5 block text-xs text-content-neutral-secondary [overflow-wrap:anywhere]">
                            {log.userEmail || "-"}
                        </span>
                    </dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-xs font-semibold text-content-neutral-muted">
                        ข้อมูลที่เกี่ยวข้อง
                    </dt>
                    <dd className="mt-1 text-sm text-content-neutral-strong [overflow-wrap:anywhere]">
                        {display.entityReference}
                    </dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                    <dt className="text-xs font-semibold text-content-neutral-muted">
                        IP Address
                    </dt>
                    <dd className="mt-1 text-sm text-content-neutral-secondary [overflow-wrap:anywhere]">
                        {log.ipAddress || "-"}
                    </dd>
                </div>
            </dl>
        </article>
    );
}


export function AuditLogViewer({ className }: AuditLogViewerProps) {
    const {
        filteredLogs,
        isLoading,
        error,
        currentPage,
        setCurrentPage,
        totalPages,
        actionFilter,
        setActionFilter,
        entityTypeFilter,
        setEntityTypeFilter,
        searchTerm,
        setSearchTerm,
        refresh,
        handlePreviousPage,
        handleNextPage,
    } = useAuditLogsContext();

    const isInitialLoading =
        isLoading
        && filteredLogs.length === 0
        && currentPage === 1
        && actionFilter === "all"
        && entityTypeFilter === "all"
        && searchTerm.trim().length === 0;

    if (isInitialLoading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-10 w-24" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 animate-pulse">
                    {/* Filters Skeleton */}
                    <div className="flex flex-wrap gap-3">
                        <Skeleton className="h-10 flex-1 min-w-[200px]" />
                        <Skeleton className="h-10 w-44" />
                        <Skeleton className="h-10 w-36" />
                    </div>
                    
                    {/* Table Skeleton */}
                    <div className="space-y-3 xl:hidden">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={index}
                                className="space-y-3 rounded-xl border border-border-neutral-muted p-4"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <Skeleton className="h-6 w-32" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <Skeleton className="h-5 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        ))}
                    </div>
                    <div className="hidden overflow-x-auto rounded-lg border p-4 xl:block">
                        <div className="flex gap-4 border-b border-border-neutral-muted pb-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-4 flex-1" />
                            ))}
                        </div>
                        <div className="space-y-4 pt-4">
                            {Array.from({ length: 6 }).map((_, rowIndex) => (
                                <div key={rowIndex} className="flex items-center gap-4">
                                    {Array.from({ length: 5 }).map((_, colIndex) => (
                                        <Skeleton
                                            key={colIndex}
                                            className="h-8 flex-1"
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <div className="text-center p-8">
                <div className="text-red-600 bg-red-50 p-4 rounded-md">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="[overflow-wrap:anywhere]">บันทึกการใช้งาน (Audit Logs)</CardTitle>
                        <CardDescription>
                            ประวัติการดำเนินการในระบบ
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        className="flex w-full items-center gap-2 sm:w-auto"
                    >
                        <RefreshCw className="h-4 w-4" />
                        รีเฟรช
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-neutral-subtle h-4 w-4" />
                        <Input
                            id="audit-search"
                            type="text"
                            aria-label="ค้นหาในบันทึกการใช้งาน"
                            placeholder="ค้นหาผู้ใช้, อีเมล…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select
                        value={actionFilter}
                        onValueChange={setActionFilter}
                    >
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="ประเภทการดำเนินการ" />
                        </SelectTrigger>
                        <SelectContent>
                            {AUDIT_ACTION_FILTER_OPTIONS.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={entityTypeFilter}
                        onValueChange={setEntityTypeFilter}
                    >
                        <SelectTrigger className="w-full sm:w-[150px]">
                            <SelectValue placeholder="ประเภทข้อมูล" />
                        </SelectTrigger>
                        <SelectContent>
                            {AUDIT_ENTITY_TYPE_OPTIONS.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Mobile list */}
                <div className="space-y-3 xl:hidden">
                    {isLoading && filteredLogs.length === 0 ? (
                        <div className="rounded-xl border border-border-neutral-muted px-4 py-8 text-center text-sm text-content-neutral-muted">
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="rounded-xl border border-border-neutral-muted px-4 py-8 text-center text-sm text-content-neutral-muted">
                            ไม่พบข้อมูล
                        </div>
                    ) : (
                        filteredLogs.map((log) => (
                            <AuditLogMobileCard
                                key={log.id}
                                log={log}
                                display={formatAuditLogDisplay(log)}
                            />
                        ))
                    )}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-x-auto rounded-lg border xl:block">
                    <table className="min-w-full divide-y divide-border-neutral-default">
                        <thead className="bg-surface-neutral-subtle">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-content-neutral-muted uppercase">
                                    เวลา
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-content-neutral-muted uppercase">
                                    เหตุการณ์
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-content-neutral-muted uppercase">
                                    ผู้ดำเนินการ
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-content-neutral-muted uppercase">
                                    ข้อมูลที่เกี่ยวข้อง
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-content-neutral-muted uppercase">
                                    IP Address
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-surface-raised divide-y divide-border-neutral-default">
                            {isLoading && filteredLogs.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-8 text-center text-content-neutral-muted"
                                    >
                                        กำลังโหลดข้อมูล...
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-8 text-center text-content-neutral-muted"
                                    >
                                        ไม่พบข้อมูล
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => {
                                    const display = formatAuditLogDisplay(log);

                                    return (
                                        <tr
                                            key={log.id}
                                            className="hover:bg-surface-neutral-subtle"
                                        >
                                            <td className="px-4 py-3 text-sm text-content-neutral-secondary whitespace-nowrap align-top">
                                                {formatThaiDateTime(log.createdAt)}
                                            </td>
                                            <td className="px-4 py-3 align-top min-w-[320px]">
                                                <div className="flex flex-col gap-2">
                                                    <AuditActionBadge
                                                        action={log.action}
                                                        className="w-fit"
                                                    />
                                                    <p className="max-w-[64ch] text-sm leading-6 text-content-neutral-strong">
                                                        {display.summary}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm align-top">
                                                <div className="font-medium text-content-neutral-primary">
                                                    {log.user?.name || "-"}
                                                </div>
                                                <div className="text-content-neutral-secondary text-xs">
                                                    {log.userEmail || "-"}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm align-top">
                                                <span className="text-content-neutral-strong">
                                                    {display.entityReference}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-content-neutral-secondary align-top">
                                                {log.ipAddress || "-"}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        itemsPerPage={15}
                        onPageChange={setCurrentPage}
                        onPreviousPage={handlePreviousPage}
                        onNextPage={handleNextPage}
                    />
                )}
            </CardContent>
        </Card>
    );
}
