"use client";

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

export function EmailRequestHistory() {
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

    return (
        <Card className="rounded-2xl border-gray-200 bg-white shadow-sm">
            <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-xl bg-indigo-100 p-2">
                            <History className="h-5 w-5 text-indigo-700" />
                        </div>
                        <div className="min-w-0">
                            <CardTitle className="text-xl [overflow-wrap:anywhere]">
                                ประวัติคำขออีเมล
                            </CardTitle>
                            <p className="text-sm leading-6 text-gray-600 [overflow-wrap:anywhere]">
                                รายการคำขออีเมลที่เคยส่งไปแล้ว
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        disabled={isLoading}
                        className="h-10 shrink-0"
                    >
                        <RefreshCw className={isLoading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
                        รีเฟรช
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div className="space-y-4 py-6" aria-busy="true">
                        <div className="flex gap-4 border-b border-gray-100 pb-4">
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
                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center text-sm leading-6 text-gray-600">
                        ยังไม่มีรายการคำขออีเมล เมื่อส่งคำขอแล้วรายการจะแสดงที่นี่
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <Table className="min-w-[760px]">
                                <TableHeader>
                                    <TableRow className="bg-gray-50">
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
                                            className="hover:bg-gray-50"
                                        >
                                            <TableCell className="max-w-56 align-top">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 [overflow-wrap:anywhere]">
                                                        {request.thaiName}
                                                    </p>
                                                    <p className="text-sm text-gray-600 [overflow-wrap:anywhere]">
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
                                <p className="text-sm text-gray-600">
                                    แสดง {emailRequests.length.toLocaleString("th-TH")} จาก{" "}
                                    {pagination.total.toLocaleString("th-TH")} รายการ
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
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
                                    <span className="text-sm text-gray-600">
                                        หน้า {currentPage.toLocaleString("th-TH")} /{" "}
                                        {pagination.totalPages.toLocaleString("th-TH")}
                                    </span>
                                    <Button
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
