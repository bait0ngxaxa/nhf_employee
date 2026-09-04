"use client";

import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { YearlyReportExportPanel } from "@/components/dashboard/shared/YearlyReportExportPanel";
import { StockReportsSkeleton } from "./StockSkeletons";
import { useStockAdminReports } from "./useStockAdminReports";

export function StockAdminReports() {
    const reports = useStockAdminReports();

    if (reports.isPageLoading) {
        return <StockReportsSkeleton />;
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
                buttonClassName="h-11 bg-module-stock-solid text-content-on-brand shadow-sm transition-colors duration-200 hover:bg-module-stock-solid-hover hover:text-content-on-brand"
                exportLabel={reports.reportExportLabel}
                badge={
                    <div className="inline-flex rounded-full border border-module-stock-badge-border bg-surface-raised/80 px-3 py-1 text-xs font-semibold text-module-stock-badge-foreground shadow-sm">
                        รายงานผู้ดูแล
                    </div>
                }
                title="รีพอร์ตการใช้วัสดุรายปี"
                description="ดาวน์โหลด Excel สรุปยอดจ่ายจริงแยกตามวัสดุและรายการย่อย"
                stats={[
                    {
                        label: "ปีที่เลือก",
                        value: String(reports.selectedYear),
                    },
                    {
                        label: "จำนวนรายการที่จ่าย",
                        value: `${reports.meta?.count ?? 0} รายการ`,
                    },
                    {
                        label: "สถานะการส่งออก",
                        value: reports.reportExportState,
                    },
                ]}
            />

            <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex rounded-full border border-status-success-border-subtle bg-surface-raised/80 px-3 py-1 text-xs font-semibold text-status-success-foreground shadow-sm">
                            ยอดคงเหลือ
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-content-strong">
                                ดาวน์โหลดยอดคงเหลือสต๊อก
                            </h3>
                            <p className="text-sm text-content-muted">
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
                        className="h-11 rounded-2xl bg-status-success-solid-hover px-5 text-sm font-semibold text-content-on-brand shadow-sm transition-colors duration-200 hover:bg-status-success-solid-strong hover:text-content-on-brand disabled:text-content-on-brand/80"
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
                        label="จำนวนวัสดุ"
                        value={`${reports.balanceMeta?.count ?? 0} รายการ`}
                    />
                    <ReportStatCard
                        label="ขอบเขตข้อมูล"
                        value="ยอดคงเหลือปัจจุบัน"
                    />
                    <ReportStatCard
                        label="สถานะการส่งออก"
                        value={reports.balanceExportState}
                    />
                </div>
            </div>
        </div>
    );
}

function ReportStatCard({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-border-subtle bg-surface-subtle/70 p-4">
            <div className="text-xs font-semibold text-content-muted">{label}</div>
            <div className="mt-2 text-base font-bold text-content-strong">{value}</div>
        </div>
    );
}
