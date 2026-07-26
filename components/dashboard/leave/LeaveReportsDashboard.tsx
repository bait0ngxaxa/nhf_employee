"use client";

import { useEffect, useState } from "react";
import { BarChart3, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { YearlyReportExportPanel } from "@/components/dashboard/shared/YearlyReportExportPanel";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    downloadLeaveExportFile,
    fetchLeaveExportMeta,
    fetchLeaveExportYears,
    type LeaveExportMetaResponse,
} from "@/lib/services/leave/client";
import { getCurrentLeaveYear } from "@/lib/services/leave/quota-year";
import {
    DEFAULT_LEAVE_REPORT_SCOPE,
    type LeaveReportScope,
} from "@/lib/validations/leave-report";
import { LEAVE_THEME_BUTTON_CLASS } from "./leaveTheme";

export function LeaveReportsDashboard() {
    const currentYear = getCurrentLeaveYear();
    const [scope, setScope] = useState<LeaveReportScope>(DEFAULT_LEAVE_REPORT_SCOPE);
    const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [isLoadingYears, setIsLoadingYears] = useState(true);
    const [isLoadingMeta, setIsLoadingMeta] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [meta, setMeta] = useState<LeaveExportMetaResponse | null>(null);

    useEffect(() => {
        let isCancelled = false;

        async function loadYears(): Promise<void> {
            setIsLoadingYears(true);
            try {
                const data = await fetchLeaveExportYears(scope);
                if (isCancelled) {
                    return;
                }

                const years = data.years.length > 0 ? data.years : [currentYear];
                setAvailableYears(years);
                setSelectedYear((previous) =>
                    years.includes(previous) ? previous : years[0],
                );
            } catch {
                if (!isCancelled) {
                    toast.error("ไม่สามารถดึงปีของรีพอร์ตการลาได้");
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingYears(false);
                }
            }
        }

        void loadYears();

        return () => {
            isCancelled = true;
        };
    }, [currentYear, scope]);

    useEffect(() => {
        let isCancelled = false;

        async function loadMeta(): Promise<void> {
            setIsLoadingMeta(true);
            try {
                const data = await fetchLeaveExportMeta(selectedYear, scope);
                if (!isCancelled) {
                    setMeta(data);
                }
            } catch {
                if (!isCancelled) {
                    setMeta(null);
                    toast.error("ไม่สามารถตรวจสอบข้อมูลรีพอร์ตการลาได้");
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingMeta(false);
                }
            }
        }

        void loadMeta();

        return () => {
            isCancelled = true;
        };
    }, [scope, selectedYear]);

    const isDisabled =
        isLoadingYears ||
        isLoadingMeta ||
        isExporting ||
        !meta ||
        meta.employeeCount === 0 ||
        meta.requestCount > meta.maxRows;

    async function handleExport(): Promise<void> {
        setIsExporting(true);
        try {
            const exportMeta = await fetchLeaveExportMeta(selectedYear, scope);

            if (exportMeta.employeeCount === 0) {
                toast.error(getEmptyReportMessage(scope));
                return;
            }

            if (exportMeta.requestCount > exportMeta.maxRows) {
                toast.error("ข้อมูลเกินขนาดที่กำหนด", {
                    description: `ส่งออกข้อมูลการลาได้ไม่เกิน ${exportMeta.maxRows} รายการต่อครั้ง กรุณาเลือกปีที่มีข้อมูลน้อยลง`,
                });
                return;
            }

            downloadLeaveExportFile(selectedYear, scope);
            toast.success("เริ่มดาวน์โหลดไฟล์แล้ว", {
                description: `กำลังส่งออกรายงานพนักงาน ${exportMeta.employeeCount} คน / คำขอ ${exportMeta.requestCount} รายการ (ปี ${selectedYear})`,
            });
        } catch {
            toast.error("เกิดข้อผิดพลาดในการดาวน์โหลด");
        } finally {
            window.setTimeout(() => setIsExporting(false), 500);
        }
    }

    return (
        <div className="space-y-5">
            <YearlyReportExportPanel
                availableYears={availableYears}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                onExport={() => void handleExport()}
                isExporting={isExporting}
                disabled={isDisabled}
                selectAriaLabel="เลือกปีรีพอร์ตการลา"
                layout="card"
                selectClassName="h-11"
                buttonClassName={`h-11 ${LEAVE_THEME_BUTTON_CLASS}`}
                exportLabel="ดาวน์โหลด Excel"
                badge={
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
                            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                            {getScopeLabel(scope)}
                        </div>
                        <div className="space-y-1.5">
                            <label
                                className="text-sm font-semibold text-slate-700"
                                htmlFor="leave-report-scope"
                            >
                                ประเภทรีพอร์ต
                            </label>
                            <Select
                                value={scope}
                                onValueChange={(value) => setScope(value as LeaveReportScope)}
                                disabled={isExporting}
                            >
                                <SelectTrigger
                                    id="leave-report-scope"
                                    className="h-10 w-full max-w-sm bg-white"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="approver-history">
                                        ประวัติการอนุมัติของฉัน
                                    </SelectItem>
                                    <SelectItem value="current-team">ทีมปัจจุบัน</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                }
                title="รายงานสรุปการลารายปี"
                description={getScopeDescription(scope)}
                stats={[
                    {
                        icon: <CalendarRange className="h-4 w-4" aria-hidden="true" />,
                        label: "ปีที่เลือก",
                        value: String(selectedYear),
                    },
                    {
                        icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
                        label: "ข้อมูลรายงาน",
                        value: isLoadingMeta
                            ? "กำลังโหลด..."
                            : `พนักงาน ${meta?.employeeCount ?? 0} คน / คำขอ ${meta?.requestCount ?? 0} รายการ`,
                    },
                    {
                        label: "สถานะการส่งออก",
                        value: resolveExportState(meta, isLoadingMeta, isExporting, scope),
                    },
                ]}
            />
        </div>
    );
}

function resolveExportState(
    meta: LeaveExportMetaResponse | null,
    isLoadingMeta: boolean,
    isExporting: boolean,
    scope: LeaveReportScope,
): string {
    if (isExporting) {
        return "กำลังเริ่มดาวน์โหลด";
    }

    if (isLoadingMeta) {
        return "กำลังตรวจสอบ";
    }

    if (!meta || meta.employeeCount === 0) {
        return scope === "approver-history"
            ? "ไม่มีประวัติการอนุมัติ"
            : "ไม่มีพนักงานในทีม";
    }

    if (meta.requestCount > meta.maxRows) {
        return `เกิน ${meta.maxRows} รายการ`;
    }

    return "พร้อมดาวน์โหลด";
}

function getScopeLabel(scope: LeaveReportScope): string {
    return scope === "approver-history" ? "ประวัติการอนุมัติ" : "ทีมปัจจุบัน";
}

function getScopeDescription(scope: LeaveReportScope): string {
    return scope === "approver-history"
        ? "ดาวน์โหลด Excel คำขอลาที่คุณเป็นผู้อนุมัติ โดยไม่เปลี่ยนตามหัวหน้าหรือสถานะปัจจุบันของพนักงาน"
        : "ดาวน์โหลด Excel สรุปรายคนและรายละเอียดคำขอลาของพนักงานที่อยู่ในทีมปัจจุบันตามปีที่เลือก";
}

function getEmptyReportMessage(scope: LeaveReportScope): string {
    return scope === "approver-history"
        ? "ไม่มีประวัติการอนุมัติสำหรับรายงาน"
        : "ไม่มีพนักงานในทีมสำหรับรายงาน";
}
