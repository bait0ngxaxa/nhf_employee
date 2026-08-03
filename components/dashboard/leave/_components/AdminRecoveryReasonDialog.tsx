import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export type AdminRecoveryDecision =
    | "NOT_TAKEN"
    | "CONFIRM_CANCELLATION"
    | "REJECT_CANCELLATION";

interface AdminRecoveryReasonDialogProps {
    open: boolean;
    decision: AdminRecoveryDecision | null;
    reason: string;
    isProcessing: boolean;
    onOpenChange: (open: boolean) => void;
    onReasonChange: (value: string) => void;
    onConfirm: () => Promise<void>;
}

const DIALOG_COPY: Record<AdminRecoveryDecision, {
    title: string;
    description: string;
    confirmLabel: string;
}> = {
    NOT_TAKEN: {
        title: "ยืนยันการกู้คืนโควต้า",
        description: "ผู้อนุมัติเดิมไม่พร้อมใช้งาน กรุณาระบุเหตุผลก่อนยืนยันคืนโควต้า",
        confirmLabel: "ยืนยันคืนโควต้า",
    },
    CONFIRM_CANCELLATION: {
        title: "ยืนยันการกู้คืนคำขอยกเลิก",
        description: "ผู้อนุมัติเดิมไม่พร้อมใช้งาน กรุณาระบุเหตุผลก่อนยืนยันยกเลิกและคืนโควต้า",
        confirmLabel: "ยืนยันยกเลิกและคืนโควต้า",
    },
    REJECT_CANCELLATION: {
        title: "ปิดคำขอกู้คืน",
        description: "กรุณาระบุเหตุผลก่อนปิดคำขอ โดยคำขอลาจะคงสถานะอนุมัติเดิม",
        confirmLabel: "ปิดคำขอ",
    },
};

export function AdminRecoveryReasonDialog({
    open,
    decision,
    reason,
    isProcessing,
    onOpenChange,
    onReasonChange,
    onConfirm,
}: AdminRecoveryReasonDialogProps): ReactElement {
    const copy = decision ? DIALOG_COPY[decision] : DIALOG_COPY.NOT_TAKEN;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{copy.title}</DialogTitle>
                    <DialogDescription>{copy.description}</DialogDescription>
                </DialogHeader>
                <div className="py-2">
                    <Textarea
                        aria-label="เหตุผลการกู้คืนรายการลา"
                        placeholder="ระบุเหตุผลการกู้คืนรายการลา"
                        value={reason}
                        onChange={(event) => onReasonChange(event.target.value)}
                        className="resize-none"
                        rows={4}
                        maxLength={1000}
                        disabled={isProcessing}
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() => onOpenChange(false)}
                    >
                        ยกเลิก
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={!reason.trim() || isProcessing || !decision}
                    >
                        {isProcessing
                            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            : null}
                        {copy.confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
