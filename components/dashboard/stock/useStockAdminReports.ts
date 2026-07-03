"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    downloadStockBalanceReportFile,
    downloadStockRequestReportFile,
    fetchStockBalanceMeta,
    fetchStockReportMeta,
    fetchStockReportYears,
    type StockBalanceMetaResponse,
    type StockReportMetaResponse,
} from "@/lib/services/stock/client";

export function useStockAdminReports() {
    const currentYear = new Date().getFullYear();
    const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [isLoadingYears, setIsLoadingYears] = useState(true);
    const [isLoadingMeta, setIsLoadingMeta] = useState(true);
    const [isLoadingBalanceMeta, setIsLoadingBalanceMeta] = useState(true);
    const [isExportingReport, setIsExportingReport] = useState(false);
    const [isExportingBalance, setIsExportingBalance] = useState(false);
    const [meta, setMeta] = useState<StockReportMetaResponse | null>(null);
    const [balanceMeta, setBalanceMeta] = useState<StockBalanceMetaResponse | null>(null);
    const reportExportLockRef = useRef(false);
    const balanceExportLockRef = useRef(false);

    useStockReportYears(currentYear, setAvailableYears, setSelectedYear, setIsLoadingYears);
    useStockReportMeta(selectedYear, setMeta, setIsLoadingMeta);
    useStockBalanceMeta(setBalanceMeta, setIsLoadingBalanceMeta);

    async function handleReportExport(): Promise<void> {
        if (reportExportLockRef.current) {
            return;
        }

        reportExportLockRef.current = true;
        setIsExportingReport(true);
        try {
            const exportMeta = await fetchStockReportMeta(selectedYear);
            if (!canExportStockReport(exportMeta, selectedYear)) {
                return;
            }

            downloadStockRequestReportFile(selectedYear);
            toast.success("เริ่มดาวน์โหลดไฟล์แล้ว", {
                description: `กำลังส่งออกรายงานวัสดุ ${exportMeta.count} รายการ (ปี ${selectedYear})`,
            });
        } catch (error) {
            toast.error("เกิดข้อผิดพลาดในการดาวน์โหลดรีพอร์ตวัสดุ", {
                description: getErrorDescription(error),
            });
        } finally {
            reportExportLockRef.current = false;
            setIsExportingReport(false);
        }
    }

    async function handleBalanceExport(): Promise<void> {
        if (balanceExportLockRef.current) {
            return;
        }

        balanceExportLockRef.current = true;
        setIsExportingBalance(true);
        try {
            const exportMeta = await fetchStockBalanceMeta();
            if (!canExportStockBalance(exportMeta)) {
                return;
            }

            downloadStockBalanceReportFile();
            toast.success("เริ่มดาวน์โหลดไฟล์แล้ว", {
                description: `กำลังส่งออกยอดคงเหลือสต๊อก ${exportMeta.count} รายการ`,
            });
        } catch (error) {
            toast.error("เกิดข้อผิดพลาดในการดาวน์โหลดสต๊อกคงเหลือ", {
                description: getErrorDescription(error),
            });
        } finally {
            balanceExportLockRef.current = false;
            setIsExportingBalance(false);
        }
    }

    return {
        availableYears,
        selectedYear,
        setSelectedYear,
        isPageLoading: isLoadingYears || isLoadingMeta || isLoadingBalanceMeta,
        isExportingReport,
        isExportingBalance,
        isReportDisabled: isExportingReport || isExportUnavailable(meta),
        isBalanceDisabled: isExportingBalance || isExportUnavailable(balanceMeta),
        reportExportLabel: isExportingReport ? "กำลังเตรียมไฟล์" : "ดาวน์โหลด Excel",
        balanceExportLabel: isExportingBalance
            ? "กำลังเตรียมไฟล์"
            : "ดาวน์โหลดสต๊อกคงเหลือ",
        reportExportState: resolveExportState(meta, isLoadingMeta, isExportingReport),
        balanceExportState: resolveExportState(
            balanceMeta,
            isLoadingBalanceMeta,
            isExportingBalance,
        ),
        meta,
        balanceMeta,
        handleReportExport,
        handleBalanceExport,
    };
}

