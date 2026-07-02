import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface NotTakenRequestDialogProps {
    open: boolean;
    note: string;
    isSubmitting: boolean;
    onNoteChange: (value: string) => void;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
}

export function NotTakenRequestDialog({
    open,
    note,
    isSubmitting,
    onNoteChange,
    onOpenChange,
    onConfirm,
}: NotTakenRequestDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>แจ้งว่าไม่ได้ใช้วันลา</DialogTitle>
                    <DialogDescription>
                        ระบุเหตุการณ์ที่ทำให้วันลาที่อนุมัติแล้วไม่ได้ถูกใช้จริง
                    </DialogDescription>
                </DialogHeader>
                <Textarea
                    value={note}
                    onChange={(event) => onNoteChange(event.target.value)}
                    placeholder="เช่น งานฉุกเฉินทำให้ไม่ได้หยุดตามวันที่ขอ..."
                    rows={4}
                    className="resize-none"
                />
                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        variant="outline"
                        disabled={isSubmitting}
                        onClick={() => onOpenChange(false)}
                    >
                        ปิด
                    </Button>
                    <Button
                        disabled={isSubmitting || note.trim().length < 5}
                        className="bg-cyan-600 hover:bg-cyan-700"
                        onClick={onConfirm}
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        ส่งให้หัวหน้ายืนยัน
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
