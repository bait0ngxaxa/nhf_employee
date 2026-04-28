"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
    Archive,
    BarChart3,
    FileSpreadsheet,
    Package,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

type StockBalanceMetaResponse = {
    count: number;
    maxRows: number;
};

export function StockAdminReports() {
    const currentYear = new Date().getFullYear();
    const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [isLoadingYears, setIsLoadingYears] = useState(true);
    const [isLoadingMeta, setIsLoadingMeta] = useState(true);
    const [isLoadingBalanceMeta, setIsLoadingBalanceMeta] = useState(true);
    const [meta, setMeta] = useState<StockReportMetaResponse | null>(null);
    const [balanceMeta, setBalanceMeta] = useState<StockBalanceMetaResponse | null>(null);

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

    useEffect(() => {
        let isCancelled = false;

        async function loadBalanceMeta(): Promise<void> {
            setIsLoadingBalanceMeta(true);
            const result = await apiGet<StockBalanceMetaResponse>(
                `${API_ROUTES.stock.reportsExport}?metaOnly=1&reportType=balances`,
            );

            if (isCancelled) {
                return;
            }

            if (!result.success) {
                toast.error(result.errorThai);
                setBalanceMeta(null);
                setIsLoadingBalanceMeta(false);
                return;
            }

            setBalanceMeta(result.data);
            setIsLoadingBalanceMeta(false);
        }

        void loadBalanceMeta();

        return () => {
            isCancelled = true;
        };
    }, []);

    const isDisabled =
        isLoadingYears ||
        isLoadingMeta ||
        !meta ||
        meta.count === 0 ||
        meta.count > meta.maxRows;
    const isBalanceDisabled =
        isLoadingBalanceMeta ||
        !balanceMeta ||
        balanceMeta.count === 0 ||
        balanceMeta.count > balanceMeta.maxRows;

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

            <div className="rounded-[1.9rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(236,253,245,0.96))] p-5 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.28)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                            STOCK BALANCE
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">
                                Export ยอดคงเหลือสต๊อก
                            </h3>
                            <p className="text-sm text-slate-500">
                                ดาวน์โหลดรายการวัสดุคงเหลือปัจจุบัน พร้อมยอดจองและยอดพร้อมใช้ในรูปแบบ CSV
                            </p>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        disabled={isBalanceDisabled}
                        onClick={() =>
                            triggerDownload(
                                `${API_ROUTES.stock.reportsExport}?format=csv&reportType=balances`,
                            )
                        }
                        className="h-11 rounded-2xl bg-[linear-gradient(135deg,#059669,#0f766e)] px-5 text-sm font-semibold text-white shadow-[0_20px_36px_-24px_rgba(15,118,110,0.95)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#059669,#0f766e)] hover:text-white hover:shadow-[0_24px_40px_-22px_rgba(15,118,110,0.95)] disabled:text-white/80"
                    >
                        <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
                        ดาวน์โหลดสต๊อกคงเหลือ
                    </Button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <ReportStatCard
                        icon={<Package className="h-4 w-4" aria-hidden="true" />}
                        label="จำนวนวัสดุ"
                        value={
                            isLoadingBalanceMeta
                                ? "กำลังโหลด..."
                                : `${balanceMeta?.count ?? 0} รายการ`
                        }
                    />
                    <ReportStatCard
                        icon={<Archive className="h-4 w-4" aria-hidden="true" />}
                        label="ขอบเขตข้อมูล"
                        value="ยอดคงเหลือปัจจุบัน"
                    />
                    <ReportStatCard
                        icon={<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
                        label="สถานะการส่งออก"
                        value={resolveExportState(balanceMeta, isLoadingBalanceMeta)}
                    />
                </div>
            </div>
        </div>
    );
}

function ReportStatCard({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {icon}
                {label}
            </div>
            <div className="mt-2 text-base font-bold text-slate-800">{value}</div>
        </div>
    );
}

function resolveExportState(
    meta: StockBalanceMetaResponse | StockReportMetaResponse | null,
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
