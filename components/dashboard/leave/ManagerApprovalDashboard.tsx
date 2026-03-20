"use client";

import { useState, useRef, useEffect } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    useLeaveApprovals,
    type PendingLeave,
} from "@/hooks/useLeaveApprovals";
import { apiGet, apiPost } from "@/lib/api-client";
import useSWR from "swr";
import {
    CheckCircle,
    XCircle,
    Clock,
    Loader2,
    CalendarRange,
    UserCircle2,
    Download,
    Briefcase,
    Thermometer,
    Palmtree,
} from "lucide-react";
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
import {
    mapLeaveRowToCSV,
    type LeaveRequestRow,
} from "@/lib/helpers/csv-helpers";
import { generateFilename } from "@/lib/helpers/date-helpers";

const fetcher = async <T,>(url: string): Promise<T> => {
    const res = await apiGet<T>(url);
    if (!res.success) throw new Error(res.error || "Failed to fetch");
    return res.data as T;
};

const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
        case "APPROVED":
            return (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    อนุมัติแล้ว
                </span>
            );
        case "REJECTED":
            return (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    ไม่อนุมัติ
                </span>
            );
        case "CANCELLED":
            return (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    ยกเลิก
                </span>
            );
        default:
            return (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    รอดำเนินการ
                </span>
            );
    }
};

