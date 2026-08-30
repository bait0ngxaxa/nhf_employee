"use client";

import { Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import type { BrowseCartItem } from "@/components/dashboard/stock/stockVariant.shared";
import { getVariantAttributeSummary } from "@/components/dashboard/stock/stockVariant.shared";
import { STOCK_PROJECT_CODE_MAX_LENGTH } from "@/components/dashboard/stock/stockBrowseCart.shared";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LiffStockCartProps {
    open: boolean;
    items: BrowseCartItem[];
    totalQuantity: number;
    projectCode: string;
    submitting: boolean;
    onOpenChange: (open: boolean) => void;
    onProjectCodeChange: (value: string) => void;
    onChangeQuantity: (variantId: number, delta: number) => void;
    onRemove: (variantId: number) => void;
    onClear: () => void;
    onSubmit: () => void;
}

export function LiffStockCart({
    open,
    items,
    totalQuantity,
    projectCode,
    submitting,
    onOpenChange,
    onProjectCodeChange,
    onChangeQuantity,
    onRemove,
    onClear,
    onSubmit,
}: LiffStockCartProps): ReactElement {
    const canSubmit = items.length > 0 && projectCode.trim().length > 0;

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!submitting) onOpenChange(nextOpen);
            }}
        >
            <DialogContent
                closeLabel="ปิดตะกร้า"
                className="bottom-0 left-0 top-auto max-h-[90svh] max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-b-none rounded-t-3xl border-x-0 border-b-0 p-0 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"
                aria-busy={submitting}
            >
                <div className="border-b border-border-subtle bg-module-stock-badge-surface px-4 py-4 pr-12">
                    <DialogTitle className="flex items-center gap-2 text-lg leading-7 text-content-heading">
                        <ShoppingCart className="size-5 text-module-stock-solid" aria-hidden="true" />
                        ตะกร้าเบิกวัสดุ
                    </DialogTitle>
                    <DialogDescription className="mt-1 leading-6 text-content-secondary">
                        {items.length} ตัวเลือก · รวม {totalQuantity} ชิ้น
                    </DialogDescription>
                </div>

                <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-4">
                    {items.length === 0 ? (
                        <div className="py-10 text-center text-sm text-content-secondary">
                            ยังไม่มีวัสดุในตะกร้า
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item) => {
                                const variantLabel = getVariantAttributeSummary(
                                    item.variant.attributeValues,
                                );
                                return (
                                    <article
                                        key={item.variant.id}
                                        className="rounded-2xl bg-surface-subtle p-3 ring-1 ring-border-subtle"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h3 className="break-words text-sm font-bold leading-6 text-content-heading">
                                                    {item.item.name}
                                                </h3>
                                                <p className="break-words text-xs leading-5 text-content-secondary">
                                                    {variantLabel || item.variant.sku}
                                                </p>
                                                <p className="text-xs tabular-nums leading-5 text-content-muted">
                                                    พร้อมเบิก {item.variant.availableQuantity} {item.variant.unit}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onRemove(item.variant.id)}
                                                disabled={submitting}
                                                aria-label={`นำ ${item.item.name} ออกจากตะกร้า`}
                                                className="size-11 shrink-0 rounded-xl text-status-danger-foreground"
                                            >
                                                <Trash2 className="size-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                        <div className="mt-3 flex items-center justify-end gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => onChangeQuantity(item.variant.id, -1)}
                                                disabled={submitting}
                                                aria-label={`ลดจำนวน ${item.item.name}`}
                                                className="size-11 rounded-xl"
                                            >
                                                <Minus className="size-4" aria-hidden="true" />
                                            </Button>
                                            <span className="min-w-10 text-center text-base font-bold tabular-nums text-content-heading">
                                                {item.qty}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => onChangeQuantity(item.variant.id, 1)}
                                                disabled={
                                                    submitting
                                                    || item.qty >= item.variant.availableQuantity
                                                }
                                                aria-label={`เพิ่มจำนวน ${item.item.name}`}
                                                className="size-11 rounded-xl"
                                            >
                                                <Plus className="size-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="liff-stock-project-code" className="font-semibold">
                            ชื่อย่อโครงการ
                        </Label>
                        <Input
                            id="liff-stock-project-code"
                            name="stock-project-code"
                            autoComplete="off"
                            value={projectCode}
                            onChange={(event) => onProjectCodeChange(event.target.value)}
                            maxLength={STOCK_PROJECT_CODE_MAX_LENGTH}
                            placeholder="เช่น NHF-2569"
                            disabled={submitting}
                            className="h-12 rounded-xl border-border-subtle bg-surface"
                        />
                        <p className="text-xs leading-5 text-content-muted">
                            ระบบจะปรับเป็นตัวพิมพ์ใหญ่และตัดช่องว่างให้อัตโนมัติ
                        </p>
                    </div>

                    {items.length > 0 ? (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClear}
                            disabled={submitting}
                            className="min-h-11 w-full rounded-xl text-status-danger-foreground"
                        >
                            ล้างตะกร้าทั้งหมด
                        </Button>
                    ) : null}
                </div>

                <div className="border-t border-border-subtle bg-surface-raised px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                    <Button
                        type="button"
                        onClick={onSubmit}
                        disabled={!canSubmit || submitting}
                        className="min-h-12 w-full rounded-xl bg-module-stock-solid font-bold text-content-on-brand hover:bg-module-stock-solid-hover"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                กำลังส่งคำขอ...
                            </>
                        ) : (
                            `ส่งคำขอเบิก ${totalQuantity} ชิ้น`
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
