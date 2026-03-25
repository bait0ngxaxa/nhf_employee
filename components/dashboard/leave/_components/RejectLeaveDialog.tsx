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
import { Loader2 } from "lucide-react";
import type { PendingLeave } from "@/hooks/useLeaveApprovals";

interface RejectLeaveDialogProps {
    open: boolean;
    selectedLeave: PendingLeave | null;
    rejectReason: string;
    isProcessing: boolean;
    onOpenChange: (open: boolean) => void;
    onRejectReasonChange: (value: string) => void;
    onConfirmReject: () => Promise<void>;
}

export function RejectLeaveDialog({
    open,
    selectedLeave,
    rejectReason,
    isProcessing,
    onOpenChange,
    onRejectReasonChange,
    onConfirmReject,
}: RejectLeaveDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>เหตุผลที่ไม่อนุมัติ</DialogTitle>
                    <DialogDescription>
                        กรุณาระบุเหตุผลที่ปฏิเสธการลาของ {selectedLeave?.employee.firstName}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea
                        placeholder="ระบุเหตุผลที่ไม่อนุมัติ"
                        value={rejectReason}
                        onChange={(event) => onRejectReasonChange(event.target.value)}
                        className="resize-none"
                        rows={4}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        ยกเลิก
                    </Button>
                    <Button
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={onConfirmReject}
                        disabled={!rejectReason.trim() || isProcessing}
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        ยืนยันการปฏิเสธ
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
