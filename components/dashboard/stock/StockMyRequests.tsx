"use client";

import { ClipboardList } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { RequestStatusBadge } from "@/components/dashboard/shared/RequestStatusBadge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useStockDataContext, useStockUIContext } from "../context/stock";
import type { StockRequest } from "../context/stock/types";

const REQUESTS_PER_PAGE = 20;

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function RequestRow({ req }: { req: StockRequest }) {
    return (
        <TableRow className="hover:bg-blue-50/30 transition-colors border-b-gray-50/80">
            <TableCell className="font-medium text-slate-700">#{req.id}</TableCell>
            <TableCell className="text-slate-600 text-sm">{formatDate(req.createdAt)}</TableCell>
            <TableCell>
                <div className="space-y-1.5 py-1">
                    {req.items.map((ri) => (
                        <div key={ri.id} className="text-sm flex items-center gap-2">
                            <span className="font-medium text-slate-800">{ri.item.name}</span>
                            <span className="text-xs bg-slate-100/80 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                x {ri.quantity} {ri.item.unit}
                            </span>
                        </div>
                    ))}
                </div>
            </TableCell>
            <TableCell>
                <RequestStatusBadge status={req.status} />
            </TableCell>
            <TableCell className="text-sm text-slate-500">
                {req.status === "REJECTED" && req.rejectReason ? (
                    <span className="text-rose-600/90">{req.rejectReason}</span>
                ) : (
                    "-"
                )}
            </TableCell>
        </TableRow>
    );
}

export function StockMyRequests() {
    const { requests, isLoading, totalRequests } = useStockDataContext();
    const { requestsPage, setRequestsPage, statusFilter, setStatusFilter } =
        useStockUIContext();
    const totalPages = Math.max(1, Math.ceil(totalRequests / REQUESTS_PER_PAGE));

    if (isLoading) {
        return <div className="py-12 text-center text-gray-500">กำลังโหลด...</div>;
    }

    if (requests.length === 0) {
        return (
            <div className="py-12 text-center text-gray-500">
                <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p>ยังไม่มีประวัติการเบิก</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <div className="w-full sm:w-56">
                    <Select
                        value={statusFilter ?? "all"}
                        onValueChange={(value) =>
                            setStatusFilter(
                                value === "all"
                                    ? undefined
                                    : (value as
                                          | "PENDING"
                                          | "APPROVED"
                                          | "REJECTED"
                                          | "CANCELLED"),
                            )
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="กรองสถานะ" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">ทั้งหมด</SelectItem>
                            <SelectItem value="PENDING">รออนุมัติ</SelectItem>
                            <SelectItem value="APPROVED">อนุมัติแล้ว</SelectItem>
                            <SelectItem value="REJECTED">ปฏิเสธ</SelectItem>
                            <SelectItem value="CANCELLED">ยกเลิก</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b-gray-100">
                            <TableHead className="w-20 font-semibold text-slate-600">เลขที่</TableHead>
                            <TableHead className="w-40 font-semibold text-slate-600">วันที่</TableHead>
                            <TableHead className="font-semibold text-slate-600">รายการ</TableHead>
                            <TableHead className="w-32 font-semibold text-slate-600">สถานะ</TableHead>
                            <TableHead className="font-semibold text-slate-600">หมายเหตุ</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((req) => (
                            <RequestRow key={req.id} req={req} />
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Pagination
                currentPage={requestsPage}
                totalPages={totalPages}
                itemsPerPage={REQUESTS_PER_PAGE}
                onPageChange={setRequestsPage}
                onPreviousPage={() =>
                    setRequestsPage(Math.max(1, requestsPage - 1))
                }
                onNextPage={() =>
                    setRequestsPage(Math.min(totalPages, requestsPage + 1))
                }
            />
        </div>
    );
}
