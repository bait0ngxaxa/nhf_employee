"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StockRequest } from "../context/stock/types";

type StockRequestCancelDialogProps = {
    request: StockRequest | null;
    loading: boolean;
    onClose: () => void;
    onConfirm: (requestId: number, cancelReason?: string) => Promise<void>;
};

export function StockRequestCancelDialog({
    request,
    loading,
    onClose,
    onConfirm,
}: StockRequestCancelDialogProps) {
    const [reason, setReason] = useState("");

    useEffect(() => {
        if (!request) {
            setReason("");
        }
    }, [request]);

    if (!request) {
        return null;
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="overflow-hidden p-0 sm:max-w-[420px]">
                <div className="border-b border-rose-100 bg-rose-50/50 px-6 py-4">
                    <DialogTitle className="text-lg font-semibold text-rose-800">
                        ยืนยันการยกเลิกคำขอ #{request.id}
                    </DialogTitle>
                </div>
                <div className="space-y-5 px-6 py-5">
                    <div className="text-sm text-slate-600">
                        รายการนี้ยังอยู่ในสถานะรอจ่าย หากยืนยันแล้วคำขอจะถูกยกเลิกทันที
                    </div>
                    <div className="space-y-1.5">
                        <Label
                            htmlFor="my-request-cancel-reason"
                            className="text-sm font-semibold text-slate-700"
                        >
                            เหตุผล (ถ้ามี)
                        </Label>
                        <Input
                            id="my-request-cancel-reason"
                            name="my-request-cancel-reason"
                            autoComplete="off"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="ระบุเหตุผลเพิ่มเติมเพื่อให้เจ้าหน้าที่ทราบ"
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
                            ปิด
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={loading}
                            onClick={() => void onConfirm(request.id, reason)}
                            className="h-10 bg-rose-600 px-7 font-bold text-white shadow-sm transition-all hover:bg-rose-700"
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
