"use client";

import { useState } from "react";
import { ClipboardList, Search, X } from "lucide-react";
import { type StockRequestStatus } from "@prisma/client";
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
import { useStockDataContext, useStockUIContext } from "../context/stock";
import { STOCK_REQUESTS_LIMIT as REQUESTS_PER_PAGE } from "../context/stock/provider.shared";
import type { StockRequest } from "../context/stock/types";
import { StockRequestCancelDialog } from "./StockRequestCancelDialog";
import {
    formatStockRequestDate,
    REQUEST_STATUS_OPTIONS,
} from "./stockRequest.shared";
import { getRequestItemDisplayName } from "./stockVariant.shared";
import { useStockRequestActions } from "./useStockRequestActions";
import { StockRequestNote } from "./StockRequestNote";

export function StockMyRequests() {
    const { requests, isLoading, totalRequests, refreshRequests } = useStockDataContext();
    const {
        requestsPage,
        setRequestsPage,
        statusFilter,
        setStatusFilter,
        requestSearchQuery,
        setRequestSearchQuery,
    } = useStockUIContext();
    const [cancelTarget, setCancelTarget] = useState<StockRequest | null>(null);
    const { processingRequestId, runCancelRequest } = useStockRequestActions({
        onCancelSuccess: refreshRequests,
        onCancelSettled: () => setCancelTarget(null),
    });
    const totalPages = Math.max(1, Math.ceil(totalRequests / REQUESTS_PER_PAGE));
    const hasActiveFilters =
        statusFilter !== undefined || requestSearchQuery.trim().length > 0;

    async function handleCancel(requestId: number, cancelReason?: string): Promise<void> {
        await runCancelRequest(requestId, cancelReason);
    }

    return (
        <div className="space-y-4">
            <RequestFilters
                requestSearchQuery={requestSearchQuery}
                onSearchChange={setRequestSearchQuery}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
            />

            {isLoading ? (
                <div className="py-12 text-center text-gray-500">กำลังโหลด...</div>
            ) : requests.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                    <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-50" />
                    <p>
                        {hasActiveFilters
                            ? "ไม่พบคำขอเบิกที่ตรงกับเงื่อนไขค้นหา"
                            : "ยังไม่มีประวัติการเบิก"}
                    </p>
                </div>
            ) : (
                <>
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                        <Table className="border-separate border-spacing-0">
                            <TableHeader>
                                <TableRow className="border-b-2 border-slate-200 bg-slate-100/80 hover:bg-slate-100/80">
                                    <TableHead className="w-20 border-r border-slate-200 font-semibold text-slate-700">
                                        เลขที่
                                    </TableHead>
                                    <TableHead className="w-40 border-r border-slate-200 font-semibold text-slate-700">
                                        วันที่
                                    </TableHead>
                                    <TableHead className="w-40 border-r border-slate-200 font-semibold text-slate-700">
                                        รหัสโครงการ
                                    </TableHead>
                                    <TableHead className="border-r border-slate-200 font-semibold text-slate-700">
                                        รายการ
                                    </TableHead>
                                    <TableHead className="w-32 border-r border-slate-200 font-semibold text-slate-700">
                                        สถานะ
                                    </TableHead>
                                    <TableHead className="border-r border-slate-200 font-semibold text-slate-700">
                                        หมายเหตุ
                                    </TableHead>
                                    <TableHead className="w-36" />
                                </TableRow>
                            </TableHeader>
                            <TableBody className="[&_tr:nth-child(odd)]:bg-white [&_tr:nth-child(even)]:bg-slate-100/70">
                                {requests.map((request) => (
                                    <RequestRow
                                        key={request.id}
                                        request={request}
                                        processingId={processingRequestId}
                                        onOpenCancel={() => setCancelTarget(request)}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <Pagination
                        currentPage={requestsPage}
                        totalPages={totalPages}
                        itemsPerPage={REQUESTS_PER_PAGE}
                        onPageChange={setRequestsPage}
                        onPreviousPage={() => setRequestsPage(Math.max(1, requestsPage - 1))}
                        onNextPage={() =>
                            setRequestsPage(Math.min(totalPages, requestsPage + 1))
                        }
                    />
                </>
            )}

            <StockRequestCancelDialog
                request={cancelTarget}
                loading={processingRequestId !== null}
                onClose={() => setCancelTarget(null)}
                onConfirm={handleCancel}
            />
        </div>
    );
}

function RequestFilters(props: {
    requestSearchQuery: string;
    onSearchChange: (value: string) => void;
    statusFilter: StockRequestStatus | undefined;
    onStatusChange: (status: StockRequestStatus | undefined) => void;
}) {
    return (
        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_48px_-32px_rgba(15,23,42,0.22)] backdrop-blur">
            <div className="mb-3 px-1">
                <div className="text-sm font-semibold text-slate-800">
                    ค้นหาและกรองประวัติการเบิก
                </div>
                <div className="text-xs text-slate-500">
                    ค้นหาจากเลขที่คำขอ รหัสโครงการ หรือชื่อรายการที่เคยเบิก
                </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <Input
                        aria-label="ค้นหาประวัติคำขอเบิกวัสดุ"
                        name="stock-my-request-search"
                        autoComplete="off"
                        value={props.requestSearchQuery}
                        onChange={(event) => props.onSearchChange(event.target.value)}
                        placeholder="ค้นหาเลขที่คำขอ รหัสโครงการ หรือรายการ"
                        className="h-12 rounded-2xl border-slate-200 bg-slate-50/80 pl-11 pr-11 shadow-inner shadow-slate-200/50 focus-visible:border-orange-300 focus-visible:ring-orange-200"
                    />
                    {props.requestSearchQuery.trim().length > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => props.onSearchChange("")}
                            className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-600"
                            aria-label="ล้างคำค้นหาประวัติคำขอเบิกวัสดุ"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    )}
                </div>
                <div className="w-full sm:w-56">
                    <Select
                        value={props.statusFilter ?? "all"}
                        onValueChange={(value) =>
                            props.onStatusChange(
                                value === "all"
                                    ? undefined
                                    : (value as StockRequestStatus),
                            )
                        }
                    >
                        <SelectTrigger
                            className="h-12 rounded-2xl border-slate-200 bg-slate-50/80 shadow-inner shadow-slate-200/50"
                            aria-label="กรองสถานะประวัติคำขอเบิกวัสดุ"
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
    );
}

