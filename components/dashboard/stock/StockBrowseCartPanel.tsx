import Image from "next/image";
import { useState } from "react";
import { CheckCircle2, Minus, Plus, ShoppingCart, Trash2, XCircle } from "lucide-react";
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
                            <ShoppingCart className="h-5 w-5" />
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
                            className="w-full bg-blue-600 font-bold text-white hover:bg-blue-700"
                        >
                            <CheckCircle2 className="mr-1.5 h-4 w-4" />
                            {submitting ? "กำลังดำเนินการ..." : "ยืนยันการเบิก"}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsClearConfirmOpen(true)}
                            disabled={submitting}
                            className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                            <XCircle className="mr-1.5 h-4 w-4" />
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
        <div className="flex items-center gap-3 rounded-[1.35rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-3 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.35)]">
            <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 shadow-inner shadow-white">
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={item.item.name}
                        width={64}
                        height={64}
                        unoptimized
                        className="h-16 w-16 object-cover"
                    />
                ) : (
                    <div className="flex h-16 w-16 items-center justify-center text-xs text-slate-400">
                        ไม่มีรูป
                    </div>
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-800">
                    {getVariantDisplayName(item.item.name, item.variant)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>
                        จำนวนที่เบิก: {item.qty} {item.variant.unit}
                    </span>
                    <span>
                        คงเหลือสูงสุด {getVariantAvailableQuantity(item.variant)}{" "}
                        {item.variant.unit}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={props.onDecrease}
                    disabled={props.disabled}
                    className="h-9 w-9 rounded-lg bg-white text-slate-700 shadow-sm hover:bg-slate-100"
                >
                    <Minus className="h-4 w-4" />
                </Button>
                <div className="w-10 text-center text-sm font-bold text-blue-700">
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
                    className="h-9 w-9 rounded-lg bg-white text-slate-700 shadow-sm hover:bg-slate-100"
                >
                    <Plus className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={props.onRemove}
                    disabled={props.disabled}
                    className="h-9 w-9 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
