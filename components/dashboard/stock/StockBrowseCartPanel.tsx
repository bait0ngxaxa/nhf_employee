import Image from "next/image";
import { useState } from "react";
import {
    CheckCircle2,
    Loader2,
    Minus,
    Plus,
    ShoppingCart,
    Trash2,
    XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BrowseCartItem } from "./stockVariant.shared";
import {
    getVariantAvailableQuantity,
    getVariantDisplayName,
} from "./stockVariant.shared";
import {
    STOCK_PROJECT_CODE_MAX_LENGTH,
    normalizeStockProjectCode,
} from "./stockBrowseCart.shared";

type StockBrowseCartPanelProps = {
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

export function StockBrowseCartPanel({
    items,
    cartSize,
    cartCount,
    projectCode,
    submitting,
    onProjectCodeChange,
    onRemove,
    onChangeQuantity,
    onClear,
    onSubmit,
}: StockBrowseCartPanelProps) {
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
    const trimmedProjectCode = projectCode.trim();
    const canSubmit = !submitting && trimmedProjectCode.length > 0 && cartSize > 0;

    return (
        <>
            <div className="flex h-full flex-col bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
                            <ShoppingCart
                                className="h-5 w-5"
                                aria-hidden="true"
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[0.9375rem] font-semibold leading-6 text-slate-900">
                                สรุปรายการเบิก
                            </div>
                            <div className="text-sm leading-5 text-slate-600">
                                {cartSize} รายการ รวม {cartCount} ชิ้น
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="space-y-1.5">
                            <Label
                                htmlFor="stock-project-code"
                                className="text-sm font-semibold leading-5 text-slate-800"
                            >
                                ชื่อย่อโครงการ
                            </Label>
                            <Input
                                id="stock-project-code"
                                name="stock-project-code"
                                autoComplete="off"
                                value={projectCode}
                                maxLength={STOCK_PROJECT_CODE_MAX_LENGTH}
                                onChange={(event) =>
                                    onProjectCodeChange(
                                        normalizeStockProjectCode(event.target.value),
                                    )
                                }
                                placeholder="กรุณาระบุชื่อย่อโครงการ"
                                disabled={submitting}
                                className="h-11 border-slate-200 bg-white font-medium uppercase tracking-normal text-slate-900 placeholder:text-slate-500 focus-visible:border-blue-300 focus-visible:ring-blue-200"
                            />
                            <div className="text-xs font-medium leading-5 text-slate-600">
                                ใช้สำหรับอ้างอิงคำขอเบิก สูงสุด {STOCK_PROJECT_CODE_MAX_LENGTH} ตัวอักษร
                            </div>
                        </div>
                    </div>
                    {items.map((cartItem) => (
                        <CartRow
                            key={cartItem.variant.id}
                            item={cartItem}
                            onRemove={() => onRemove(cartItem.variant.id)}
                            onDecrease={() =>
                                onChangeQuantity(cartItem.variant.id, -1)
                            }
                            onIncrease={() =>
                                onChangeQuantity(cartItem.variant.id, 1)
                            }
                            disabled={submitting}
                        />
                    ))}
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="mb-3 rounded-2xl border border-blue-100 bg-white/95 px-4 py-3">
                        <div className="flex items-center justify-between gap-3 text-sm leading-5">
                            <span className="text-slate-500">สรุปรายการ</span>
                            <span className="font-semibold tabular-nums text-slate-800">
                                {cartSize} รายการ
                            </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-sm leading-5">
                            <span className="text-slate-500">จำนวนรวม</span>
                            <span className="font-semibold tabular-nums text-slate-800">
                                {cartCount} ชิ้น
                            </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-sm leading-5">
                            <span className="text-slate-500">
                                ชื่อย่อโครงการ
                            </span>
                            <span className="min-w-0 truncate font-semibold text-slate-800">
                                {trimmedProjectCode || "-"}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button
                            type="button"
                            onClick={onSubmit}
                            disabled={!canSubmit}
                            className="group/submit h-11 w-full bg-blue-600 font-bold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700"
                        >
                            {submitting ? (
                                <Loader2
                                    className="mr-1.5 h-4 w-4 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <CheckCircle2
                                    className="mr-1.5 h-4 w-4 transition-transform duration-300 group-hover/submit:scale-110"
                                    aria-hidden="true"
                                />
                            )}
                            {submitting ? "กำลังดำเนินการ…" : "ยืนยันการเบิก"}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsClearConfirmOpen(true)}
                            disabled={submitting || cartSize === 0}
                            className="group/clear h-11 w-full border border-rose-100 text-rose-600 transition-colors duration-200 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        >
                            <XCircle
                                className="mr-1.5 h-4 w-4 transition-transform duration-300 group-hover/clear:scale-110"
                                aria-hidden="true"
                            />
                            ยกเลิกทั้งหมด
                        </Button>
                    </div>
                </div>
            </div>

            <Dialog
                open={isClearConfirmOpen}
                onOpenChange={(open) => {
                    if (!submitting) {
                        setIsClearConfirmOpen(open);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-rose-700">
                            ยืนยันการยกเลิกรายการทั้งหมด
                        </DialogTitle>
                        <DialogDescription>
                            ต้องการล้างรายการในตะกร้าและยกเลิกการเบิกทั้งหมดใช่หรือไม่?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setIsClearConfirmOpen(false)}
                            disabled={submitting}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                onClear();
                                setIsClearConfirmOpen(false);
                            }}
                            disabled={submitting}
                        >
                            ยืนยันการยกเลิก
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function CartRow(props: {
    item: BrowseCartItem;
    onRemove: () => void;
    onDecrease: () => void;
    onIncrease: () => void;
    disabled: boolean;
}) {
    const { item } = props;
    const imageUrl = item.variant.imageUrl ?? item.item.imageUrl ?? null;
    const availableQuantity = getVariantAvailableQuantity(item.variant);
    const displayName = getVariantDisplayName(item.item.name, item.variant);

    return (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:items-center">
            <div className="shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 shadow-inner shadow-white">
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={item.item.name}
                        width={64}
                        height={64}
                        sizes="64px"
                        loading="lazy"
                        unoptimized
                        className="h-14 w-14 object-cover sm:h-16 sm:w-16"
                    />
                ) : (
                    <div className="flex h-14 w-14 items-center justify-center text-xs text-slate-400 sm:h-16 sm:w-16">
                        ไม่มีรูป
                    </div>
                )}
            </div>

            <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-1">
                    <div className="text-sm font-semibold leading-5 text-slate-800 break-words sm:line-clamp-2">
                        {displayName}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium leading-5 text-slate-500">
                        <span>
                            จำนวนที่เบิก: {item.qty} {item.variant.unit}
                        </span>
                        <span>
                            คงเหลือสูงสุด{" "}
                            {availableQuantity} {item.variant.unit}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={props.onDecrease}
                            disabled={props.disabled || item.qty <= 1}
                            className="h-11 w-11 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            aria-label={`ลดจำนวน ${displayName}`}
                        >
                            <Minus
                                className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                                aria-hidden="true"
                            />
                        </Button>
                        <div className="w-8 rounded-lg bg-slate-100 py-1 text-center text-xs font-bold tabular-nums text-slate-800 sm:w-10 sm:text-sm">
                            {item.qty}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={props.onIncrease}
                            disabled={
                                props.disabled ||
                                item.qty >= availableQuantity
                            }
                            className="h-11 w-11 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            aria-label={`เพิ่มจำนวน ${displayName}`}
                        >
                            <Plus
                                className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                                aria-hidden="true"
                            />
                        </Button>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={props.onRemove}
                        disabled={props.disabled}
                        className="h-11 w-11 shrink-0 rounded-lg border border-transparent text-rose-600 transition-colors duration-200 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-700"
                        aria-label={`ลบ ${displayName} ออกจากตะกร้า`}
                    >
                        <Trash2
                            className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                            aria-hidden="true"
                        />
                    </Button>
                </div>
            </div>
        </div>
    );
}
