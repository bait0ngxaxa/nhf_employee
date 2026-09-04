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
import { useStockDataContext, useStockUIContext } from "../context";
import { STOCK_REQUESTS_LIMIT as REQUESTS_PER_PAGE } from "../context/provider.shared";
import type { StockRequest } from "../context/types";
import {
    formatStockRequestDate,
    REQUEST_STATUS_OPTIONS,
} from "./stockRequest.shared";
import { getRequestItemDisplayName } from "./stockVariant.shared";
import { getEmployeeBackedUserDisplayName } from "@/lib/helpers/employee-helpers";
import { useStockRequestActions } from "./useStockRequestActions";
import { StockRequestNote } from "./StockRequestNote";
import { StockEmptyState } from "./StockLoadingState";
import { StockRequestListSkeleton } from "./StockSkeletons";
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
    const isInitialLoading = isLoading && requests.length === 0;

    async function handleIssue(requestId: number): Promise<void> {
        await runIssueRequest(requestId);
    }

    async function handleCancel(requestId: number, reason: string): Promise<void> {
        await runCancelRequest(requestId, reason);
    }

    return (
        <div className="space-y-4">
            {/* Search & Filter bar */}
            <div className="rounded-2xl border border-border-subtle bg-surface-subtle/70 p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between px-1">
                    <div>
                        <div className="text-sm font-semibold text-content-primary">
                            ค้นหาและกรองคำขอเบิก
                        </div>
                        <div className="text-xs text-content-secondary">
                            ค้นหาจากเลขที่คำขอ รหัสโครงการ ชื่อผู้ขอ อีเมล หรือชื่อรายการที่ขอเบิก
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" aria-hidden="true" />
                        <Input
                            aria-label="ค้นหาคำขอเบิกวัสดุ"
                            name="stock-admin-request-search"
                            autoComplete="off"
                            value={requestSearchQuery}
                            onChange={(event) => setRequestSearchQuery(event.target.value)}
                            placeholder="ค้นหาเลขที่คำขอ รหัสโครงการ ชื่อ อีเมล หรือรายการ"
                            className="h-12 rounded-2xl border-border-subtle bg-surface-raised pl-11 pr-11 text-content-primary placeholder:text-content-muted focus-visible:border-action-primary-border-strong focus-visible:ring-action-primary-border"
                        />
                        {requestSearchQuery.trim().length > 0 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setRequestSearchQuery("")}
                                className="absolute right-2 top-1/2 size-11 -translate-y-1/2 rounded-full text-content-muted hover:bg-surface-muted hover:text-content-body sm:size-8"
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
                                className="h-12 rounded-2xl border-border-subtle bg-surface-raised text-content-primary focus:ring-action-primary-border"
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

            {isInitialLoading ? (
                <StockRequestListSkeleton />
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
                                        className="h-11 bg-status-success-solid text-content-on-brand shadow-sm transition-colors hover:bg-status-success-solid-hover"
                                        disabled={processingRequestId === req.id}
                                        onClick={() => void handleIssue(req.id)}
                                    >
                                        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                        จ่ายแล้ว
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-11 border-status-danger-border text-status-danger-foreground transition-colors hover:border-status-danger-border-strong hover:bg-status-danger-surface hover:text-status-danger-strong"
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

                    <div className="hidden overflow-x-auto rounded-2xl bg-surface-raised shadow-sm ring-1 ring-border-subtle xl:block">
                        <Table className="min-w-[1240px] border-separate border-spacing-0">
                            <TableHeader>
                                <TableRow className="border-b border-border-subtle bg-surface-subtle hover:bg-surface-subtle">
                                    <TableHead className="w-16 border-r border-border-subtle font-semibold text-content-body">
                                        เลขที่
                                    </TableHead>
                                    <TableHead className="w-40 border-r border-border-subtle font-semibold text-content-body">
                                        วันที่
                                    </TableHead>
                                    <TableHead className="w-40 border-r border-border-subtle font-semibold text-content-body">
                                        รหัสโครงการ
                                    </TableHead>
                                    <TableHead className="w-56 border-r border-border-subtle font-semibold text-content-body">
                                        ผู้เบิก
                                    </TableHead>
                                    <TableHead className="w-[24rem] border-r border-border-subtle font-semibold text-content-body">
                                        รายการ
                                    </TableHead>
                                    <TableHead className="w-32 border-r border-border-subtle font-semibold text-content-body">
                                        สถานะ
                                    </TableHead>
                                    <TableHead className="w-52" />
                                </TableRow>
                            </TableHeader>
                            <TableBody className="[&_tr:nth-child(odd)]:bg-surface-raised [&_tr:nth-child(even)]:bg-surface-subtle/80">
                                {requests.map((req) => {
                                    const isPendingIssue = req.status === "PENDING_ISSUE";
                                    return (
                                        <TableRow
                                            key={req.id}
                                            className="border-b border-border-subtle transition-colors hover:bg-action-primary-surface/60"
                                        >
                                            <TableCell className="border-r border-border-subtle py-4 font-medium text-content-strong">
                                                #{req.id}
                                            </TableCell>
                                            <TableCell className="border-r border-border-subtle py-4 text-sm text-content-body">
                                                {formatStockRequestDate(req.createdAt)}
                                            </TableCell>
                                            <TableCell className="border-r border-border-subtle py-4 text-sm font-medium text-content-body">
                                                {req.projectCode}
                                            </TableCell>
                                            <TableCell className="w-56 border-r border-border-subtle py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-content-strong">
                                                        {getEmployeeBackedUserDisplayName(req.requester)}
                                                    </span>
                                                    <span className="text-xs font-medium text-content-subtle">
                                                        {req.requester.email}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="w-[24rem] min-w-[24rem] border-r border-border-subtle py-4">
                                                <div className="space-y-1.5 py-1">
                                                    {req.items.map((ri) => (
                                                        <div
                                                            key={ri.id}
                                                            className="flex flex-wrap items-start gap-x-2 gap-y-0.5 text-sm"
                                                        >
                                                            <span className="min-w-0 font-medium leading-6 text-content-strong">
                                                                {getRequestItemDisplayName(ri)}
                                                            </span>
                                                            <span className="shrink-0 rounded-full bg-surface-muted/80 px-2 py-0.5 text-xs font-medium text-content-secondary">
                                                                x {ri.quantity} {ri.item.unit}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="border-r border-border-subtle py-4">
                                                <RequestStatusBadge status={req.status} />
                                            </TableCell>
                                            <TableCell className="py-4">
                                                {isPendingIssue ? (
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            className="bg-status-success-solid text-content-on-brand shadow-sm transition-colors hover:bg-status-success-solid-hover"
                                                            disabled={processingRequestId === req.id}
                                                            onClick={() => void handleIssue(req.id)}
                                                        >
                                                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                                            จ่ายแล้ว
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-status-danger-border text-status-danger-foreground transition-colors hover:border-status-danger-border-strong hover:bg-status-danger-surface hover:text-status-danger-strong"
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
            <DialogContent scrollMode="area" className="overflow-hidden p-0 sm:max-w-[400px]">
                <div className="border-b border-status-danger-border-subtle bg-status-danger-surface/50 px-5 py-4 sm:px-6">
                    <DialogTitle className="text-lg font-semibold text-status-danger-heading">
                        ยกเลิกคำขอ #{request.id}
                    </DialogTitle>
                </div>
                <div className="space-y-5 px-5 py-5 sm:px-6">
                    <div className="space-y-1.5">
                        <Label
                            htmlFor="cancel-reason"
                            className="text-sm font-semibold text-content-body"
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
                            className="h-11 focus-visible:ring-status-danger-focus"
                        />
                    </div>
                    <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                            className="h-11 px-5 font-medium text-content-secondary hover:bg-surface-muted"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={loading}
                            onClick={() => onCancel(request.id, reason.trim())}
                            className="h-11 bg-status-danger-solid px-7 font-bold text-content-on-brand shadow-sm transition-colors hover:bg-status-danger-solid-hover"
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
