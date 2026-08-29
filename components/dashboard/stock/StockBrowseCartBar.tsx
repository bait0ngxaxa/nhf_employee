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
            <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-[calc(1rem+env(safe-area-inset-left))] right-[calc(1rem+env(safe-area-inset-right))] z-30 sm:left-auto sm:right-[calc(1.5rem+env(safe-area-inset-right))] sm:w-auto">
                <Button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="group/cart-bar flex h-auto min-h-16 w-full items-center justify-between gap-4 rounded-2xl border border-brand-border bg-brand-solid px-4 py-3 text-left text-content-on-brand shadow-lg shadow-brand-solid/15 transition-colors duration-200 hover:border-brand-border hover:bg-brand-solid-hover sm:min-w-[340px]"
                >
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-xl bg-surface-raised/15 p-2.5 text-content-on-brand ring-1 ring-content-on-brand/20 transition-colors duration-200 group-hover/cart-bar:bg-surface-raised/20">
                            <ShoppingCart className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold leading-5">
                                รายการเบิก {props.cartSize} รายการ
                            </div>
                            <div className="truncate text-xs font-medium leading-5 text-brand-foreground/85">
                                รวม {props.cartCount} ชิ้น กดเพื่อเปิดตะกร้า
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="rounded-full bg-surface-raised px-2.5 py-1 text-xs font-bold tabular-nums leading-5 text-brand-foreground shadow-sm">
                            {props.cartCount}
                        </div>
                        <ChevronRight className="h-4 w-4 text-brand-foreground" />
                    </div>
                </Button>
            </div>

            <Sheet open={open} onOpenChange={handleOpenChange}>
                <SheetContent
                    side="right"
                    className="w-full border-l-0 bg-surface-raised p-0 sm:max-w-xl"
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
