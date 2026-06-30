"use client";

import type { ReactElement } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    ChevronLeft,
    ChevronRight,
    CheckCircle,
    AlertCircle,
    History,
    RefreshCw,
} from "lucide-react";
import { useEmailRequestHistory } from "@/hooks/useEmailRequestHistory";
import { formatThaiDateTime } from "@/lib/helpers/date-helpers";
import { useAuth } from "@/components/auth/HybridAuthProvider";

function formatSharedDriveAccess(
    sharedDriveAccess: readonly string[] | null | undefined,
): string {
    if (!sharedDriveAccess || sharedDriveAccess.length === 0) {
        return "ไม่ได้ระบุ";
    }

    return sharedDriveAccess.join(", ");
}

export function EmailRequestHistory(): ReactElement | null {
    const { user } = useAuth();
    const {
        emailRequests,
        pagination,
        isLoading,
        error,
        currentPage,
        setCurrentPage,
        refresh,
    } = useEmailRequestHistory();

    if (!user) {
        return null;
    }

    const refreshIconClassName = isLoading
        ? "mr-2 h-4 w-4 animate-spin"
        : "mr-2 h-4 w-4";

    return (
        <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-xl bg-primary/10 p-2">
                            <History className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <CardTitle className="text-xl [overflow-wrap:anywhere]">
                                ประวัติคำร้องพนักงานใหม่
                            </CardTitle>
                            <p className="text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                                รายการคำร้องพนักงานใหม่ที่เคยส่งไปแล้ว
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        disabled={isLoading}
                        aria-label="รีเฟรชประวัติคำร้องพนักงานใหม่"
                        className="h-10 shrink-0"
                    >
                        <RefreshCw className={refreshIconClassName} />
                        รีเฟรช
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div
                        className="space-y-4 py-6"
                        role="status"
                        aria-busy="true"
                        aria-label="กำลังโหลดประวัติคำร้องพนักงานใหม่"
                    >
                        <div className="flex gap-4 border-b border-border pb-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-4 flex-1" />
                            ))}
                        </div>
                        <div className="space-y-4">
                            {Array.from({ length: 4 }).map((_, rowIndex) => (
                                <div key={rowIndex} className="flex items-center gap-4">
                                    {Array.from({ length: 5 }).map((_, colIndex) => (
                                        <Skeleton
                                            key={colIndex}
                                            className="h-12 flex-1"
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-red-700">
                        <AlertCircle className="h-6 w-6 text-red-600" />
                        <p className="max-w-xl text-sm leading-6 [overflow-wrap:anywhere]">
                            {error}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            className="border-red-200 bg-white text-red-700 hover:bg-red-50"
                            onClick={refresh}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            โหลดใหม่
                        </Button>
                    </div>
                ) : emailRequests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm leading-6 text-muted-foreground">
                        ยังไม่มีรายการคำร้อง เมื่อส่งคำร้องแล้วรายการจะแสดงที่นี่
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto rounded-xl border border-border">
                            <Table className="min-w-[980px]">
                                <TableHeader>
                                    <TableRow className="bg-muted/60">
                                        <TableHead className="font-semibold">
                                            ชื่อ-นามสกุล
                                        </TableHead>
                                        <TableHead className="font-semibold">
                                            ตำแหน่ง
                                        </TableHead>
                                        <TableHead className="font-semibold">
                                            สังกัด
                                        </TableHead>
                                        <TableHead className="font-semibold">
                                            สิทธิ์ระบบ
                                        </TableHead>
                                        <TableHead className="font-semibold">
                                            วันที่ขอ
                                        </TableHead>
                                        <TableHead className="font-semibold">
                                            สถานะ
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {emailRequests.map((request) => (
                                        <TableRow
                                            key={request.id}
                                            className="hover:bg-muted/40"
                                        >
                                            <TableCell className="max-w-56 align-top">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-foreground [overflow-wrap:anywhere]">
                                                        {request.thaiName}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                                                        {request.englishName}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-56 align-top [overflow-wrap:anywhere]">
                                                {request.position}
                                            </TableCell>
                                            <TableCell className="max-w-56 align-top [overflow-wrap:anywhere]">
                                                {request.department}
                                            </TableCell>
                                            <TableCell className="max-w-72 align-top">
                                                <div className="space-y-2">
                                                    <Badge
                                                        className={
                                                            request.needsDocumentSystem
                                                                ? "w-fit border-transparent bg-primary/10 text-primary hover:bg-primary/10"
                                                                : "w-fit bg-secondary text-secondary-foreground hover:bg-secondary"
                                                        }
                                                    >
                                                        สารบรรณ:{" "}
                                                        {request.needsDocumentSystem
                                                            ? "ต้องการ"
                                                            : "ไม่ต้องการ"}
                                                    </Badge>
                                                    <p
                                                        className="text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]"
                                                        title={formatSharedDriveAccess(
                                                            request.sharedDriveAccess,
                                                        )}
                                                    >
                                                        Shared Drive:{" "}
                                                        {formatSharedDriveAccess(
                                                            request.sharedDriveAccess,
                                                        )}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm align-top whitespace-nowrap">
                                                {formatThaiDateTime(request.createdAt)}
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <Badge className="flex w-fit items-center gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                                                    <CheckCircle className="h-3 w-3" />
                                                    เสร็จสิ้น
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {pagination.totalPages > 1 && (
                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    แสดง {emailRequests.length.toLocaleString("th-TH")} จาก{" "}
                                    {pagination.total.toLocaleString("th-TH")} รายการ
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage(currentPage - 1)
                                        }
                                        disabled={currentPage <= 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        ก่อนหน้า
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        หน้า {currentPage.toLocaleString("th-TH")} /{" "}
                                        {pagination.totalPages.toLocaleString("th-TH")}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage(currentPage + 1)
                                        }
                                        disabled={
                                            currentPage >= pagination.totalPages
                                        }
                                    >
                                        ถัดไป
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
