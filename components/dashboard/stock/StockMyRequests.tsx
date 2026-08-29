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
import { StockEmptyState } from "./StockLoadingState";
import { StockRequestListSkeleton } from "./StockSkeletons";
import { StockRequestMobileCards } from "./StockRequestMobileCards";

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
    const isInitialLoading = isLoading && requests.length === 0;

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

            {isInitialLoading ? (
                <StockRequestListSkeleton />
            ) : requests.length === 0 ? (
                <StockEmptyState
                    icon={<ClipboardList className="h-6 w-6" aria-hidden="true" />}
                    message={
                        hasActiveFilters
                            ? "ไม่พบคำขอเบิกที่ตรงกับเงื่อนไขค้นหา"
                            : "ยังไม่มีประวัติการเบิก"
                    }
                />
            ) : (
                <>
                    <StockRequestMobileCards
                        requests={requests}
                        renderActions={(request) =>
                            request.status === "PENDING_ISSUE" ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-11 border-status-danger-border text-status-danger-foreground hover:bg-status-danger-surface hover:text-status-danger-foreground"
                                    disabled={processingRequestId === request.id}
                                    onClick={() => setCancelTarget(request)}
                                >
                                    ยกเลิกคำขอ
                                </Button>
                            ) : null
                        }
                    />

                    <div className="hidden overflow-x-auto rounded-2xl bg-surface-raised shadow-sm ring-1 ring-border-subtle xl:block">
                        <Table className="min-w-[1080px] border-separate border-spacing-0">
                            <TableHeader>
                                <TableRow className="border-b border-border-subtle bg-surface-subtle hover:bg-surface-subtle">
                                    <TableHead className="w-20 border-r border-border-subtle font-semibold text-content-body">
                                        เลขที่
                                    </TableHead>
                                    <TableHead className="w-40 border-r border-border-subtle font-semibold text-content-body">
                                        วันที่
                                    </TableHead>
                                    <TableHead className="w-40 border-r border-border-subtle font-semibold text-content-body">
                                        รหัสโครงการ
                                    </TableHead>
                                    <TableHead className="w-[24rem] border-r border-border-subtle font-semibold text-content-body">
                                        รายการ
                                    </TableHead>
                                    <TableHead className="w-32 border-r border-border-subtle font-semibold text-content-body">
                                        สถานะ
                                    </TableHead>
                                    <TableHead className={`w-56 font-semibold text-content-body${requests.some((r) => r.status === "PENDING_ISSUE") ? " border-r border-border-subtle" : ""}`}>
                                        หมายเหตุ
                                    </TableHead>
                                    {requests.some((r) => r.status === "PENDING_ISSUE") && (
                                        <TableHead className="w-36 font-semibold text-content-body">
                                            ดำเนินการ
                                        </TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody className="[&_tr:nth-child(odd)]:bg-surface-raised [&_tr:nth-child(even)]:bg-surface-subtle/80">
                                {requests.map((request) => (
                                    <RequestRow
                                        key={request.id}
                                        request={request}
                                        processingId={processingRequestId}
                                        onOpenCancel={() => setCancelTarget(request)}
                                        showActionColumn={requests.some((r) => r.status === "PENDING_ISSUE")}
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
        <div className="rounded-2xl border border-border-subtle bg-surface-subtle/70 p-3 shadow-sm">
            <div className="mb-3 px-1">
                <div className="text-sm font-semibold text-content-primary">
                    ค้นหาและกรองประวัติการเบิก
                </div>
                <div className="text-xs text-content-secondary">
                    ค้นหาจากเลขที่คำขอ รหัสโครงการ หรือชื่อรายการที่เคยเบิก
                </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" aria-hidden="true" />
                    <Input
                        aria-label="ค้นหาประวัติคำขอเบิกวัสดุ"
                        name="stock-my-request-search"
                        autoComplete="off"
                        value={props.requestSearchQuery}
                        onChange={(event) => props.onSearchChange(event.target.value)}
                        placeholder="ค้นหาเลขที่คำขอ รหัสโครงการ หรือรายการ"
                        className="h-12 rounded-2xl border-border-subtle bg-surface-raised pl-11 pr-11 text-content-primary placeholder:text-content-muted focus-visible:border-brand-border focus-visible:ring-brand-solid"
                    />
                    {props.requestSearchQuery.trim().length > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => props.onSearchChange("")}
                            className="absolute right-2 top-1/2 size-11 -translate-y-1/2 rounded-full text-content-muted hover:bg-surface-muted hover:text-content-body sm:size-8"
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
                            className="h-12 rounded-2xl border-border-subtle bg-surface-raised text-content-primary focus:ring-brand-solid"
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
    showActionColumn: boolean;
}) {
    const { request, processingId, onOpenCancel, showActionColumn } = props;
    const isPendingIssue = request.status === "PENDING_ISSUE";

    return (
        <TableRow className="border-b border-border-subtle transition-colors hover:bg-brand-surface/60">
            <TableCell className="border-r border-border-subtle py-4 font-medium text-content-strong">
                #{request.id}
            </TableCell>
            <TableCell className="border-r border-border-subtle py-4 text-sm text-content-body">
                {formatStockRequestDate(request.createdAt)}
            </TableCell>
            <TableCell className="border-r border-border-subtle py-4 text-sm font-medium text-content-body">
                {request.projectCode}
            </TableCell>
            <TableCell className="w-[24rem] min-w-[24rem] border-r border-border-subtle py-4">
                <div className="space-y-1.5 py-1">
                    {request.items.map((requestItem) => (
                        <div key={requestItem.id} className="flex flex-wrap items-start gap-x-2 gap-y-0.5 text-sm">
                            <span className="min-w-0 font-medium leading-6 text-content-strong">
                                {getRequestItemDisplayName(requestItem)}
                            </span>
                            <span className="shrink-0 rounded-full bg-surface-muted/80 px-2 py-0.5 text-xs font-medium text-content-secondary">
                                x {requestItem.quantity}{" "}
                                {requestItem.variant?.unit ?? requestItem.item.unit}
                            </span>
                        </div>
                    ))}
                </div>
            </TableCell>
            <TableCell className="border-r border-border-subtle py-4">
                <RequestStatusBadge status={request.status} />
            </TableCell>
            <TableCell className={`py-4${showActionColumn ? " border-r border-border-subtle" : ""}`}>
                <StockRequestNote request={request} />
            </TableCell>
            {showActionColumn && (
                <TableCell className="py-4">
                    {isPendingIssue && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-status-danger-border text-status-danger-foreground hover:bg-status-danger-surface hover:text-status-danger-foreground"
                            disabled={processingId === request.id}
                            onClick={onOpenCancel}
                        >
                            ยกเลิกคำขอ
                        </Button>
                    )}
                </TableCell>
            )}
        </TableRow>
    );
}

