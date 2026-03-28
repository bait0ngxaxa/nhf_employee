"use client";

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
    return <StockBrowseCartPanel {...props} />;
}
