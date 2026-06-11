"use client";

import Image from "next/image";
import { X } from "lucide-react";

type StockImagePreviewSurfaceProps = {
    imageUrl: string;
    itemName: string;
    onClose: () => void;
    ariaLabel: string;
};

export function StockImagePreviewSurface({
    imageUrl,
    itemName,
    onClose,
    ariaLabel,
}: StockImagePreviewSurfaceProps) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            onClick={onClose}
        >
            <div
                className="flex max-h-[88vh] w-full max-w-[920px] flex-col overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl shadow-slate-950/30"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/70 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                        <div className="text-xs font-semibold text-blue-700">
                            พรีวิวรูปวัสดุ
                        </div>
                        <div className="truncate text-sm font-bold text-blue-950">
                            {itemName}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-700 shadow-sm transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                        aria-label="ปิดพรีวิวรูป"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-50 p-3 sm:p-5">
                    <div className="flex max-h-full w-full items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-inner shadow-slate-200/70 sm:p-3">
                        <Image
                            src={imageUrl}
                            alt={itemName}
                            width={1200}
                            height={900}
                            sizes="(max-width: 900px) 100vw, 920px"
                            loading="eager"
                            unoptimized
                            className="h-auto max-h-[calc(88vh-8.5rem)] w-auto max-w-full rounded-xl object-contain"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
