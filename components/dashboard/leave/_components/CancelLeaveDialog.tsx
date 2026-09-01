import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface CancelLeaveDialogProps {
    open: boolean;
    isSubmitting: boolean;
    requiresApproval: boolean;
    reason: string;
    onReasonChange: (value: string) => void;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
}

export function CancelLeaveDialog({
    open,
    isSubmitting,
    requiresApproval,
    reason,
    onReasonChange,
    onOpenChange,
    onConfirm,
}: CancelLeaveDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent scrollMode="content">
                <DialogHeader>
                    <DialogTitle>
                        {requiresApproval ? "ขอยกเลิกวันลาที่อนุมัติแล้ว" : "ยืนยันการยกเลิกคำขอลา"}
                    </DialogTitle>
                    <DialogDescription>
                        {requiresApproval
                            ? "คำขอนี้จะส่งให้ผู้อนุมัติยืนยันก่อนคืนโควต้า"
                            : "คุณต้องการยกเลิกคำขอลานี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้"}
                    </DialogDescription>
                </DialogHeader>
                {requiresApproval ? (
                    <Textarea
                        value={reason}
                        onChange={(event) => onReasonChange(event.target.value)}
                        placeholder="เหตุผลการขอยกเลิก (ถ้ามี)"
                        rows={4}
                        maxLength={1000}
                        className="resize-none"
                        disabled={isSubmitting}
                    />
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        variant="outline"
                        disabled={isSubmitting}
                        onClick={() => onOpenChange(false)}
                    >
                        ปิด
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={isSubmitting}
                        onClick={onConfirm}
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                        {requiresApproval ? "ส่งคำขอยกเลิก" : "ยืนยันการยกเลิก"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
