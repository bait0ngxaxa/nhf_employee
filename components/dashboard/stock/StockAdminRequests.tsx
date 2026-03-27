"use client";

import { useState } from "react";
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
    const [rejectTarget, setRejectTarget] = useState<StockRequest | null>(null);
    const [processing, setProcessing] = useState<number | null>(null);
    const totalPages = Math.max(1, Math.ceil(totalRequests / REQUESTS_PER_PAGE));

    async function handleApprove(requestId: number): Promise<void> {
        setProcessing(requestId);
        try {
            const res = await fetch(API_ROUTES.stock.reviewById(requestId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "approve" }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "เกิดข้อผิดพลาด");
            }

            toast.success(`อนุมัติคำขอ #${requestId} เรียบร้อยแล้ว`);
            refreshRequests();
            refreshItems();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
        } finally {
            setProcessing(null);
        }
    }

    async function handleReject(requestId: number, reason: string): Promise<void> {
        setProcessing(requestId);
        try {
            const res = await fetch(API_ROUTES.stock.reviewById(requestId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "reject",
                    rejectReason: reason || null,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "เกิดข้อผิดพลาด");
            }

            toast.success(`ปฏิเสธคำขอ #${requestId} เรียบร้อยแล้ว`);
            refreshRequests();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
        } finally {
            setProcessing(null);
            setRejectTarget(null);
        }
    }

    if (isLoading) {
        return <div className="py-12 text-center text-gray-500">กำลังโหลด...</div>;
    }

    if (requests.length === 0) {
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
                            <TableHead className="w-16 font-semibold text-slate-600">เลขที่</TableHead>
                            <TableHead className="w-40 font-semibold text-slate-600">วันที่</TableHead>
                            <TableHead className="font-semibold text-slate-600">ผู้เบิก</TableHead>
                            <TableHead className="font-semibold text-slate-600">รายการ</TableHead>
                            <TableHead className="w-32 font-semibold text-slate-600">สถานะ</TableHead>
                            <TableHead className="w-52" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((req) => {
                            const isPending = req.status === "PENDING";

                            return (
                                <TableRow key={req.id} className="hover:bg-blue-50/30 transition-colors border-b-gray-50/80">
                                    <TableCell className="font-medium text-slate-700">#{req.id}</TableCell>
                                    <TableCell className="text-slate-600 text-sm">
                                        {formatDate(req.createdAt)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-slate-800">
                                                {req.requester.name}
                                            </span>
                                            <span className="text-xs font-medium text-slate-400">
                                                {req.requester.email}
                                            </span>
                                        </div>
                                    </TableCell>
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
                                    <TableCell>
                                        {isPending && (
                                            <div className="flex gap-2 justify-end">
                                                <Button
                                                    size="sm"
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all hover:shadow-md"
                                                    disabled={processing === req.id}
                                                    onClick={() => handleApprove(req.id)}
                                                >
                                                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                                    อนุมัติ
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300 transition-all shadow-sm"
                                                    disabled={processing === req.id}
                                                    onClick={() => setRejectTarget(req)}
                                                >
                                                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                                    ปฏิเสธ
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

            <RejectDialog
                request={rejectTarget}
                onClose={() => setRejectTarget(null)}
                onReject={handleReject}
                loading={processing !== null}
            />
        </div>
    );
}

interface RejectDialogProps {
    request: StockRequest | null;
    onClose: () => void;
    onReject: (id: number, reason: string) => void;
    loading: boolean;
}

function RejectDialog({
    request,
    onClose,
    onReject,
    loading,
}: RejectDialogProps) {
    const [reason, setReason] = useState("");

    if (!request) return null;

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px] overflow-hidden p-0">
                <div className="px-6 py-4 border-b border-rose-100 bg-rose-50/50">
                    <DialogTitle className="text-lg font-semibold text-rose-800">ปฏิเสธคำขอ #{request.id}</DialogTitle>
                </div>
                <div className="px-6 py-5 space-y-5">
                    <div className="space-y-1.5">
                        <Label htmlFor="reject-reason" className="text-sm font-semibold text-slate-700">เหตุผล (ถ้ามี)</Label>
                        <Input
                            id="reject-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="ระบุเหตุผลที่ปฏิเสธเพื่อแจ้งผู้เบิก"
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
                            onClick={() => onReject(request.id, reason)}
                            className="h-10 px-7 font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
                        >
                            {loading ? "กำลังดำเนินการ..." : "ยืนยันการปฏิเสธ"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
