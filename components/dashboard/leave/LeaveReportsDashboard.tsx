"use client";

import { useEffect, useState } from "react";
import { BarChart3, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { YearlyReportExportPanel } from "@/components/dashboard/shared/YearlyReportExportPanel";
import {
    downloadLeaveExportFile,
    fetchLeaveExportMeta,
    fetchLeaveExportYears,
    type LeaveExportMetaResponse,
} from "@/lib/services/leave/client";
import { getCurrentLeaveYear } from "@/lib/services/leave/quota-year";
import { LEAVE_THEME_BUTTON_CLASS } from "./leaveTheme";

export function LeaveReportsDashboard() {
    const currentYear = getCurrentLeaveYear();
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
                const data = await fetchLeaveExportYears();
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
    }, [currentYear]);

    useEffect(() => {
        let isCancelled = false;

        async function loadMeta(): Promise<void> {
            setIsLoadingMeta(true);
            try {
                const data = await fetchLeaveExportMeta(selectedYear);
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
    }, [selectedYear]);

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
            const exportMeta = await fetchLeaveExportMeta(selectedYear);

            if (exportMeta.employeeCount === 0) {
                toast.error("ไม่มีพนักงานในทีมสำหรับรายงาน");
                return;
            }

            if (exportMeta.requestCount > exportMeta.maxRows) {
                toast.error("ข้อมูลเกินขนาดที่กำหนด", {
                    description: `ส่งออกข้อมูลการลาได้ไม่เกิน ${exportMeta.maxRows} รายการต่อครั้ง กรุณาเลือกปีที่มีข้อมูลน้อยลง`,
                });
                return;
            }

            downloadLeaveExportFile(selectedYear);
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
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
                        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                        รีพอร์ตผู้จัดการ
                    </div>
                }
                title="รายงานสรุปการลารายปี"
                description="ดาวน์โหลด Excel สรุปรายคนและรายละเอียดคำขอลาของทีมตามปีที่เลือก"
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
                        value: resolveExportState(meta, isLoadingMeta, isExporting),
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
): string {
    if (isExporting) {
        return "กำลังเริ่มดาวน์โหลด";
    }

    if (isLoadingMeta) {
        return "กำลังตรวจสอบ";
    }

    if (!meta || meta.employeeCount === 0) {
        return "ไม่มีพนักงานในทีม";
    }

    if (meta.requestCount > meta.maxRows) {
        return `เกิน ${meta.maxRows} รายการ`;
    }

    return "พร้อมดาวน์โหลด";
}
