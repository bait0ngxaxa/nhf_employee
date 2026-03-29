"use client";

import { useState } from "react";
import { type StockRequestStatus } from "@prisma/client";
import { CheckCircle, ClipboardList, XCircle } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RequestStatusBadge } from "@/components/dashboard/shared/RequestStatusBadge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { API_ROUTES } from "@/lib/ssot/routes";
import { useStockDataContext, useStockUIContext } from "../context/stock";
import type { StockRequest } from "../context/stock/types";

const REQUESTS_PER_PAGE = 20;
const REQUEST_STATUS_OPTIONS = [
    { value: "all", label: "ทั้งหมด" },
    { value: "PENDING_ISSUE", label: "รอจ่าย" },
    { value: "ISSUED", label: "จ่ายแล้ว" },
    { value: "CANCELLED", label: "ยกเลิก" },
] as const;

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function StockAdminRequests() {
    const { requests, isLoading, refreshRequests, refreshItems, totalRequests } =
        useStockDataContext();
    const { requestsPage, setRequestsPage, statusFilter, setStatusFilter } =
        useStockUIContext();
    const [cancelTarget, setCancelTarget] = useState<StockRequest | null>(null);
    const [processing, setProcessing] = useState<number | null>(null);
    const totalPages = Math.max(1, Math.ceil(totalRequests / REQUESTS_PER_PAGE));

    async function handleIssue(requestId: number): Promise<void> {
        setProcessing(requestId);
        try {
            const res = await fetch(API_ROUTES.stock.issueById(requestId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "เกิดข้อผิดพลาด");
            }

            toast.success(`จ่ายคำขอ #${requestId} เรียบร้อยแล้ว`);
            refreshRequests();
            refreshItems();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
        } finally {
            setProcessing(null);
        }
    }

    async function handleCancel(requestId: number, reason: string): Promise<void> {
        setProcessing(requestId);
        try {
            const res = await fetch(API_ROUTES.stock.cancelById(requestId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cancelReason: reason || null,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "เกิดข้อผิดพลาด");
            }

            toast.success(`ยกเลิกคำขอ #${requestId} เรียบร้อยแล้ว`);
            refreshRequests();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
        } finally {
            setProcessing(null);
            setCancelTarget(null);
        }
    }

    if (isLoading) {
        return <div className="py-12 text-center text-gray-500">กำลังโหลด...</div>;
    }

    if (requests.length === 0 && statusFilter === undefined) {
        return (
            <div className="py-12 text-center text-gray-500">
                <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p>ไม่มีคำขอเบิกวัสดุ</p>
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

            {requests.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                    <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-50" />
                    <p>ไม่มีคำขอเบิกวัสดุ</p>
                </div>
            ) : (
                <>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <Table className="border-separate border-spacing-0">
                    <TableHeader>
                        <TableRow className="border-b-2 border-slate-200 bg-slate-100/80 hover:bg-slate-100/80">
                            <TableHead className="w-16 border-r border-slate-200 font-semibold text-slate-700">เลขที่</TableHead>
                            <TableHead className="w-40 border-r border-slate-200 font-semibold text-slate-700">วันที่</TableHead>
                            <TableHead className="border-r border-slate-200 font-semibold text-slate-700">ผู้เบิก</TableHead>
                            <TableHead className="border-r border-slate-200 font-semibold text-slate-700">รายการ</TableHead>
                            <TableHead className="w-32 border-r border-slate-200 font-semibold text-slate-700">สถานะ</TableHead>
                            <TableHead className="w-52" />
                        </TableRow>
                    </TableHeader>
                    <TableBody className="[&_tr:nth-child(odd)]:bg-white [&_tr:nth-child(even)]:bg-slate-100/70">
                        {requests.map((req) => {
                            const isPendingIssue = req.status === "PENDING_ISSUE";

                            return (
                                <TableRow key={req.id} className="border-b-2 border-slate-300 transition-colors hover:bg-blue-100/70">
                                    <TableCell className="border-r border-slate-300 py-4 font-medium text-slate-800">#{req.id}</TableCell>
                                    <TableCell className="border-r border-slate-300 py-4 text-slate-700 text-sm">
                                        {formatDate(req.createdAt)}
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
                                                <div key={ri.id} className="text-sm flex items-center gap-2">
                                                    <span className="font-medium text-slate-800">{ri.item.name}</span>
                                                    <span className="text-xs bg-slate-100/80 text-slate-600 px-2 py-0.5 rounded-full font-medium">
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
                                            <div className="flex gap-2 justify-end">
                                                <Button
                                                    size="sm"
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all hover:shadow-md"
                                                    disabled={processing === req.id}
                                                    onClick={() => handleIssue(req.id)}
                                                >
                                                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                                    จ่ายแล้ว
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300 transition-all shadow-sm"
                                                    disabled={processing === req.id}
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
                loading={processing !== null}
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
            <DialogContent className="sm:max-w-[400px] overflow-hidden p-0">
                <div className="px-6 py-4 border-b border-rose-100 bg-rose-50/50">
                    <DialogTitle className="text-lg font-semibold text-rose-800">ยกเลิกคำขอ #{request.id}</DialogTitle>
                </div>
                <div className="px-6 py-5 space-y-5">
                    <div className="space-y-1.5">
                        <Label htmlFor="cancel-reason" className="text-sm font-semibold text-slate-700">เหตุผล (ถ้ามี)</Label>
                        <Input
                            id="cancel-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="ระบุเหตุผลที่ยกเลิกเพื่อแจ้งผู้เบิก"
                            className="h-10 focus-visible:ring-rose-500"
                        />
                    </div>
                    <div className="pt-3 flex justify-end gap-3">
                        <Button variant="ghost" onClick={onClose} disabled={loading} className="h-10 px-5 font-medium hover:bg-slate-100 text-slate-600">
                            ยกเลิก
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={loading}
                            onClick={() => onCancel(request.id, reason)}
                            className="h-10 px-7 font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
                        >
                            {loading ? "กำลังดำเนินการ..." : "ยืนยันการยกเลิก"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
