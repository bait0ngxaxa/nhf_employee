"use client";

import { useEffect, useState } from "react";
import { BarChart3, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { triggerDownload } from "@/lib/helpers/download";
import { API_ROUTES } from "@/lib/ssot/routes";
import { YearlyReportExportPanel } from "@/components/dashboard/shared/YearlyReportExportPanel";

type StockReportYearsResponse = {
    years: number[];
};

type StockReportMetaResponse = {
    year: number;
    count: number;
    maxRows: number;
};

export function StockAdminReports() {
    const currentYear = new Date().getFullYear();
    const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [isLoadingYears, setIsLoadingYears] = useState(true);
    const [isLoadingMeta, setIsLoadingMeta] = useState(true);
    const [meta, setMeta] = useState<StockReportMetaResponse | null>(null);

    useEffect(() => {
        let isCancelled = false;

        async function loadYears(): Promise<void> {
            setIsLoadingYears(true);
            const result = await apiGet<StockReportYearsResponse>(
                `${API_ROUTES.stock.reportsExport}?yearsOnly=1`,
            );

            if (isCancelled) {
                return;
            }

            if (!result.success) {
                toast.error(result.errorThai);
                setAvailableYears([currentYear]);
                setIsLoadingYears(false);
                return;
            }

            const years = result.data.years.length > 0 ? result.data.years : [currentYear];
            setAvailableYears(years);
            setSelectedYear((previous) =>
                years.includes(previous) ? previous : years[0],
            );
            setIsLoadingYears(false);
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
            const result = await apiGet<StockReportMetaResponse>(
                `${API_ROUTES.stock.reportsExport}?metaOnly=1&year=${selectedYear}`,
            );

            if (isCancelled) {
                return;
            }

            if (!result.success) {
                toast.error(result.errorThai);
                setMeta(null);
                setIsLoadingMeta(false);
                return;
            }

            setMeta(result.data);
            setIsLoadingMeta(false);
        }

        void loadMeta();

        return () => {
            isCancelled = true;
        };
    }, [selectedYear]);

    const isDisabled =
        isLoadingYears ||
        isLoadingMeta ||
        !meta ||
        meta.count === 0 ||
        meta.count > meta.maxRows;

    return (
        <div className="space-y-5">
            <YearlyReportExportPanel
                availableYears={availableYears}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                onExport={() =>
                    triggerDownload(
                        `${API_ROUTES.stock.reportsExport}?format=csv&year=${selectedYear}`,
                    )
                }
                isExporting={isLoadingMeta}
                disabled={isDisabled}
                selectAriaLabel="เลือกปีรีพอร์ตวัสดุ"
                layout="card"
                selectClassName="h-11"
                buttonClassName="h-11 bg-[linear-gradient(135deg,#ea580c,#dc2626)] text-white shadow-[0_20px_36px_-24px_rgba(220,38,38,0.95)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#ea580c,#dc2626)] hover:text-white hover:shadow-[0_24px_40px_-22px_rgba(220,38,38,0.95)]"
                badge={
                    <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white/80 px-3 py-1 text-xs font-semibold text-orange-700 shadow-sm">
                        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                        ADMIN REPORTS
                    </div>
                }
                title="รีพอร์ตการเบิกวัสดุรายปี"
                description="เลือกปีที่ต้องการ แล้วดาวน์โหลดรายงานคำขอเบิกวัสดุในรูปแบบ CSV"
                stats={[
                    {
                        icon: <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />,
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
                        value: resolveExportState(meta, isLoadingMeta),
                    },
                ]}
            />
        </div>
    );
}

function resolveExportState(
    meta: StockReportMetaResponse | null,
    isLoadingMeta: boolean,
): string {
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
