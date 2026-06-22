import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onPreviousPage: () => void;
    onNextPage: () => void;
}

interface PaginationControlsProps {
    currentPage: number;
    totalPages: number;
    onPreviousPage: () => void;
    onNextPage: () => void;
}

interface PageNumberListProps {
    items: PaginationItem[];
    currentPage: number;
    onPageChange: (page: number) => void;
}

type PaginationItem = number | "start-ellipsis" | "end-ellipsis";

function getPaginationItems(
    currentPage: number,
    totalPages: number,
): PaginationItem[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    const items: PaginationItem[] = [1];

    if (start > 2) items.push("start-ellipsis");
    for (let page = start; page <= end; page += 1) items.push(page);
    if (end < totalPages - 1) items.push("end-ellipsis");

    items.push(totalPages);
    return items;
}

function PaginationControls({
    currentPage,
    totalPages,
    onPreviousPage,
    onNextPage,
}: PaginationControlsProps): ReactElement {
    return (
        <div className="flex items-center justify-between gap-2 sm:justify-start">
            <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={onPreviousPage}
                disabled={currentPage === 1}
                aria-label="ไปยังหน้าก่อนหน้า"
            >
                <ChevronLeft />
            </Button>
            <p className="text-sm font-medium text-muted-foreground sm:hidden">
                หน้า {currentPage} จาก {totalPages}
            </p>
            <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={onNextPage}
                disabled={currentPage === totalPages}
                aria-label="ไปยังหน้าถัดไป"
            >
                <ChevronRight />
            </Button>
        </div>
    );
}

function PageNumberList({
    items,
    currentPage,
    onPageChange,
}: PageNumberListProps): ReactElement {
    return (
        <div className="hidden items-center gap-1 sm:flex">
            {items.map((item) => {
                if (typeof item !== "number") {
                    return (
                        <span
                            key={item}
                            className="flex size-8 items-center justify-center text-muted-foreground"
                            aria-hidden="true"
                        >
                            <MoreHorizontal className="size-4" />
                        </span>
                    );
                }

                const isCurrentPage = item === currentPage;
                return (
                    <Button
                        key={item}
                        type="button"
                        variant={isCurrentPage ? "default" : "ghost"}
                        size="icon-sm"
                        onClick={() => onPageChange(item)}
                        aria-current={isCurrentPage ? "page" : undefined}
                        aria-label={`ไปยังหน้า ${item}`}
                        className="font-semibold"
                    >
                        {item}
                    </Button>
                );
            })}
        </div>
    );
}

export function Pagination({
    currentPage,
    totalPages,
    itemsPerPage,
    onPageChange,
    onPreviousPage,
    onNextPage,
}: PaginationProps): ReactElement | null {
    if (totalPages <= 1) return null;

    return (
        <nav
            aria-label="การแบ่งหน้า"
            className="flex flex-col gap-3 rounded-lg border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPreviousPage={onPreviousPage}
                onNextPage={onNextPage}
            />
            <PageNumberList
                items={getPaginationItems(currentPage, totalPages)}
                currentPage={currentPage}
                onPageChange={onPageChange}
            />
            <p className="text-center text-sm text-muted-foreground sm:text-right">
                หน้าละ {itemsPerPage.toLocaleString("th-TH")} รายการ
            </p>
        </nav>
    );
}
