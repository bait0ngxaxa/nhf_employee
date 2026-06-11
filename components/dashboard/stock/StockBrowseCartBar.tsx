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
    projectCode: string;
    submitting: boolean;
    onProjectCodeChange: (value: string) => void;
    onRemove: (variantId: number) => void;
    onChangeQuantity: (variantId: number, delta: number) => void;
    onClear: () => void;
    onSubmit: () => void;
};

export function StockBrowseCartBar(props: StockBrowseCartBarProps) {
    const [open, setOpen] = useState(false);

    function handleOpenChange(nextOpen: boolean): void {
        if (props.submitting && !nextOpen) {
            return;
        }

        setOpen(nextOpen);
    }

    return (
        <>
            <div className="fixed inset-x-4 bottom-5 z-30 sm:inset-x-auto sm:right-6 sm:w-auto">
                <Button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="group/cart-bar flex h-auto w-full items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-600 px-4 py-3 text-left text-white shadow-lg shadow-blue-900/20 transition-colors duration-200 hover:border-blue-300 hover:bg-blue-700 sm:min-w-[340px]"
                >
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-white/15 p-2.5 text-white ring-1 ring-white/20 transition-colors duration-200 group-hover/cart-bar:bg-white/20">
                            <ShoppingCart className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold leading-5">
                                รายการเบิก {props.cartSize} รายการ
                            </div>
                            <div className="text-xs font-medium leading-5 text-blue-50/85">
                                รวม {props.cartCount} ชิ้น กดเพื่อเปิดตะกร้า
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="rounded-full bg-white px-2.5 py-1 text-xs font-bold tabular-nums leading-5 text-blue-700 shadow-sm">
                            {props.cartCount}
                        </div>
                        <ChevronRight className="h-4 w-4 text-blue-100" />
                    </div>
                </Button>
            </div>

            <Sheet open={open} onOpenChange={handleOpenChange}>
                <SheetContent
                    side="right"
                    className="w-full border-l-0 bg-white p-0 sm:max-w-xl"
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
