import Image from "next/image";
import { useState } from "react";
import { CheckCircle2, Loader2, Minus, Plus, ShoppingCart, Trash2, XCircle } from "lucide-react";
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

    return (
        <>
            <div className="flex h-full flex-col bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-700">
                            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-slate-800">
                                สรุปรายการเบิก
                            </div>
                            <div className="text-sm text-slate-500">
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
                                className="text-sm font-semibold text-slate-700"
                            >
                                รหัสโครงการ
                            </Label>
                            <Input
                                id="stock-project-code"
                                name="stock-project-code"
                                autoComplete="off"
                                value={projectCode}
                                onChange={(event) =>
                                    onProjectCodeChange(event.target.value.toUpperCase())
                                }
                                placeholder="เช่น ABC-2569/01"
                                className="h-11 border-slate-200 bg-white focus-visible:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500">
                                ระบุรหัสโครงการก่อนส่งคำขอเบิก
                            </p>
                        </div>
                    </div>
                    {items.map((cartItem) => (
                        <CartRow
                            key={cartItem.variant.id}
                            item={cartItem}
                            onRemove={() => onRemove(cartItem.variant.id)}
                            onDecrease={() => onChangeQuantity(cartItem.variant.id, -1)}
                            onIncrease={() => onChangeQuantity(cartItem.variant.id, 1)}
                            disabled={submitting}
                        />
                    ))}
                </div>

                <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-4">
                    <div className="mb-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-slate-500">สรุปรายการ</span>
                            <span className="font-semibold text-slate-800">
                                {cartSize} รายการ
                            </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                            <span className="text-slate-500">จำนวนรวม</span>
                            <span className="font-semibold text-slate-800">
                                {cartCount} ชิ้น
                            </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                            <span className="text-slate-500">รหัสโครงการ</span>
                            <span className="truncate font-semibold text-slate-800">
                                {projectCode.trim() || "-"}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button
                            type="button"
                            onClick={onSubmit}
                            disabled={submitting || projectCode.trim().length === 0}
                            className="group/submit w-full bg-[linear-gradient(135deg,#2563EB,#1D4ED8)] font-bold text-white shadow-[0_18px_34px_-22px_rgba(37,99,235,0.95)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_38px_-20px_rgba(37,99,235,0.95)]"
                        >
                            {submitting ? (
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <CheckCircle2 className="mr-1.5 h-4 w-4 transition-transform duration-300 group-hover/submit:scale-110" aria-hidden="true" />
                            )}
                            {submitting ? "กำลังดำเนินการ…" : "ยืนยันการเบิก"}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsClearConfirmOpen(true)}
                            disabled={submitting}
                            className="group/clear w-full border border-rose-100 text-rose-600 transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 hover:shadow-[0_18px_28px_-24px_rgba(190,24,93,0.7)]"
                        >
                            <XCircle className="mr-1.5 h-4 w-4 transition-transform duration-300 group-hover/clear:scale-110" aria-hidden="true" />
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
                    <DialogFooter className="gap-2 sm:justify-end">
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

    return (
        <div className="flex items-start gap-3 rounded-[1.35rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-3 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.35)] sm:items-center">
            <div className="shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 shadow-inner shadow-white">
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={item.item.name}
                        width={64}
                        height={64}
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
                    <div className="text-sm font-semibold leading-snug text-slate-800 break-words sm:truncate">
                        {getVariantDisplayName(item.item.name, item.variant)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>
                            จำนวนที่เบิก: {item.qty} {item.variant.unit}
                        </span>
                        <span>
                            คงเหลือสูงสุด {getVariantAvailableQuantity(item.variant)}{" "}
                            {item.variant.unit}
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
                            disabled={props.disabled}
                            className="h-8 w-8 rounded-lg border border-transparent bg-white text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-100 hover:shadow-md sm:h-9 sm:w-9"
                            aria-label={`ลดจำนวน ${getVariantDisplayName(item.item.name, item.variant)}`}
                        >
                            <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                        </Button>
                        <div className="w-8 text-center text-xs font-bold text-blue-700 sm:w-10 sm:text-sm">
                            {item.qty}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={props.onIncrease}
                            disabled={
                                props.disabled ||
                                item.qty >= getVariantAvailableQuantity(item.variant)
                            }
                            className="h-8 w-8 rounded-lg border border-transparent bg-white text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-100 hover:shadow-md sm:h-9 sm:w-9"
                            aria-label={`เพิ่มจำนวน ${getVariantDisplayName(item.item.name, item.variant)}`}
                        >
                            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                        </Button>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={props.onRemove}
                        disabled={props.disabled}
                        className="h-8 w-8 shrink-0 rounded-lg border border-transparent text-rose-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-700 hover:shadow-md sm:h-9 sm:w-9"
                        aria-label={`ลบ ${getVariantDisplayName(item.item.name, item.variant)} ออกจากตะกร้า`}
                    >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
