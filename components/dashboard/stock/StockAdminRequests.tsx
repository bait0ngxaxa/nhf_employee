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
import { StockRequestNote } from "./StockRequestNote";
import { StockEmptyState, StockLoadingState } from "./StockLoadingState";
import { StockRequestMobileCards } from "./StockRequestMobileCards";

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
            {/* Search & Filter bar */}
            <div className="rounded-2xl border border-blue-100/80 bg-blue-50/40 p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between px-1">
                    <div>
                        <div className="text-sm font-semibold text-blue-900">
                            ค้นหาและกรองคำขอเบิก
                        </div>
                        <div className="text-xs text-blue-700/75">
                            ค้นหาจากเลขที่คำขอ รหัสโครงการ ชื่อผู้ขอ อีเมล หรือชื่อรายการที่ขอเบิก
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" aria-hidden="true" />
                        <Input
                            aria-label="ค้นหาคำขอเบิกวัสดุ"
                            name="stock-admin-request-search"
                            autoComplete="off"
                            value={requestSearchQuery}
                            onChange={(event) => setRequestSearchQuery(event.target.value)}
                            placeholder="ค้นหาเลขที่คำขอ รหัสโครงการ ชื่อ อีเมล หรือรายการ"
                            className="h-12 rounded-2xl border-blue-100 bg-white pl-11 pr-11 shadow-inner shadow-blue-100/50 focus-visible:border-blue-300 focus-visible:ring-blue-200"
                        />
                        {requestSearchQuery.trim().length > 0 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setRequestSearchQuery("")}
                                className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-blue-500 hover:bg-blue-100 hover:text-blue-700"
                                aria-label="ล้างคำค้นหาคำขอเบิกวัสดุ"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
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
                            <SelectTrigger
                                className="h-12 rounded-2xl border-blue-100 bg-white shadow-inner shadow-blue-100/50 focus:ring-blue-200"
                                aria-label="กรองสถานะคำขอเบิกวัสดุ"
                            >
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
                <StockLoadingState message="กำลังโหลดคำขอเบิก..." />
            ) : requests.length === 0 ? (
                <StockEmptyState
                    icon={<ClipboardList className="h-6 w-6" aria-hidden="true" />}
                    message={
                        hasActiveFilters
                            ? "ไม่พบคำขอเบิกที่ตรงกับเงื่อนไขค้นหา"
                            : "ไม่มีคำขอเบิกวัสดุ"
                    }
                />
            ) : (
                <>
                    <StockRequestMobileCards
                        requests={requests}
                        showRequester
                        renderActions={(req) =>
                            req.status === "PENDING_ISSUE" ? (
                                <>
                                    <Button
                                        size="sm"
                                        className="h-11 bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700"
                                        disabled={processingRequestId === req.id}
                                        onClick={() => void handleIssue(req.id)}
                                    >
                                        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                        จ่ายแล้ว
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-11 border-rose-200 text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                                        disabled={processingRequestId === req.id}
                                        onClick={() => setCancelTarget(req)}
                                    >
                                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                        ยกเลิก
                                    </Button>
                                </>
                            ) : null
                        }
                    />

                    <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 md:block">
                        <Table className="min-w-[980px] border-separate border-spacing-0">
                            <TableHeader>
                                <TableRow className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50">
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
                            <TableBody className="[&_tr:nth-child(odd)]:bg-white [&_tr:nth-child(even)]:bg-slate-50/80">
                                {requests.map((req) => {
                                    const isPendingIssue = req.status === "PENDING_ISSUE";
                                    return (
                                        <TableRow
                                            key={req.id}
                                            className="border-b border-slate-200 transition-colors hover:bg-blue-50/60"
                                        >
                                            <TableCell className="border-r border-slate-200 py-4 font-medium text-slate-800">
                                                #{req.id}
                                            </TableCell>
                                            <TableCell className="border-r border-slate-200 py-4 text-sm text-slate-700">
                                                {formatStockRequestDate(req.createdAt)}
                                            </TableCell>
                                            <TableCell className="border-r border-slate-200 py-4 text-sm font-medium text-slate-700">
                                                {req.projectCode}
                                            </TableCell>
                                            <TableCell className="border-r border-slate-200 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {req.requester.name}
                                                    </span>
                                                    <span className="text-xs font-medium text-slate-400">
                                                        {req.requester.email}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="border-r border-slate-200 py-4">
                                                <div className="space-y-1.5 py-1">
                                                    {req.items.map((ri) => (
                                                        <div
                                                            key={ri.id}
                                                            className="flex flex-wrap items-start gap-x-2 gap-y-0.5 text-sm"
                                                        >
                                                            <span className="font-medium text-slate-800">
                                                                {getRequestItemDisplayName(ri)}
                                                            </span>
                                                            <span className="shrink-0 rounded-full bg-slate-100/80 px-2 py-0.5 text-xs font-medium text-slate-600">
                                                                x {ri.quantity} {ri.item.unit}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="border-r border-slate-200 py-4">
                                                <RequestStatusBadge status={req.status} />
                                            </TableCell>
                                            <TableCell className="py-4">
                                                {isPendingIssue ? (
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            className="bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700"
                                                            disabled={processingRequestId === req.id}
                                                            onClick={() => void handleIssue(req.id)}
                                                        >
                                                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                                            จ่ายแล้ว
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-rose-200 text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                                                            disabled={processingRequestId === req.id}
                                                            onClick={() => setCancelTarget(req)}
                                                        >
                                                            <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                                            ยกเลิก
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <StockRequestNote request={req} />
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
        <Dialog
            open
            onOpenChange={() => {
                if (!loading) {
                    onClose();
                }
            }}
        >
            <DialogContent className="overflow-hidden p-0 sm:max-w-[400px]">
                <div className="border-b border-rose-100 bg-rose-50/50 px-5 py-4 sm:px-6">
                    <DialogTitle className="text-lg font-semibold text-rose-800">
                        ยกเลิกคำขอ #{request.id}
                    </DialogTitle>
                </div>
                <div className="space-y-5 px-5 py-5 sm:px-6">
                    <div className="space-y-1.5">
                        <Label
                            htmlFor="cancel-reason"
                            className="text-sm font-semibold text-slate-700"
                        >
                            เหตุผล (ถ้ามี)
                        </Label>
                        <Input
                            id="cancel-reason"
                            name="cancel-reason"
                            autoComplete="off"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="ระบุเหตุผลที่ยกเลิกเพื่อแจ้งผู้เบิก"
                            className="h-10 focus-visible:ring-rose-500"
                        />
                    </div>
                    <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                            className="h-11 px-5 font-medium text-slate-600 hover:bg-slate-100"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={loading}
                            onClick={() => onCancel(request.id, reason.trim())}
                            className="h-11 bg-rose-600 px-7 font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                    กำลังดำเนินการ…
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
