"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface AuditLog {
    id: number;
    action: string;
    entityType: string;
    entityId: number | null;
    userId: number | null;
    userEmail: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    details: Record<string, unknown> | null;
    createdAt: string;
    user: {
        id: number;
        name: string;
        email: string;
    } | null;
}

interface AuditLogViewerProps {
    className?: string;
}

const ACTION_LABELS: Record<string, string> = {
    LOGIN_SUCCESS: "เข้าสู่ระบบสำเร็จ",
    LOGIN_FAILED: "เข้าสู่ระบบล้มเหลว",
    LOGOUT: "ออกจากระบบ",
    PASSWORD_CHANGE: "เปลี่ยนรหัสผ่าน",
    PASSWORD_RESET: "รีเซ็ตรหัสผ่าน",
    EMPLOYEE_CREATE: "สร้างพนักงาน",
    EMPLOYEE_UPDATE: "แก้ไขพนักงาน",
    EMPLOYEE_DELETE: "ลบพนักงาน",
    EMPLOYEE_STATUS_CHANGE: "เปลี่ยนสถานะพนักงาน",
    EMPLOYEE_IMPORT: "นำเข้าพนักงาน",
    TICKET_CREATE: "สร้าง Ticket",
    TICKET_UPDATE: "แก้ไข Ticket",
    TICKET_STATUS_CHANGE: "เปลี่ยนสถานะ Ticket",
    TICKET_ASSIGN: "มอบหมาย Ticket",
    TICKET_COMMENT: "คอมเมนต์ Ticket",
    USER_CREATE: "สร้างผู้ใช้",
    USER_UPDATE: "แก้ไขผู้ใช้",
    USER_DELETE: "ลบผู้ใช้",
    USER_ROLE_CHANGE: "เปลี่ยนสิทธิ์ผู้ใช้",
    SETTINGS_UPDATE: "อัปเดตการตั้งค่า",
    DATA_EXPORT: "ส่งออกข้อมูล",
    EMAIL_REQUEST: "ขออีเมลพนักงานใหม่",
};

const getActionBadgeColor = (action: string): string => {
    if (action.includes("DELETE")) return "bg-red-100 text-red-700";
    if (action.includes("CREATE")) return "bg-green-100 text-green-700";
    if (action.includes("UPDATE") || action.includes("CHANGE"))
        return "bg-blue-100 text-blue-700";
    if (action.includes("LOGIN_SUCCESS"))
        return "bg-emerald-100 text-emerald-700";
    if (action.includes("LOGIN_FAILED")) return "bg-orange-100 text-orange-700";
    return "bg-gray-100 text-gray-700";
};

export function AuditLogViewer({ className }: AuditLogViewerProps) {
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [actionFilter, setActionFilter] = useState<string>("all");
    const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    const fetchAuditLogs = useCallback(async () => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams();
            params.set("page", currentPage.toString());
            params.set("limit", "15");

            if (actionFilter !== "all") {
                params.set("action", actionFilter);
            }
            if (entityTypeFilter !== "all") {
                params.set("entityType", entityTypeFilter);
            }

            const response = await fetch(
                `/api/audit-logs?${params.toString()}`
            );

            if (response.ok) {
                const data = await response.json();
                setAuditLogs(data.auditLogs);
                setTotalPages(data.pagination.pages);
                setError("");
            } else {
                const errorData = await response.json();
                setError(errorData.error || "เกิดข้อผิดพลาด");
            }
        } catch (err) {
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
            console.error("Error fetching audit logs:", err);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, actionFilter, entityTypeFilter]);

    useEffect(() => {
        fetchAuditLogs();
    }, [fetchAuditLogs]);

    const filteredLogs = auditLogs.filter((log) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            log.userEmail?.toLowerCase().includes(searchLower) ||
            log.user?.name.toLowerCase().includes(searchLower) ||
            log.action.toLowerCase().includes(searchLower) ||
            log.entityType.toLowerCase().includes(searchLower)
        );
    });

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleString("th-TH", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">กำลังโหลด...</span>
            </div>
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
                        onClick={fetchAuditLogs}
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
                            type="text"
                            placeholder="ค้นหาผู้ใช้, อีเมล..."
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
                            <SelectItem value="all">ทั้งหมด</SelectItem>
                            <SelectItem value="LOGIN_SUCCESS">
                                เข้าสู่ระบบสำเร็จ
                            </SelectItem>
                            <SelectItem value="LOGIN_FAILED">
                                เข้าสู่ระบบล้มเหลว
                            </SelectItem>
                            <SelectItem value="EMPLOYEE_CREATE">
                                สร้างพนักงาน
                            </SelectItem>
                            <SelectItem value="EMPLOYEE_UPDATE">
                                แก้ไขพนักงาน
                            </SelectItem>
                            <SelectItem value="EMPLOYEE_DELETE">
                                ลบพนักงาน
                            </SelectItem>
                            <SelectItem value="TICKET_CREATE">
                                สร้าง Ticket
                            </SelectItem>
                            <SelectItem value="USER_CREATE">
                                สร้างผู้ใช้
                            </SelectItem>
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
                            <SelectItem value="all">ทั้งหมด</SelectItem>
                            <SelectItem value="User">User</SelectItem>
                            <SelectItem value="Employee">Employee</SelectItem>
                            <SelectItem value="Ticket">Ticket</SelectItem>
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
                                            {formatDate(log.createdAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge
                                                className={getActionBadgeColor(
                                                    log.action
                                                )}
                                            >
                                                {ACTION_LABELS[log.action] ||
                                                    log.action}
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
                        onPreviousPage={() =>
                            setCurrentPage((p) => Math.max(p - 1, 1))
                        }
                        onNextPage={() =>
                            setCurrentPage((p) => Math.min(p + 1, totalPages))
                        }
                    />
                )}
            </CardContent>
        </Card>
    );
}
