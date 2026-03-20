"use client";

import { Badge } from "@/components/ui/badge";
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
import {
    AUDIT_ACTION_LABELS,
    AUDIT_ACTION_FILTER_OPTIONS,
    AUDIT_ENTITY_TYPE_OPTIONS,
    getAuditActionBadgeColor,
} from "@/constants/audit";
import { formatThaiDateTime } from "@/lib/helpers/date-helpers";

interface AuditLogViewerProps {
    className?: string;
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

    if (isLoading) {
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
                    <div className="overflow-x-auto border rounded-lg p-4">
                        <div className="flex gap-4 pb-4 border-b border-gray-100">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-4 flex-1" />
                            ))}
                        </div>
                        <div className="space-y-4 pt-4">
                            {Array.from({ length: 6 }).map((_, rowIndex) => (
                                <div key={rowIndex} className="flex gap-4 items-center">
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
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>บันทึกการใช้งาน (Audit Logs)</CardTitle>
                        <CardDescription>
                            ประวัติการดำเนินการในระบบ
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        รีเฟรช
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
                        <SelectTrigger className="w-[180px]">
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
                        <SelectTrigger className="w-[150px]">
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

                {/* Table */}
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    เวลา
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    การดำเนินการ
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    ผู้ใช้
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    ประเภทข้อมูล
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    IP Address
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-8 text-center text-gray-500"
                                    >
                                        ไม่พบข้อมูล
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr
                                        key={log.id}
                                        className="hover:bg-gray-50"
                                    >
                                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                            {formatThaiDateTime(log.createdAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge
                                                className={getAuditActionBadgeColor(
                                                    log.action,
                                                )}
                                            >
                                                {AUDIT_ACTION_LABELS[
                                                    log.action
                                                ] || log.action}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="font-medium text-gray-900">
                                                {log.user?.name || "-"}
                                            </div>
                                            <div className="text-gray-500 text-xs">
                                                {log.userEmail || "-"}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className="text-gray-700">
                                                {log.entityType}
                                            </span>
                                            {log.entityId && (
                                                <span className="text-gray-400 ml-1">
                                                    #{log.entityId}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {log.ipAddress || "-"}
                                        </td>
                                    </tr>
                                ))
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
