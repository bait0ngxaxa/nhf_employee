"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiPost } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { StockItem, StockItemVariant } from "../context/stock/types";
import {
    ensureStockApiSuccess,
    STOCK_ADMIN_TEXT,
    createAdjustSuccessMessage,
} from "./stockAdminInventory.shared";

type AdjustDialogProps = {
    item: StockItem;
    onClose: () => void;
    onSuccess: () => void;
};

function closeWhenIdle(loading: boolean, onClose: () => void): void {
    if (!loading) {
        onClose();
    }
}

function getTrimmedFormText(
    formData: FormData,
    fieldName: string,
): string {
    const value = formData.get(fieldName);
    return typeof value === "string" ? value.trim() : "";
}

export function AdjustDialog({ item, onClose, onSuccess }: AdjustDialogProps) {
    const activeVariants = item.variants?.filter((variant) => variant.isActive) ?? [];
    const initialVariant = activeVariants.length === 1 ? activeVariants[0] : undefined;
    const [loading, setLoading] = useState(false);
    const [selectedVariantId, setSelectedVariantId] = useState(
        initialVariant ? String(initialVariant.id) : "",
    );
    const [minStock, setMinStock] = useState(
        String(initialVariant?.minStock ?? item.minStock),
    );

    function handleVariantChange(variantId: string): void {
        setSelectedVariantId(variantId);
        const selectedVariant = activeVariants.find(
            (variant) => variant.id === Number(variantId),
        );
        setMinStock(String(selectedVariant?.minStock ?? item.minStock));
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const variantId = Number(formData.get("variantId"));
        if (activeVariants.length > 1 && !selectedVariantId) {
            toast.error("กรุณาเลือกรายการย่อยที่จะรับเข้า");
            return;
        }
        setLoading(true);

        try {
            ensureStockApiSuccess(
                await apiPost(API_ROUTES.stock.adjustById(item.id), {
                    type: "IN",
                    quantity: Number(formData.get("quantity")),
                    minStock: Number(formData.get("minStock")),
                    ...(Number.isInteger(variantId) && variantId > 0 && { variantId }),
                }),
                STOCK_ADMIN_TEXT.genericError,
            );

            toast.success(createAdjustSuccessMessage(item.name));
            onSuccess();
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : STOCK_ADMIN_TEXT.genericError;
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open onOpenChange={() => closeWhenIdle(loading, onClose)}>
            <DialogContent scrollMode="area" className="overflow-hidden p-0 sm:max-w-[400px]">
                <div className="border-b border-border-neutral-muted bg-surface-subtle/50 px-5 py-4 sm:px-6">
                    <DialogTitle className="text-lg font-semibold text-content-strong">
                        {STOCK_ADMIN_TEXT.adjustStockTitle}
                    </DialogTitle>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-0.5 rounded-xl border border-border-subtle bg-surface-subtle p-3.5">
                        <span className="text-sm font-semibold text-content-primary">
                            {item.name}
                        </span>
                        <span className="flex items-center gap-1.5 text-sm font-medium text-content-secondary">
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-action-primary-accent" />
                            {STOCK_ADMIN_TEXT.currentStock}: {item.quantity} {item.unit}
                        </span>
                    </div>
                    {activeVariants.length > 0 && (
                        <AdjustVariantField
                            variants={activeVariants}
                            value={selectedVariantId}
                            onValueChange={handleVariantChange}
                        />
                    )}
                    <DialogNumberField
                        id="adj-qty"
                        name="quantity"
                        label={STOCK_ADMIN_TEXT.inboundQuantity}
                        defaultValue={1}
                    />
                    <DialogNumberField
                        id="adj-min-stock"
                        name="minStock"
                        label={STOCK_ADMIN_TEXT.minStock}
                        value={minStock}
                        onValueChange={setMinStock}
                    />
                    <DialogActions
                        loading={loading}
                        submitLabel={STOCK_ADMIN_TEXT.saveAdjust}
                        onClose={onClose}
                    />
                </form>
            </DialogContent>
        </Dialog>
    );
}

function AdjustVariantField(props: {
    variants: StockItemVariant[];
    value: string;
    onValueChange: (value: string) => void;
}) {

    return (
        <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-content-body">
                รายการย่อยที่จะรับเข้า <span className="text-status-danger-icon">*</span>
            </Label>
            <Select
                name="variantId"
                value={props.value}
                onValueChange={props.onValueChange}
            >
                <SelectTrigger className="h-11 w-full focus:ring-action-primary-focus">
                    <SelectValue placeholder="เลือกรายการย่อย" />
                </SelectTrigger>
                <SelectContent>
                    {props.variants.map((variant) => (
                        <SelectItem key={variant.id} value={String(variant.id)}>
                            {variant.sku} · คงเหลือ {variant.quantity} {variant.unit}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

type AddCategoryDialogProps = {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
};

export function AddCategoryDialog({
    open,
    onClose,
    onSuccess,
}: AddCategoryDialogProps) {
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const categoryName = getTrimmedFormText(formData, "name");
        const categoryDescription = getTrimmedFormText(formData, "description");

        if (!categoryName) {
            toast.error("กรุณากรอกชื่อหมวดหมู่");
            return;
        }

        setLoading(true);

        try {
            ensureStockApiSuccess(
                await apiPost(API_ROUTES.stock.categories, {
                    name: categoryName,
                    description: categoryDescription || null,
                }),
                STOCK_ADMIN_TEXT.genericError,
            );

            toast.success(STOCK_ADMIN_TEXT.categoryAdded);
            onSuccess();
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : STOCK_ADMIN_TEXT.genericError;
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={() => closeWhenIdle(loading, onClose)}>
            <DialogContent scrollMode="area" className="overflow-hidden p-0 sm:max-w-[400px]">
                <div className="border-b border-border-neutral-muted bg-surface-subtle/50 px-5 py-4 sm:px-6">
                    <DialogTitle className="text-lg font-semibold text-content-strong">
                        {STOCK_ADMIN_TEXT.addCategoryTitle}
                    </DialogTitle>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
                    <DialogTextField
                        id="cat-name"
                        name="name"
                        label={STOCK_ADMIN_TEXT.categoryName}
                        required
                    />
                    <DialogTextField
                        id="cat-desc"
                        name="description"
                        label={STOCK_ADMIN_TEXT.categoryDescription}
                    />
                    <DialogActions
                        loading={loading}
                        submitLabel={STOCK_ADMIN_TEXT.save}
                        onClose={onClose}
                    />
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DialogTextField(props: {
    id: string;
    name: string;
    label: string;
    required?: boolean;
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={props.id} className="text-sm font-semibold text-content-body">
                {props.label}{" "}
                {props.required && <span className="text-status-danger-icon">*</span>}
            </Label>
            <Input
                id={props.id}
                name={props.name}
                required={props.required}
                className="h-11 focus-visible:ring-action-primary-focus"
            />
        </div>
    );
}

function DialogNumberField(props: {
    id: string;
    name: string;
    label: string;
    defaultValue?: number;
    value?: string;
    onValueChange?: (value: string) => void;
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={props.id} className="text-sm font-semibold text-content-body">
                {props.label} <span className="text-status-danger-icon">*</span>
            </Label>
            <Input
                id={props.id}
                name={props.name}
                type="number"
                min={1}
                {...(props.value !== undefined
                    ? {
                          value: props.value,
                          onChange: (event) => props.onValueChange?.(event.target.value),
                      }
                    : { defaultValue: props.defaultValue })}
                required
                className="h-11 focus-visible:ring-action-primary-focus"
            />
        </div>
    );
}

function DialogActions(props: {
    loading: boolean;
    submitLabel: string;
    onClose: () => void;
}) {
    return (
        <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
            <Button
                type="button"
                variant="ghost"
                onClick={props.onClose}
                disabled={props.loading}
                className="h-11 px-5 font-medium text-content-secondary hover:bg-surface-muted"
            >
                {STOCK_ADMIN_TEXT.cancel}
            </Button>
            <Button
                type="submit"
                disabled={props.loading}
                className="h-11 bg-action-primary-solid px-7 font-bold text-content-on-brand shadow-sm transition-colors hover:bg-action-primary-solid-hover"
            >
                {props.loading ? STOCK_ADMIN_TEXT.saving : props.submitLabel}
            </Button>
        </div>
    );
}
