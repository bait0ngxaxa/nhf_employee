import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface CancelLeaveDialogProps {
    open: boolean;
    isSubmitting: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
}

export function CancelLeaveDialog({
    open,
    isSubmitting,
    onOpenChange,
    onConfirm,
}: CancelLeaveDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>ยืนยันการยกเลิกคำขอลา</DialogTitle>
                    <DialogDescription>
                        คุณต้องการยกเลิกคำขอลานี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
                        ปิด
                    </Button>
                    <Button
                        disabled={isSubmitting}
                        className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                        onClick={onConfirm}
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        ยืนยันการยกเลิก
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