export function ManagerApprovalDashboard() {
    const { pending, history, isLoading, mutate } = useLeaveApprovals();
    const [selectedLeave, setSelectedLeave] = useState<PendingLeave | null>(
        null,
    );
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // Export state
    const currentYear = new Date().getFullYear();
    const [availableYears, setAvailableYears] = useState<number[]>([
        currentYear,
    ]);
    const [exportYear, setExportYear] = useState(currentYear);
    const [isExporting, setIsExporting] = useState(false);
    const [exportData, setExportData] = useState<
        Record<string, string | number>[]
    >([]);
    const csvLinkRef = useRef<
        CSVLink & HTMLAnchorElement & { link: HTMLAnchorElement }
    >(null);
    const { data: yearsData } = useSWR<{ years: number[] }>(
        "/api/leave/export?yearsOnly=1",
        fetcher,
        {
            revalidateOnFocus: false,
            shouldRetryOnError: false,
        },
    );

    useEffect(() => {
        if (yearsData?.years && yearsData.years.length > 0) {
            setAvailableYears(yearsData.years);
            setExportYear(yearsData.years[0]);
        }
    }, [yearsData]);

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
            const res = await apiGet<{ data: LeaveRequestRow[] }>(
                `/api/leave/export?year=${exportYear}`,
            );
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

    const handleAction = async (
        action: "APPROVE" | "REJECT",
        leaveId: string,
        reason?: string,
    ) => {
        setIsProcessing(true);
        try {
            const res = await apiPost("/api/leave/intranet-action", {
                leaveId,
                action,
                reason,
            });

            if (res.success) {
                toast.success(
                    action === "APPROVE"
                        ? "อนุมัติใบลาเรียบร้อยแล้ว"
                        : "ปฏิเสธใบลาเรียบร้อยแล้ว",
                );
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                        รายการรอพิจารณา (Pending Approvals)
                    </h2>
                    <p className="text-sm text-gray-500">
                        ใบลาคงค้างของพนักงานในทีมที่รอรับการอนุมัติ
                    </p>
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
                        filename={generateFilename(
                            `รายงานการลา_ปี-${exportYear}`,
                            "csv",
                        )}
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
                        <p className="text-lg font-medium text-gray-700">
                            ไม่มีคำขอที่ต้องพิจารณา
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            ยอดเยี่ยม! คุณตรวจสอบใบลาครบทั้งหมดแล้ว
                        </p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-4">
                    {pending.map((leave) => (
                        <Card
                            key={leave.id}
                            className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 hover:border-indigo-100"
                        >
                            <div className="flex flex-col lg:flex-row gap-6 p-5 sm:p-6">
                                {/* Left: User Info & Reason */}
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex gap-4">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-600 ring-4 ring-white shadow-sm">
                                                <UserCircle2 className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900 text-base">
                                                    {leave.employee.firstName} {leave.employee.lastName}
                                                    {leave.employee.nickname && (
                                                        <span className="text-gray-500 font-normal ml-1">({leave.employee.nickname})</span>
                                                    )}
                                                </h3>
                                                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                                                    <Briefcase className="w-3.5 h-3.5" />
                                                    {leave.employee.position} <span className="text-gray-300">&bull;</span> {leave.employee.dept?.name}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Leave Details Box */}
                                    <div className="rounded-xl border border-indigo-50/80 bg-indigo-50/30 p-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภทการลา</p>
                                                <div className="flex items-center text-sm font-semibold text-indigo-700">
                                                    {leave.leaveType === "SICK" ? (
                                                        <><Thermometer className="w-4 h-4 mr-1.5 text-indigo-500" /> ลาป่วย</>
                                                    ) : leave.leaveType === "PERSONAL" ? (
                                                        <><Briefcase className="w-4 h-4 mr-1.5 text-indigo-500" /> ลากิจ</>
                                                    ) : (
                                                        <><Palmtree className="w-4 h-4 mr-1.5 text-indigo-500" /> ลาพักร้อน</>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">ระยะเวลา</p>
                                                <div className="flex items-center text-sm font-medium text-gray-900">
                                                    <CalendarRange className="w-4 h-4 mr-1.5 text-gray-400" />
                                                    <span>
                                                        {new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(new Date(leave.startDate))}
                                                        {leave.startDate !== leave.endDate && ` - ${new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(new Date(leave.endDate))}`}
                                                    </span>
                                                    <span className="ml-2 inline-flex items-center rounded-md bg-white px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                                                        {leave.durationDays} วัน ({leave.period === "FULL_DAY" ? "เต็มวัน" : leave.period === "MORNING" ? "เช้า" : "บ่าย"})
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {leave.reason && (
                                            <div className="mt-3 pt-3 border-t border-indigo-100/50">
                                                <p className="text-sm leading-relaxed text-gray-700">
                                                    <span className="font-medium text-gray-900 mr-2">เหตุผล:</span>
                                                    {leave.reason}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="text-xs text-gray-400 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        ยื่นใบลาเมื่อ {new Intl.DateTimeFormat("th-TH", {
                                            day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                                        }).format(new Date(leave.createdAt))}
                                    </div>
                                </div>

                                {/* Right: Actions */}
                                <div className="flex lg:flex-col justify-end gap-3 pt-4 lg:pt-0 lg:pl-6 border-t lg:border-t-0 lg:border-l border-gray-100 lg:min-w-[140px]">
                                    <Button
                                        onClick={() => handleAction("APPROVE", leave.id)}
                                        disabled={isProcessing}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-200 transition-all hover:shadow-md lg:hover:-translate-y-0.5"
                                    >
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        อนุมัติ
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setSelectedLeave(leave);
                                            setIsRejectDialogOpen(true);
                                        }}
                                        disabled={isProcessing}
                                        variant="outline"
                                        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all"
                                    >
                                        <XCircle className="w-4 h-4 mr-2" />
                                        ไม่อนุมัติ
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <div className="mt-12">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    ประวัติการพิจารณา (Approval History)
                </h2>
                {history.length === 0 ? (
                    <Card className="shadow-sm border-gray-100 p-8 text-center text-gray-500">
                        ยังไม่มีข้อมูลการพิจารณาในระบบ
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {history.map((leave) => (
                            <Card
                                key={leave.id}
                                className="shadow-sm border-gray-100 p-4 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
                            >
                                <div>
                                    <p className="font-medium text-gray-800 text-sm">
                                        {leave.employee.firstName}{" "}
                                        {leave.employee.lastName}
                                        <span className="text-gray-400 font-normal ml-2">
                                            ยื่นลา
                                            {leave.leaveType === "SICK"
                                                ? "ป่วย"
                                                : leave.leaveType === "PERSONAL"
                                                  ? "กิจ"
                                                  : "พักร้อน"}
                                        </span>
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        วันที่:{" "}
                                        {new Intl.DateTimeFormat("th-TH", {
                                            day: "numeric",
                                            month: "short",
                                            year: "2-digit",
                                        }).format(new Date(leave.startDate))}
                                        {leave.startDate !== leave.endDate &&
                                            ` - ${new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(leave.endDate))}`}
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
            <Dialog
                open={isRejectDialogOpen}
                onOpenChange={setIsRejectDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>เหตุผลที่ไม่อนุมัติ</DialogTitle>
                        <DialogDescription>
                            กรุณาระบุเหตุผลที่ปฏิเสธการลางานของ{" "}
                            {selectedLeave?.employee.firstName}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="ระบุเหตุผลที่นี่เพื่อแจ้งให้พนักงานทราบ…"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="resize-none"
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsRejectDialogOpen(false)}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => {
                                if (selectedLeave) {
                                    handleAction(
                                        "REJECT",
                                        selectedLeave.id,
                                        rejectReason,
                                    );
                                }
                            }}
                            disabled={!rejectReason.trim() || isProcessing}
                        >
                            {isProcessing && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            ยืนยันการปฏิเสธ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
