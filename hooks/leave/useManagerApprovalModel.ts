import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLeaveApprovals, type PendingLeave } from "@/hooks/useLeaveApprovals";
import {
    downloadLeaveExportFile,
    fetchLeaveExportMeta,
    fetchLeaveExportYears,
    submitLeaveApprovalAction,
    type LeaveApprovalAction,
} from "@/lib/services/leave/client";

interface UseManagerApprovalModelResult {
    pending: PendingLeave[];
    history: PendingLeave[];
    isLoading: boolean;
    selectedLeave: PendingLeave | null;
    isRejectDialogOpen: boolean;
    rejectReason: string;
    isProcessing: boolean;
    availableYears: number[];
    exportYear: number;
    isExporting: boolean;
    setRejectReason: (value: string) => void;
    setExportYear: (year: number) => void;
    openRejectDialog: (leave: PendingLeave) => void;
    closeRejectDialog: () => void;
    approveLeave: (leaveId: string) => Promise<void>;
    rejectLeave: () => Promise<void>;
    exportCsv: () => Promise<void>;
}

const currentYear = new Date().getFullYear();

export function useManagerApprovalModel(): UseManagerApprovalModelResult {
    const { pending, history, isLoading, mutate } = useLeaveApprovals();
    const [selectedLeave, setSelectedLeave] = useState<PendingLeave | null>(null);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
    const [exportYear, setExportYear] = useState(currentYear);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        let mounted = true;
        fetchLeaveExportYears()
            .then((data) => {
                if (!mounted || data.years.length === 0) {
                    return;
                }
                setAvailableYears(data.years);
                setExportYear(data.years[0]);
            })
            .catch(() => {
                // Keep default year state for resilience if export-year endpoint fails.
            });
        return () => {
            mounted = false;
        };
    }, []);

    const resetRejectDialog = (): void => {
        setIsRejectDialogOpen(false);
        setRejectReason("");
        setSelectedLeave(null);
    };

    const executeAction = async (action: LeaveApprovalAction, leaveId: string, reason?: string): Promise<void> => {
        setIsProcessing(true);
        try {
            await submitLeaveApprovalAction({ leaveId, action, reason });
            await mutate();
            if (action === "APPROVE") {
                toast.success("อนุมัติใบลาเรียบร้อยแล้ว");
            } else {
                toast.success("ปฏิเสธใบลาเรียบร้อยแล้ว");
            }
            resetRejectDialog();
        } catch {
            toast.error("เกิดข้อผิดพลาดในการดำเนินการ");
        } finally {
            setIsProcessing(false);
        }
    };

    const exportCsv = async (): Promise<void> => {
        setIsExporting(true);
        try {
            const exportMeta = await fetchLeaveExportMeta(exportYear);

            if (exportMeta.count === 0) {
                toast.error("ไม่มีข้อมูลสำหรับดาวน์โหลด");
                return;
            }

            if (exportMeta.count > exportMeta.maxRows) {
                toast.error("ข้อมูลเกินขนาดที่กำหนด", {
                    description: `ส่งออกข้อมูลการลาได้ไม่เกิน ${exportMeta.maxRows} รายการต่อครั้ง กรุณาเลือกปีที่มีข้อมูลน้อยลง`,
                });
                return;
            }

            downloadLeaveExportFile(exportYear);
            toast.success("เริ่มดาวน์โหลดไฟล์แล้ว", {
                description: `กำลังส่งออกข้อมูลการลา ${exportMeta.count} รายการ (ปี ${exportYear})`,
            });
        } catch {
            toast.error("เกิดข้อผิดพลาดในการดาวน์โหลด");
        } finally {
            setTimeout(() => setIsExporting(false), 500);
        }
    };

    return {
        pending,
        history,
        isLoading,
        selectedLeave,
        isRejectDialogOpen,
        rejectReason,
        isProcessing,
        availableYears,
        exportYear,
        isExporting,
        setRejectReason,
        setExportYear,
        openRejectDialog: (leave: PendingLeave) => {
            setSelectedLeave(leave);
            setIsRejectDialogOpen(true);
        },
        closeRejectDialog: resetRejectDialog,
        approveLeave: async (leaveId: string) => executeAction("APPROVE", leaveId),
        rejectLeave: async () => {
            if (!selectedLeave) return;
            await executeAction("REJECT", selectedLeave.id, rejectReason);
        },
        exportCsv,
    };
}
