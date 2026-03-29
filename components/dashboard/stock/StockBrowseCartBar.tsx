"use client";

import { useState } from "react";
import { ChevronRight, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import type { BrowseCartItem } from "./stockVariant.shared";
import { StockBrowseCartPanel } from "./StockBrowseCartPanel";

type StockBrowseCartBarProps = {
    items: BrowseCartItem[];
    cartSize: number;
    cartCount: number;
    submitting: boolean;
    onRemove: (variantId: number) => void;
    onChangeQuantity: (variantId: number, delta: number) => void;
    onClear: () => void;
    onSubmit: () => void;
};

export function StockBrowseCartBar(props: StockBrowseCartBarProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <div className="fixed inset-x-4 bottom-5 z-30 sm:inset-x-auto sm:right-6 sm:w-auto">
                <Button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex h-auto w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-800 shadow-2xl shadow-slate-900/10 hover:bg-slate-50 sm:min-w-[320px]"
                >
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-700">
                            <ShoppingCart className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold">
                                รายการเบิก {props.cartSize} รายการ
                            </div>
                            <div className="text-xs text-slate-500">
                                รวม {props.cartCount} ชิ้น กดเพื่อเปิดตะกร้า
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">
                            {props.cartCount}
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                </Button>
            </div>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent
                    side="right"
                    className="w-full border-l-0 p-0 sm:max-w-xl"
                >
                    <SheetHeader className="sr-only">
                        <SheetTitle>ตะกร้ารายการเบิก</SheetTitle>
                        <SheetDescription>
                            ตรวจสอบและยืนยันรายการเบิกวัสดุ
                        </SheetDescription>
                    </SheetHeader>
                    <StockBrowseCartPanel
                        {...props}
                        onClear={() => {
                            props.onClear();
                            setOpen(false);
                        }}
                        onSubmit={() => {
                            props.onSubmit();
                        }}
                    />
                </SheetContent>
            </Sheet>
        </>
    );
}
