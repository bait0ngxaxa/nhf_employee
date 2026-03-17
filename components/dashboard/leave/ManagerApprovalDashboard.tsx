"use client";

import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLeaveApprovals, type PendingLeave } from "@/hooks/useLeaveApprovals";
import { apiGet, apiPost } from "@/lib/api-client";
import { CheckCircle, XCircle, Clock, Loader2, CalendarRange, UserCircle2, Download } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CSVLink } from "react-csv";
import { mapLeaveRowToCSV, type LeaveRequestRow } from "@/lib/helpers/csv-helpers";
import { generateFilename } from "@/lib/helpers/date-helpers";


export function ManagerApprovalDashboard() {
    const { pending, history, isLoading, mutate } = useLeaveApprovals();
    const [selectedLeave, setSelectedLeave] = useState<PendingLeave | null>(null);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // Export state
    const currentYear = new Date().getFullYear();
    const [exportYear, setExportYear] = useState(currentYear);
    const [isExporting, setIsExporting] = useState(false);
    const [exportData, setExportData] = useState<Record<string, string | number>[]>([]);
    const csvLinkRef = useRef<CSVLink & HTMLAnchorElement & { link: HTMLAnchorElement }>(null);
    const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);

    // Fetch years that have actual leave data for this manager's team
    useEffect(() => {
        void apiGet<{ years: number[] }>("/api/leave/export?yearsOnly=1")
            .then((res) => {
                if (res.success && res.data.years.length > 0) {
                    setAvailableYears(res.data.years);
                    setExportYear(res.data.years[0]);
                }
            });
    }, []);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const handleExportCSV = async () => {
        setIsExporting(true);
        try {
            const res = await apiGet<{ data: LeaveRequestRow[] }>(`/api/leave/export?year=${exportYear}`);
            if (!res.success) throw new Error(res.error);

            const rows = res.data.data.map(mapLeaveRowToCSV);

            setExportData(rows);

            // Trigger download on next render tick
            setTimeout(() => {
                csvLinkRef.current?.link.click();
            }, 100);

            // Audit: log the export action
            await apiPost("/api/audit-logs/export", {
                entityType: "LeaveRequest",
                recordCount: rows.length,
                filters: { year: exportYear },
            });

            toast.success("ดาวน์โหลดสำเร็จ", {
                description: `เตรียมข้อมูลการลา ${rows.length} รายการ (ปี ${exportYear}) เรียบร้อยแล้ว`,
            });
        } catch (err) {
            console.error("Export error:", err);
            toast.error("เกิดข้อผิดพลาดในการดาวน์โหลด");
        } finally {
            setTimeout(() => setIsExporting(false), 500);
        }
    };

    const handleAction = async (action: "APPROVE" | "REJECT", leaveId: string, reason?: string) => {
        setIsProcessing(true);
        try {
            const res = await apiPost("/api/leave/intranet-action", {
                leaveId,
                action,
                reason
            });

            if (res.success) {
                toast.success(action === "APPROVE" ? "อนุมัติใบลาเรียบร้อยแล้ว" : "ปฏิเสธใบลาเรียบร้อยแล้ว");
                await mutate();
                setIsRejectDialogOpen(false);
                setRejectReason("");
                setSelectedLeave(null);
            } else {
                toast.error(res.error || "เกิดข้อผิดพลาดในการดำเนินการ");
            }
        } catch (error) {
            console.error("Action failed:", error);
            toast.error("เกิดข้อผิดพลาดในการดำเนินการ");
        } finally {
            setIsProcessing(false);
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case "APPROVED":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">อนุมัติแล้ว</span>;
            case "REJECTED":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">ไม่อนุมัติ</span>;
            case "CANCELLED":
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">ยกเลิก</span>;
            default:
                return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">รอดำเนินการ</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">รายการรอพิจารณา (Pending Approvals)</h2>
                    <p className="text-sm text-gray-500">ใบลาคงค้างของพนักงานในทีมที่รอรับการอนุมัติ</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select
                        value={String(exportYear)}
                        onValueChange={(v) => setExportYear(Number(v))}
                    >
                        <SelectTrigger className="w-[110px] h-9 text-sm">
                            <SelectValue placeholder="เลือกปี" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableYears.map((y) => (
                                <SelectItem key={y} value={String(y)}>
                                    {y}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        onClick={handleExportCSV}
                        disabled={isExporting}
                        variant="outline"
                        className="h-9 text-sm"
                    >
                        {isExporting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4 mr-2" />
                        )}
                        Export CSV
                    </Button>
                    {/* Hidden CSVLink */}
                    <CSVLink
                        ref={csvLinkRef}
                        data={exportData}
                        filename={generateFilename(`รายงานการลา_ปี-${exportYear}`, "csv")}
                        className="hidden"
                    />
                </div>
            </div>

            {pending.length === 0 ? (
                <Card className="shadow-sm border-gray-100">
                    <div className="p-8 text-center flex flex-col items-center text-gray-500">
                        <div className="bg-emerald-50 p-4 rounded-full mb-4">
                            <CheckCircle className="h-8 w-8 text-emerald-400" />
                        </div>
                        <p className="text-lg font-medium text-gray-700">ไม่มีคำขอที่ต้องพิจารณา</p>
                        <p className="text-sm text-gray-400 mt-1">ยอดเยี่ยม! คุณตรวจสอบใบลาครบทั้งหมดแล้ว</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-4">
                    {pending.map((leave) => (
                        <Card key={leave.id} className="shadow-sm border-l-4 border-l-amber-400 overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-5 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                                <div className="space-y-2 flex-grow">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-indigo-100 text-indigo-700 p-2 rounded-lg">
                                            <UserCircle2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-1">
                                                {leave.employee.firstName} {leave.employee.lastName} {leave.employee.nickname ? `(${leave.employee.nickname})` : ''}
                                            </p>
                                            <p className="text-sm text-gray-500">{leave.employee.position} &bull; {leave.employee.dept?.name}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gray-50 p-3 rounded-md mt-3">
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                                            <div className="flex items-center text-gray-700 font-medium">
                                                <CalendarRange className="w-4 h-4 mr-1.5 text-gray-400" />
                                                <span>
                                                    ประเภท: <span className="text-indigo-600">
                                                        {leave.leaveType === "SICK" ? "ลาป่วย" : leave.leaveType === "PERSONAL" ? "ลากิจ" : "ลาพักร้อน"}
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="flex items-center text-gray-700">
                                                <Clock className="w-4 h-4 mr-1.5 text-gray-400" />
                                                <span>
                                                    วันที่: {format(new Date(leave.startDate), "d MMM yy", { locale: th })}
                                                    {leave.startDate !== leave.endDate && ` - ${format(new Date(leave.endDate), "d MMM yy", { locale: th })}`}
                                                </span>
                                                <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
                                                    {leave.period === "FULL_DAY" ? "เต็มวัน" : leave.period === "MORNING" ? "ช่วงเช้า" : "ช่วงบ่าย"} 
                                                    ({leave.durationDays} วัน)
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-2 text-sm text-gray-600 italic">
                                            &quot;{leave.reason}&quot;
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        ยื่นใบลาเมื่อ: {format(new Date(leave.createdAt), "d MMM yyyy HH:mm", { locale: th })}
                                    </div>
                                </div>
                                <div className="flex lg:flex-col justify-end gap-2 pt-2 border-t lg:border-t-0 lg:pl-4 lg:border-l border-gray-100 min-w-[120px]">
                                    <Button 
                                        onClick={() => handleAction("APPROVE", leave.id)}
                                        disabled={isProcessing}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white w-full shadow-sm"
                                    >
                                        <CheckCircle className="w-4 h-4 mr-2" /> อนุมัติ
                                    </Button>
                                    <Button 
                                        onClick={() => {
                                            setSelectedLeave(leave);
                                            setIsRejectDialogOpen(true);
                                        }}
                                        disabled={isProcessing}
                                        variant="outline"
                                        className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 w-full"
                                    >
                                        <XCircle className="w-4 h-4 mr-2" /> ไม่อนุมัติ
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <div className="mt-12">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">ประวัติการพิจารณา (Approval History)</h2>
                {history.length === 0 ? (
                    <Card className="shadow-sm border-gray-100 p-8 text-center text-gray-500">
                        ยังไม่มีข้อมูลการพิจารณาในระบบ
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {history.map((leave) => (
                            <Card key={leave.id} className="shadow-sm border-gray-100 p-4 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                <div>
                                    <p className="font-medium text-gray-800 text-sm">
                                        {leave.employee.firstName} {leave.employee.lastName} 
                                        <span className="text-gray-400 font-normal ml-2">ยื่นลา{leave.leaveType === "SICK" ? "ป่วย" : leave.leaveType === "PERSONAL" ? "กิจ" : "พักร้อน"}</span>
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        วันที่: {format(new Date(leave.startDate), "d MMM yy", { locale: th })}
                                        {leave.startDate !== leave.endDate && ` - ${format(new Date(leave.endDate), "d MMM yy", { locale: th })}`}
                                        ({leave.durationDays} วัน)
                                    </p>
                                </div>
                                <div>
                                    <StatusBadge status={leave.status} />
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Reject Reason Dialog */}
            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>เหตุผลที่ไม่อนุมัติ</DialogTitle>
                        <DialogDescription>
                            กรุณาระบุเหตุผลที่ปฏิเสธการลางานของ {selectedLeave?.employee.firstName}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="ระบุเหตุผลที่นี่เพื่อแจ้งให้พนักงานทราบ..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="resize-none"
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                            ยกเลิก
                        </Button>
                        <Button 
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => {
                                if (selectedLeave) {
                                    handleAction("REJECT", selectedLeave.id, rejectReason);
                                }
                            }}
                            disabled={!rejectReason.trim() || isProcessing}
                        >
                            {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            ยืนยันการปฏิเสธ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
