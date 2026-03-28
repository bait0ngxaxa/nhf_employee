import Image from "next/image";
import { Minus, Plus, ShoppingCart, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrowseCartItem } from "./stockVariant.shared";
import { getVariantDisplayName } from "./stockVariant.shared";

type StockBrowseCartPanelProps = {
    items: BrowseCartItem[];
    cartSize: number;
    cartCount: number;
    submitting: boolean;
    onRemove: (variantId: number) => void;
    onChangeQuantity: (variantId: number, delta: number) => void;
    onClear: () => void;
    onSubmit: () => void;
};

export function StockBrowseCartPanel({
    items,
    cartSize,
    cartCount,
    submitting,
    onRemove,
    onChangeQuantity,
    onClear,
    onSubmit,
}: StockBrowseCartPanelProps) {
    return (
        <div className="sticky bottom-6 z-10 px-4 sm:px-0">
            <div className="mx-auto max-w-4xl space-y-3 rounded-3xl bg-white/95 p-4 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-700">
                            <ShoppingCart className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-slate-800">
                                สรุปรายการเบิก
                            </div>
                            <div className="text-sm text-slate-500">
                                {cartSize} รายการ • {cartCount} ชิ้น
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClear}
                            disabled={submitting}
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                            <XCircle className="mr-1.5 h-4 w-4" />
                            ยกเลิกทั้งหมด
                        </Button>
                        <Button
                            type="button"
                            onClick={onSubmit}
                            disabled={submitting}
                            className="bg-blue-600 font-bold text-white hover:bg-blue-700"
                        >
                            {submitting ? "กำลังดำเนินการ..." : "ยืนยันการเบิก"}
                        </Button>
                    </div>
                </div>

                <div className="grid gap-3">
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
            </div>
        </div>
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
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
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
                        คงเหลือสูงสุด {item.variant.quantity} {item.variant.unit}
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
                    className="h-9 w-9 rounded-lg bg-white text-slate-700 hover:bg-slate-100"
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
                    disabled={props.disabled || item.qty >= item.variant.quantity}
                    className="h-9 w-9 rounded-lg bg-white text-slate-700 hover:bg-slate-100"
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
