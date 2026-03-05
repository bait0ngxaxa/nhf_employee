"use client";

import { useSession } from "next-auth/react";
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
    History,
} from "lucide-react";
import { useEmailRequestHistory } from "@/hooks/useEmailRequestHistory";

export function EmailRequestHistory() {
    const { data: session } = useSession();
    const {
        emailRequests,
        pagination,
        isLoading,
        error,
        currentPage,
        setCurrentPage,
    } = useEmailRequestHistory();

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (!session) {
        return null;
    }

    return (
        <Card className="bg-white/80 backdrop-blur-xl border-gray-200/50 shadow-xl rounded-3xl">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl">
                        <History className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">
                            ประวัติคำขออีเมล
                        </CardTitle>
                        <p className="text-sm text-gray-500">
                            รายการคำขออีเมลที่เคยส่งไปแล้ว
                        </p>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div className="space-y-4 py-6 animate-pulse">
                        {/* Table Header Skeleton */}
                        <div className="flex gap-4 pb-4 border-b border-gray-100">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-4 flex-1" />
                            ))}
                        </div>
                        {/* Table Rows Skeleton */}
                        <div className="space-y-4">
                            {Array.from({ length: 4 }).map((_, rowIndex) => (
                                <div key={rowIndex} className="flex gap-4 items-center">
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
                    <div className="text-center py-12 text-red-600">
                        {error}
                    </div>
                ) : emailRequests.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        ยังไม่มีรายการคำขออีเมล
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <Table>
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
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">
                                                        {request.thaiName}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        {request.englishName}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {request.position}
                                            </TableCell>
                                            <TableCell>
                                                {request.department}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {formatDate(request.createdAt)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                                                    <CheckCircle className="h-3 w-3" />
                                                    เสร็จสิ้น
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4">
                                <p className="text-sm text-gray-500">
                                    แสดง {emailRequests.length} จาก{" "}
                                    {pagination.total} รายการ
                                </p>
                                <div className="flex items-center gap-2">
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
                                        หน้า {currentPage} /{" "}
                                        {pagination.totalPages}
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
