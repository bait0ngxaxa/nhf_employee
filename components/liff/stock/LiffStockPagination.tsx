import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";

interface LiffStockPaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function LiffStockPagination({
    page,
    totalPages,
    onPageChange,
}: LiffStockPaginationProps): ReactElement | null {
    if (totalPages <= 1) return null;

    return (
        <nav
            aria-label="เปลี่ยนหน้ารายการ Stock"
            className="flex items-center justify-between gap-3 rounded-2xl bg-surface-raised p-2 shadow-sm ring-1 ring-border-subtle"
        >
            <Button
                type="button"
                variant="ghost"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                aria-label="หน้าก่อนหน้า"
                className="min-h-11 rounded-xl px-3"
            >
                <ChevronLeft className="size-4" aria-hidden="true" />
                ก่อนหน้า
            </Button>
            <span className="text-sm font-semibold tabular-nums text-content-secondary">
                หน้า {page} / {totalPages}
            </span>
            <Button
                type="button"
                variant="ghost"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                aria-label="หน้าถัดไป"
                className="min-h-11 rounded-xl px-3"
            >
                ถัดไป
                <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
        </nav>
    );
}
