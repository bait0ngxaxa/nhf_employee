import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { type CSVLink } from "react-csv";
import { useLeaveApprovals, type PendingLeave } from "@/hooks/useLeaveApprovals";
import {
    fetchLeaveExportRows,
    fetchLeaveExportYears,
    logLeaveExportAudit,
    submitLeaveApprovalAction,
    type LeaveApprovalAction,
    type LeaveExportCsvRow,
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
    exportData: LeaveExportCsvRow[];
    csvLinkRef: RefObject<CSVLink & HTMLAnchorElement & { link: HTMLAnchorElement } | null>;
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
    const [exportData, setExportData] = useState<LeaveExportCsvRow[]>([]);
    const csvLinkRef = useRef<CSVLink & HTMLAnchorElement & { link: HTMLAnchorElement } | null>(null);

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
            const rows = await fetchLeaveExportRows(exportYear);
            setExportData(rows);
            setTimeout(() => {
                csvLinkRef.current?.link.click();
            }, 100);
            await logLeaveExportAudit(exportYear, rows.length);
            toast.success("ดาวน์โหลดสำเร็จ", {
                description: `เตรียมข้อมูลการลา ${rows.length} รายการ (ปี ${exportYear}) เรียบร้อยแล้ว`,
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
        exportData,
        csvLinkRef,
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
