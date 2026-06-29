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
import { apiGet } from "@/lib/client/api-client";
import { triggerDownload } from "@/lib/helpers/download";
import { API_ROUTES } from "@/lib/ssot/routes";
import { YearlyReportExportPanel } from "@/components/dashboard/shared/YearlyReportExportPanel";
import { StockLoadingState } from "./StockLoadingState";

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
            try {
                const result = await apiGet<StockReportYearsResponse>(
                    `${API_ROUTES.stock.reportsExport}?yearsOnly=1`,
                );

                if (isCancelled) {
                    return;
                }

                if (!result.success) {
                    toast.error(result.errorThai);
                    setAvailableYears([currentYear]);
                    return;
                }

                const years = result.data.years.length > 0 ? result.data.years : [currentYear];
                setAvailableYears(years);
                setSelectedYear((previous) =>
                    years.includes(previous) ? previous : years[0],
                );
            } catch {
                if (!isCancelled) {
                    toast.error("โหลดปีรีพอร์ตไม่สำเร็จ");
                    setAvailableYears([currentYear]);
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
                const result = await apiGet<StockReportMetaResponse>(
                    `${API_ROUTES.stock.reportsExport}?metaOnly=1&year=${selectedYear}`,
                );

                if (isCancelled) {
                    return;
                }

                if (!result.success) {
                    toast.error(result.errorThai);
                    setMeta(null);
                    return;
                }

                setMeta(result.data);
            } catch {
                if (!isCancelled) {
                    toast.error("โหลดข้อมูลรีพอร์ตไม่สำเร็จ");
                    setMeta(null);
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

    useEffect(() => {
        let isCancelled = false;

        async function loadBalanceMeta(): Promise<void> {
            setIsLoadingBalanceMeta(true);
            try {
                const result = await apiGet<StockBalanceMetaResponse>(
                    `${API_ROUTES.stock.reportsExport}?metaOnly=1&reportType=balances`,
                );

                if (isCancelled) {
                    return;
                }

                if (!result.success) {
                    toast.error(result.errorThai);
                    setBalanceMeta(null);
                    return;
                }

                setBalanceMeta(result.data);
            } catch {
                if (!isCancelled) {
                    toast.error("โหลดข้อมูลสต๊อกคงเหลือไม่สำเร็จ");
                    setBalanceMeta(null);
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingBalanceMeta(false);
                }
            }
        }

        void loadBalanceMeta();

        return () => {
            isCancelled = true;
        };
    }, []);

    const isDisabled =
        !meta ||
        meta.count === 0 ||
        meta.count > meta.maxRows;
    const isBalanceDisabled =
        !balanceMeta ||
        balanceMeta.count === 0 ||
        balanceMeta.count > balanceMeta.maxRows;

    if (isLoadingYears || isLoadingMeta || isLoadingBalanceMeta) {
        return <StockLoadingState message="กำลังโหลดข้อมูลรีพอร์ต..." />;
    }

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
                buttonClassName="h-11 bg-orange-600 text-white shadow-sm transition-colors duration-200 hover:bg-orange-700 hover:text-white"
                badge={
                    <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white/80 px-3 py-1 text-xs font-semibold text-orange-700 shadow-sm">
                        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                        รายงานผู้ดูแล
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
                        value: `${meta?.count ?? 0} รายการ`,
                    },
                    {
                        icon: <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />,
                        label: "สถานะการส่งออก",
                        value: resolveExportState(meta),
                    },
                ]}
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                            ยอดคงเหลือ
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">
                                ดาวน์โหลดยอดคงเหลือสต๊อก
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
                        className="h-11 rounded-2xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-emerald-800 hover:text-white disabled:text-white/80"
                    >
                        <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
                        ดาวน์โหลดสต๊อกคงเหลือ
                    </Button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <ReportStatCard
                        icon={<Package className="h-4 w-4" aria-hidden="true" />}
                        label="จำนวนวัสดุ"
                        value={`${balanceMeta?.count ?? 0} รายการ`}
                    />
                    <ReportStatCard
                        icon={<Archive className="h-4 w-4" aria-hidden="true" />}
                        label="ขอบเขตข้อมูล"
                        value="ยอดคงเหลือปัจจุบัน"
                    />
                    <ReportStatCard
                        icon={<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
                        label="สถานะการส่งออก"
                        value={resolveExportState(balanceMeta)}
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
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                {icon}
                {label}
            </div>
            <div className="mt-2 text-base font-bold text-slate-800">{value}</div>
        </div>
    );
}

function resolveExportState(
    meta: StockBalanceMetaResponse | StockReportMetaResponse | null,
): string {
    if (!meta || meta.count === 0) {
        return "ไม่มีข้อมูล";
    }

    if (meta.count > meta.maxRows) {
        return `เกิน ${meta.maxRows} รายการ`;
    }

    return "พร้อมดาวน์โหลด";
}
