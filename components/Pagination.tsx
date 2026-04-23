import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onPreviousPage: () => void;
    onNextPage: () => void;
}

export function Pagination({
    currentPage,
    totalPages,
    itemsPerPage,
    onPageChange,
    onPreviousPage,
    onNextPage,
}: PaginationProps) {
    if (totalPages <= 1) {
        return null;
    }

    const visiblePages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onPreviousPage}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1"
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">ก่อนหน้า</span>
                </Button>

                <div className="min-w-0 text-center text-sm font-medium text-gray-600 sm:hidden">
                    หน้า {currentPage} / {totalPages}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onNextPage}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1"
                >
                    <span className="hidden sm:inline">ถัดไป</span>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="hidden items-center space-x-1 sm:flex">
                {visiblePages.map((page) => {
                    if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 2 && page <= currentPage + 2)
                    ) {
                        return (
                            <Button
                                key={page}
                                variant={
                                    currentPage === page ? "default" : "outline"
                                }
                                size="sm"
                                onClick={() => onPageChange(page)}
                                className="min-w-[40px]"
                            >
                                {page}
                            </Button>
                        );
                    }

                    if (page === currentPage - 3 || page === currentPage + 3) {
                        return (
                            <span key={page} className="px-2 text-gray-400">
                                ...
                            </span>
                        );
                    }

                    return null;
                })}
            </div>

            <div className="text-center text-sm text-gray-600 sm:text-right">
                แสดงผล {itemsPerPage} รายการต่อหน้า
            </div>
        </div>
    );
}
