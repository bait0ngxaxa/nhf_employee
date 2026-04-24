"use client";

import { useEffect, useState } from "react";
import { BarChart3, CalendarRange, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { YearlyReportExportPanel } from "@/components/dashboard/shared/YearlyReportExportPanel";
import {
    downloadLeaveExportFile,
    fetchLeaveExportMeta,
    fetchLeaveExportYears,
    type LeaveExportMetaResponse,
} from "@/lib/services/leave/client";

export function LeaveReportsDashboard() {
    const currentYear = new Date().getFullYear();
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
        meta.count === 0 ||
        meta.count > meta.maxRows;

    async function handleExport(): Promise<void> {
        setIsExporting(true);
        try {
            const exportMeta = await fetchLeaveExportMeta(selectedYear);

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

            downloadLeaveExportFile(selectedYear);
            toast.success("เริ่มดาวน์โหลดไฟล์แล้ว", {
                description: `กำลังส่งออกข้อมูลการลา ${exportMeta.count} รายการ (ปี ${selectedYear})`,
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
                buttonClassName="h-11 bg-[linear-gradient(135deg,#4f46e5,#2563eb)] text-white shadow-[0_20px_36px_-24px_rgba(37,99,235,0.95)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#4f46e5,#2563eb)] hover:text-white hover:shadow-[0_24px_40px_-22px_rgba(37,99,235,0.95)]"
                badge={
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
                        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                        MANAGER REPORTS
                    </div>
                }
                title="รีพอร์ตการลารายปี"
                description="สำหรับผู้จัดการ ใช้ดึงรายงานการลาของทีมตามปีที่ต้องการในรูปแบบ CSV"
                stats={[
                    {
                        icon: <CalendarRange className="h-4 w-4" aria-hidden="true" />,
                        label: "ปีที่เลือก",
                        value: String(selectedYear),
                    },
                    {
                        icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
                        label: "จำนวนรายการ",
                        value: isLoadingMeta ? "กำลังโหลด..." : `${meta?.count ?? 0} รายการ`,
                    },
                    {
                        icon: <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />,
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

    if (!meta || meta.count === 0) {
        return "ไม่มีข้อมูล";
    }

    if (meta.count > meta.maxRows) {
        return `เกิน ${meta.maxRows} รายการ`;
    }

    return "พร้อมดาวน์โหลด";
}
