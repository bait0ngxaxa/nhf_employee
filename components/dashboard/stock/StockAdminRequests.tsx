"use client";

import { useState } from "react";
import { type StockRequestStatus } from "@prisma/client";
import { CheckCircle, ClipboardList, Loader2, Search, X, XCircle } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { RequestStatusBadge } from "@/components/dashboard/shared/RequestStatusBadge";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useStockDataContext, useStockUIContext } from "../context/stock";
import { STOCK_REQUESTS_LIMIT as REQUESTS_PER_PAGE } from "../context/stock/provider.shared";
import type { StockRequest } from "../context/stock/types";
import {
    formatStockRequestDate,
    REQUEST_STATUS_OPTIONS,
} from "./stockRequest.shared";
import { getRequestItemDisplayName } from "./stockVariant.shared";
import { useStockRequestActions } from "./useStockRequestActions";

export function StockAdminRequests() {
    const { requests, isLoading, refreshRequests, refreshItems, totalRequests } =
        useStockDataContext();
    const {
        requestsPage,
        setRequestsPage,
        statusFilter,
        setStatusFilter,
        requestSearchQuery,
        setRequestSearchQuery,
    } = useStockUIContext();
    const [cancelTarget, setCancelTarget] = useState<StockRequest | null>(null);
    const { processingRequestId, runCancelRequest, runIssueRequest } =
        useStockRequestActions({
            onIssueSuccess: () => {
                refreshRequests();
                refreshItems();
            },
            onCancelSuccess: refreshRequests,
            onCancelSettled: () => setCancelTarget(null),
        });
    const totalPages = Math.max(1, Math.ceil(totalRequests / REQUESTS_PER_PAGE));
    const hasActiveFilters =
        statusFilter !== undefined || requestSearchQuery.trim().length > 0;

    async function handleIssue(requestId: number): Promise<void> {
        await runIssueRequest(requestId);
    }

    async function handleCancel(requestId: number, reason: string): Promise<void> {
        await runCancelRequest(requestId, reason);
    }

    return (
        <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_48px_-32px_rgba(15,23,42,0.22)] backdrop-blur">
                <div className="mb-3 flex items-center justify-between px-1">
                    <div>
                        <div className="text-sm font-semibold text-slate-800">
                            ค้นหาและกรองคำขอเบิก
                        </div>
                        <div className="text-xs text-slate-500">
                            ค้นหาจากเลขที่คำขอ รหัสโครงการ ชื่อผู้ขอ อีเมล หรือชื่อรายการที่ขอเบิก
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={requestSearchQuery}
                            onChange={(event) => setRequestSearchQuery(event.target.value)}
                            placeholder="ค้นหาเลขที่คำขอ รหัสโครงการ ชื่อ อีเมล หรือรายการ"
                            className="h-12 rounded-2xl border-slate-200 bg-slate-50/80 pl-11 pr-11 shadow-inner shadow-slate-200/50 focus-visible:border-orange-300 focus-visible:ring-orange-200"
                        />
                        {requestSearchQuery.trim().length > 0 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setRequestSearchQuery("")}
                                className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="w-full sm:w-56">
                        <Select
                            value={statusFilter ?? "all"}
                            onValueChange={(value) =>
                                setStatusFilter(
                                    value === "all"
                                        ? undefined
                                        : (value as StockRequestStatus),
                                )
                            }
                        >
                            <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50/80 shadow-inner shadow-slate-200/50">
                                <SelectValue placeholder="กรองสถานะ" />
                            </SelectTrigger>
                            <SelectContent>
                                {REQUEST_STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="py-12 text-center text-gray-500">กำลังโหลด...</div>
            ) : requests.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                    <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-50" />
                    <p>
                        {hasActiveFilters
                            ? "ไม่พบคำขอเบิกที่ตรงกับเงื่อนไขค้นหา"
                            : "ไม่มีคำขอเบิกวัสดุ"}
                    </p>
                </div>
            ) : (
                <>
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                        <Table className="border-separate border-spacing-0">
                            <TableHeader>
                                <TableRow className="border-b-2 border-slate-200 bg-slate-100/80 hover:bg-slate-100/80">
                                    <TableHead className="w-16 border-r border-slate-200 font-semibold text-slate-700">
                                        เลขที่
                                    </TableHead>
                                    <TableHead className="w-40 border-r border-slate-200 font-semibold text-slate-700">
                                        วันที่
                                    </TableHead>
                                    <TableHead className="w-40 border-r border-slate-200 font-semibold text-slate-700">
                                        รหัสโครงการ
                                    </TableHead>
                                    <TableHead className="border-r border-slate-200 font-semibold text-slate-700">
                                        ผู้เบิก
                                    </TableHead>
                                    <TableHead className="border-r border-slate-200 font-semibold text-slate-700">
                                        รายการ
                                    </TableHead>
                                    <TableHead className="w-32 border-r border-slate-200 font-semibold text-slate-700">
                                        สถานะ
                                    </TableHead>
                                    <TableHead className="w-52" />
                                </TableRow>
                            </TableHeader>
                            <TableBody className="[&_tr:nth-child(odd)]:bg-white [&_tr:nth-child(even)]:bg-slate-100/70">
                                {requests.map((req) => {
                                    const isPendingIssue =
                                        req.status === "PENDING_ISSUE";

                                    return (
                                        <TableRow
                                            key={req.id}
                                            className="border-b-2 border-slate-300 transition-colors hover:bg-blue-100/70"
                                        >
                                            <TableCell className="border-r border-slate-300 py-4 font-medium text-slate-800">
                                                #{req.id}
                                            </TableCell>
                                            <TableCell className="border-r border-slate-300 py-4 text-sm text-slate-700">
                                                {formatStockRequestDate(req.createdAt)}
                                            </TableCell>
                                            <TableCell className="border-r border-slate-300 py-4 text-sm font-medium text-slate-700">
                                                {req.projectCode}
                                            </TableCell>
                                            <TableCell className="border-r border-slate-300 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {req.requester.name}
                                                    </span>
                                                    <span className="text-xs font-medium text-slate-400">
                                                        {req.requester.email}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="border-r border-slate-300 py-4">
                                                <div className="space-y-1.5 py-1">
                                                    {req.items.map((ri) => (
                                                        <div
                                                            key={ri.id}
                                                            className="flex items-center gap-2 text-sm"
                                                        >
                                                            <span className="font-medium text-slate-800">
                                                                {getRequestItemDisplayName(ri)}
                                                            </span>
                                                            <span className="rounded-full bg-slate-100/80 px-2 py-0.5 text-xs font-medium text-slate-600">
                                                                x {ri.quantity} {ri.item.unit}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="border-r border-slate-300 py-4">
                                                <RequestStatusBadge status={req.status} />
                                            </TableCell>
                                            <TableCell className="py-4">
                                                {isPendingIssue && (
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            className="bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md"
                                                            disabled={processingRequestId === req.id}
                                                            onClick={() =>
                                                                void handleIssue(req.id)
                                                            }
                                                        >
                                                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                                            จ่ายแล้ว
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-rose-200 text-rose-600 shadow-sm transition-all hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                                                            disabled={processingRequestId === req.id}
                                                            onClick={() => setCancelTarget(req)}
                                                        >
                                                            <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                                            ยกเลิก
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
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
                </>
            )}

            <CancelDialog
                request={cancelTarget}
                onClose={() => setCancelTarget(null)}
                onCancel={handleCancel}
                loading={processingRequestId !== null}
            />
        </div>
    );
}

interface CancelDialogProps {
    request: StockRequest | null;
    onClose: () => void;
    onCancel: (id: number, reason: string) => void;
    loading: boolean;
}

function CancelDialog({
    request,
    onClose,
    onCancel,
    loading,
}: CancelDialogProps) {
    const [reason, setReason] = useState("");

    if (!request) return null;

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="overflow-hidden p-0 sm:max-w-[400px]">
                <div className="border-b border-rose-100 bg-rose-50/50 px-6 py-4">
                    <DialogTitle className="text-lg font-semibold text-rose-800">
                        ยกเลิกคำขอ #{request.id}
                    </DialogTitle>
                </div>
                <div className="space-y-5 px-6 py-5">
                    <div className="space-y-1.5">
                        <Label
                            htmlFor="cancel-reason"
                            className="text-sm font-semibold text-slate-700"
                        >
                            เหตุผล (ถ้ามี)
                        </Label>
                        <Input
                            id="cancel-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="ระบุเหตุผลที่ยกเลิกเพื่อแจ้งผู้เบิก"
                            className="h-10 focus-visible:ring-rose-500"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-3">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                            className="h-10 px-5 font-medium text-slate-600 hover:bg-slate-100"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={loading}
                            onClick={() => onCancel(request.id, reason)}
                            className="h-10 bg-rose-600 px-7 font-bold text-white shadow-sm transition-all hover:bg-rose-700"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    กำลังดำเนินการ...
                                </>
                            ) : (
                                "ยืนยันการยกเลิก"
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