function useStockReportYears(
    currentYear: number,
    setAvailableYears: (years: number[]) => void,
    setSelectedYear: (setter: (previous: number) => number) => void,
    setIsLoadingYears: (value: boolean) => void,
): void {
    useEffect(() => {
        let isCancelled = false;

        async function loadYears(): Promise<void> {
            setIsLoadingYears(true);
            try {
                const data = await fetchStockReportYears();
                if (isCancelled) return;

                const years = data.years.length > 0 ? data.years : [currentYear];
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
    }, [currentYear, setAvailableYears, setIsLoadingYears, setSelectedYear]);
}

function useStockReportMeta(
    selectedYear: number,
    setMeta: (meta: StockReportMetaResponse | null) => void,
    setIsLoadingMeta: (value: boolean) => void,
): void {
    useEffect(() => {
        let isCancelled = false;

        async function loadMeta(): Promise<void> {
            setIsLoadingMeta(true);
            try {
                const data = await fetchStockReportMeta(selectedYear);
                if (!isCancelled) {
                    setMeta(data);
                }
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
    }, [selectedYear, setIsLoadingMeta, setMeta]);
}

function useStockBalanceMeta(
    setBalanceMeta: (meta: StockBalanceMetaResponse | null) => void,
    setIsLoadingBalanceMeta: (value: boolean) => void,
): void {
    useEffect(() => {
        let isCancelled = false;

        async function loadBalanceMeta(): Promise<void> {
            setIsLoadingBalanceMeta(true);
            try {
                const data = await fetchStockBalanceMeta();
                if (!isCancelled) {
                    setBalanceMeta(data);
                }
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
    }, [setBalanceMeta, setIsLoadingBalanceMeta]);
}

function canExportStockReport(meta: StockReportMetaResponse, year: number): boolean {
    if (meta.year !== year) {
        toast.error("ปีของรีพอร์ตไม่ตรงกับที่เลือก", {
            description: "กรุณาลองเลือกปีใหม่แล้วดาวน์โหลดอีกครั้ง",
        });
        return false;
    }

    if (meta.count === 0) {
        toast.error("ไม่มีข้อมูลการจ่ายวัสดุสำหรับปีที่เลือก");
        return false;
    }

    if (meta.count > meta.maxRows) {
        toast.error("ข้อมูลเกินขนาดที่กำหนด", {
            description: `ส่งออกรายงานเบิกวัสดุได้ไม่เกิน ${meta.maxRows} รายการต่อครั้ง กรุณาเลือกปีที่มีข้อมูลน้อยลง`,
        });
        return false;
    }

    return true;
}

function canExportStockBalance(meta: StockBalanceMetaResponse): boolean {
    if (meta.count === 0) {
        toast.error("ไม่มีข้อมูลสต๊อกคงเหลือสำหรับดาวน์โหลด");
        return false;
    }

    if (meta.count > meta.maxRows) {
        toast.error("ข้อมูลเกินขนาดที่กำหนด", {
            description: `ส่งออกยอดคงเหลือสต๊อกได้ไม่เกิน ${meta.maxRows} รายการต่อครั้ง`,
        });
        return false;
    }

    return true;
}

function resolveExportState(
    meta: StockBalanceMetaResponse | StockReportMetaResponse | null,
    isLoading: boolean,
    isExporting: boolean,
): string {
    if (isExporting) return "กำลังเริ่มดาวน์โหลด";
    if (isLoading) return "กำลังตรวจสอบ";
    if (!meta || meta.count === 0) return "ไม่มีข้อมูล";
    if (meta.count > meta.maxRows) return `เกิน ${meta.maxRows} รายการ`;
    return "พร้อมดาวน์โหลด";
}

function isExportUnavailable(
    meta: StockBalanceMetaResponse | StockReportMetaResponse | null,
): boolean {
    return !meta || meta.count === 0 || meta.count > meta.maxRows;
}

function getErrorDescription(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }
    return "กรุณาลองใหม่อีกครั้ง";
}