function RequestRow(props: {
    request: StockRequest;
    processingId: number | null;
    onOpenCancel: () => void;
}) {
    const { request, processingId, onOpenCancel } = props;
    const isPendingIssue = request.status === "PENDING_ISSUE";

    return (
        <TableRow className="border-b-2 border-slate-300 transition-colors hover:bg-blue-100/70">
            <TableCell className="border-r border-slate-300 py-4 font-medium text-slate-800">
                #{request.id}
            </TableCell>
            <TableCell className="border-r border-slate-300 py-4 text-sm text-slate-700">
                {formatStockRequestDate(request.createdAt)}
            </TableCell>
            <TableCell className="border-r border-slate-300 py-4 text-sm font-medium text-slate-700">
                {request.projectCode}
            </TableCell>
            <TableCell className="border-r border-slate-300 py-4">
                <div className="space-y-1.5 py-1">
                    {request.items.map((requestItem) => (
                        <div key={requestItem.id} className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-slate-800">
                                {getRequestItemDisplayName(requestItem)}
                            </span>
                            <span className="rounded-full bg-slate-100/80 px-2 py-0.5 text-xs font-medium text-slate-600">
                                x {requestItem.quantity}{" "}
                                {requestItem.variant?.unit ?? requestItem.item.unit}
                            </span>
                        </div>
                    ))}
                </div>
            </TableCell>
            <TableCell className="border-r border-slate-300 py-4">
                <RequestStatusBadge status={request.status} />
            </TableCell>
            <TableCell className="border-r border-slate-300 py-4">
                <StockRequestNote request={request} />
            </TableCell>
            <TableCell className="py-4 text-right">
                {isPendingIssue && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        disabled={processingId === request.id}
                        onClick={onOpenCancel}
                    >
                        ยกเลิกคำขอ
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
}

