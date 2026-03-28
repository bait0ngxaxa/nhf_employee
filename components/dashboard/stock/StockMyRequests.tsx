"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { type StockRequestStatus } from "@prisma/client";
import { toast } from "sonner";
import { Pagination } from "@/components/Pagination";
import { RequestStatusBadge } from "@/components/dashboard/shared/RequestStatusBadge";
import { Button } from "@/components/ui/button";
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
import { API_ROUTES } from "@/lib/ssot/routes";
import { useStockDataContext, useStockUIContext } from "../context/stock";
import type { StockRequest } from "../context/stock/types";
import { StockRequestCancelDialog } from "./StockRequestCancelDialog";
import { getRequestItemDisplayName } from "./stockVariant.shared";

const REQUESTS_PER_PAGE = 20;
const REQUEST_STATUS_OPTIONS = [
    { value: "all", label: "ทั้งหมด" },
    { value: "PENDING_ISSUE", label: "รอจ่าย" },
    { value: "ISSUED", label: "จ่ายแล้ว" },
    { value: "CANCELLED", label: "ยกเลิก" },
] as const;

export function StockMyRequests() {
    const { requests, isLoading, totalRequests, refreshRequests } = useStockDataContext();
    const { requestsPage, setRequestsPage, statusFilter, setStatusFilter } =
        useStockUIContext();
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [cancelTarget, setCancelTarget] = useState<StockRequest | null>(null);
    const totalPages = Math.max(1, Math.ceil(totalRequests / REQUESTS_PER_PAGE));

    async function handleCancel(requestId: number, cancelReason?: string): Promise<void> {
        setProcessingId(requestId);
        try {
            const response = await fetch(API_ROUTES.stock.cancelById(requestId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cancelReason: cancelReason?.trim() ? cancelReason.trim() : null,
                }),
            });

            if (!response.ok) {
                const errorResult = (await response.json()) as { error?: string };
                throw new Error(errorResult.error ?? "เกิดข้อผิดพลาด");
            }

            toast.success(`ยกเลิกคำขอ #${requestId} เรียบร้อยแล้ว`);
            refreshRequests();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
        } finally {
            setProcessingId(null);
            setCancelTarget(null);
        }
    }

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
            <RequestFilters
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
            />

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b-gray-100 bg-slate-50/50 hover:bg-slate-50/50">
                            <TableHead className="w-20 font-semibold text-slate-600">
                                เลขที่
                            </TableHead>
                            <TableHead className="w-40 font-semibold text-slate-600">
                                วันที่
                            </TableHead>
                            <TableHead className="font-semibold text-slate-600">
                                รายการ
                            </TableHead>
                            <TableHead className="w-32 font-semibold text-slate-600">
                                สถานะ
                            </TableHead>
                            <TableHead className="font-semibold text-slate-600">
                                หมายเหตุ
                            </TableHead>
                            <TableHead className="w-36" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((request) => (
                            <RequestRow
                                key={request.id}
                                request={request}
                                processingId={processingId}
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

            <StockRequestCancelDialog
                request={cancelTarget}
                loading={processingId !== null}
                onClose={() => setCancelTarget(null)}
                onConfirm={handleCancel}
            />
        </div>
    );
}

function RequestFilters(props: {
    statusFilter: StockRequestStatus | undefined;
    onStatusChange: (status: StockRequestStatus | undefined) => void;
}) {
    return (
        <div className="flex justify-end">
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
                    <SelectTrigger>
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
        <TableRow className="border-b-gray-50/80 transition-colors hover:bg-blue-50/30">
            <TableCell className="font-medium text-slate-700">#{request.id}</TableCell>
            <TableCell className="text-sm text-slate-600">
                {formatDate(request.createdAt)}
            </TableCell>
            <TableCell>
                <div className="space-y-1.5 py-1">
                    {request.items.map((requestItem) => (
                        <div key={requestItem.id} className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-slate-800">
                                {getRequestItemDisplayName(requestItem)}
                            </span>
                            <span className="rounded-full bg-slate-100/80 px-2 py-0.5 text-xs font-medium text-slate-600">
                                x {requestItem.quantity} {requestItem.variant?.unit ?? requestItem.item.unit}
                            </span>
                        </div>
                    ))}
                </div>
            </TableCell>
            <TableCell>
                <RequestStatusBadge status={request.status} />
            </TableCell>
            <TableCell className="text-sm text-slate-500">
                {renderRequestNote(request)}
            </TableCell>
            <TableCell className="text-right">
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

function renderRequestNote(request: StockRequest): string {
    if (
        (request.status === "CANCELLED" || request.status === "REJECTED_LEGACY") &&
        request.cancelReason
    ) {
        return request.cancelReason;
    }

    if (request.status === "ISSUED" && request.issuedAt) {
        return `จ่ายเมื่อ ${formatDate(request.issuedAt)}`;
    }

    return "-";
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}
