"use client";

import type { ReactNode } from "react";
import {
    Archive,
    BarChart3,
    FileSpreadsheet,
    Loader2,
    Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { YearlyReportExportPanel } from "@/components/dashboard/shared/YearlyReportExportPanel";
import { StockLoadingState } from "./StockLoadingState";
import { useStockAdminReports } from "./useStockAdminReports";

export function StockAdminReports() {
    const reports = useStockAdminReports();

    if (reports.isPageLoading) {
        return <StockLoadingState message="กำลังโหลดข้อมูลรีพอร์ต..." />;
    }

    return (
        <div className="space-y-5">
            <YearlyReportExportPanel
                availableYears={reports.availableYears}
                selectedYear={reports.selectedYear}
                onYearChange={reports.setSelectedYear}
                onExport={() => void reports.handleReportExport()}
                isExporting={reports.isExportingReport}
                disabled={reports.isReportDisabled}
                selectAriaLabel="เลือกปีรีพอร์ตวัสดุ"
                layout="card"
                selectClassName="h-11"
                buttonClassName="h-11 bg-orange-600 text-white shadow-sm transition-colors duration-200 hover:bg-orange-700 hover:text-white"
                exportLabel={reports.reportExportLabel}
                badge={
                    <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white/80 px-3 py-1 text-xs font-semibold text-orange-700 shadow-sm">
                        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                        รายงานผู้ดูแล
                    </div>
                }
                title="รีพอร์ตการใช้วัสดุรายปี"
                description="ดาวน์โหลด Excel สรุปยอดจ่ายจริงแยกตามวัสดุและรายการย่อย"
                stats={[
                    {
                        icon: <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />,
                        label: "ปีที่เลือก",
                        value: String(reports.selectedYear),
                    },
                    {
                        icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
                        label: "จำนวนรายการที่จ่าย",
                        value: `${reports.meta?.count ?? 0} รายการ`,
                    },
                    {
                        icon: <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />,
                        label: "สถานะการส่งออก",
                        value: reports.reportExportState,
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
                                ดาวน์โหลด Excel ยอดคงเหลือจริง แยกตามรายการย่อย พร้อมยอดจองและพร้อมใช้
                            </p>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        disabled={reports.isBalanceDisabled}
                        onClick={() => void reports.handleBalanceExport()}
                        aria-busy={reports.isExportingBalance}
                        className="h-11 rounded-2xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-emerald-800 hover:text-white disabled:text-white/80"
                    >
                        {reports.isExportingBalance ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
                        )}
                        {reports.balanceExportLabel}
                    </Button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <ReportStatCard
                        icon={<Package className="h-4 w-4" aria-hidden="true" />}
                        label="จำนวนวัสดุ"
                        value={`${reports.balanceMeta?.count ?? 0} รายการ`}
                    />
                    <ReportStatCard
                        icon={<Archive className="h-4 w-4" aria-hidden="true" />}
                        label="ขอบเขตข้อมูล"
                        value="ยอดคงเหลือปัจจุบัน"
                    />
                    <ReportStatCard
                        icon={<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
                        label="สถานะการส่งออก"
                        value={reports.balanceExportState}
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
