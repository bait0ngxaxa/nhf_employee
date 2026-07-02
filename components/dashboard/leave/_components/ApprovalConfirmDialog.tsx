import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { PendingLeave } from "@/hooks/useLeaveApprovals";

interface ApprovalConfirmDialogProps {
    leave: PendingLeave | null;
    isProcessing: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
}

export function ApprovalConfirmDialog({
    leave,
    isProcessing,
    onOpenChange,
    onConfirm,
}: ApprovalConfirmDialogProps) {
    return (
        <Dialog open={Boolean(leave)} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="h-5 w-5" />
                        ยืนยันการอนุมัติคำขอพิเศษ
                    </DialogTitle>
                    <DialogDescription>
                        ตรวจสอบเงื่อนไขพิเศษก่อนอนุมัติ เนื่องจากรายการนี้มีผลต่อ audit หรือโควต้า
                    </DialogDescription>
                </DialogHeader>
                {leave ? (
                    <div className="space-y-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
                        {leave.emergencyReason ? (
                            <p>
                                <span className="font-semibold">เหตุผลฉุกเฉิน:</span>{" "}
                                {leave.emergencyReason}
                            </p>
                        ) : null}
                        {leave.specialReason ? (
                            <p>
                                <span className="font-semibold">เหตุผลพิเศษ:</span>{" "}
                                {leave.specialReason}
                            </p>
                        ) : null}
                        {leave.overQuotaDays > 0 ? (
                            <p>
                                <span className="font-semibold">เกินสิทธิ์:</span>{" "}
                                {leave.overQuotaDays} วัน
                            </p>
                        ) : null}
                    </div>
                ) : null}
                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() => onOpenChange(false)}
                    >
                        กลับไปตรวจสอบ
                    </Button>
                    <Button
                        disabled={isProcessing}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={onConfirm}
                    >
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        ยืนยันอนุมัติ
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
