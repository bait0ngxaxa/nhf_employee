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

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onPreviousPage}
                    disabled={currentPage === 1}
                    className="flex items-center space-x-1"
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span>ก่อนหน้า</span>
                </Button>

                <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => {
                            // Show first page, last page, current page, and pages around current page
                            if (
                                page === 1 ||
                                page === totalPages ||
                                (page >= currentPage - 2 &&
                                    page <= currentPage + 2)
                            ) {
                                return (
                                    <Button
                                        key={page}
                                        variant={
                                            currentPage === page
                                                ? "default"
                                                : "outline"
                                        }
                                        size="sm"
                                        onClick={() => onPageChange(page)}
                                        className="min-w-[40px]"
                                    >
                                        {page}
                                    </Button>
                                );
                            } else if (
                                page === currentPage - 3 ||
                                page === currentPage + 3
                            ) {
                                return (
                                    <span
                                        key={page}
                                        className="px-2 text-gray-400"
                                    >
                                        ...
                                    </span>
                                );
                            }
                            return null;
                        }
                    )}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onNextPage}
                    disabled={currentPage === totalPages}
                    className="flex items-center space-x-1"
                >
                    <span>ถัดไป</span>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="text-sm text-gray-600">
                แสดงผล {itemsPerPage} รายการต่อหน้า
            </div>
        </div>
    );
}
