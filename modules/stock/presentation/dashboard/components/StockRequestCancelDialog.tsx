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
import type { StockRequest } from "../context/types";

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
        <Dialog
            open
            onOpenChange={() => {
                if (!loading) {
                    onClose();
                }
            }}
        >
            <DialogContent scrollMode="area" className="overflow-hidden p-0 sm:max-w-[420px]">
                <div className="border-b border-status-danger-border-subtle bg-status-danger-surface/50 px-5 py-4 sm:px-6">
                    <DialogTitle className="text-lg font-semibold text-status-danger-heading">
                        ยืนยันการยกเลิกคำขอ #{request.id}
                    </DialogTitle>
                </div>
                <div className="space-y-5 px-5 py-5 sm:px-6">
                    <div className="text-sm text-content-secondary">
                        รายการนี้ยังอยู่ในสถานะรอจ่าย หากยืนยันแล้วคำขอจะถูกยกเลิกทันที
                    </div>
                    <div className="space-y-1.5">
                        <Label
                            htmlFor="my-request-cancel-reason"
                            className="text-sm font-semibold text-content-body"
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
                            ปิด
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={loading}
                            onClick={() => void onConfirm(request.id, reason.trim())}
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
