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
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { StockItem } from "../context/stock/types";
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

export function AdjustDialog({ item, onClose, onSuccess }: AdjustDialogProps) {
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setLoading(true);
        const formData = new FormData(event.currentTarget);

        try {
            ensureStockApiSuccess(
                await apiPost(API_ROUTES.stock.adjustById(item.id), {
                    type: "IN",
                    quantity: Number(formData.get("quantity")),
                    minStock: Number(formData.get("minStock")),
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
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="overflow-hidden p-0 sm:max-w-[400px]">
                <div className="border-b border-gray-100 bg-slate-50/50 px-6 py-4">
                    <DialogTitle className="text-lg font-semibold text-slate-800">
                        {STOCK_ADMIN_TEXT.adjustStockTitle}
                    </DialogTitle>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
                    <div className="flex flex-col gap-0.5 rounded-xl border border-blue-100/60 bg-blue-50/60 p-3.5 shadow-inner">
                        <span className="text-[13px] font-semibold uppercase tracking-wider text-blue-800">
                            {item.name}
                        </span>
                        <span className="flex items-center gap-1.5 text-sm font-medium text-blue-600/90">
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                            {STOCK_ADMIN_TEXT.currentStock}: {item.quantity} {item.unit}
                        </span>
                    </div>
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
                        defaultValue={item.minStock}
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
        setLoading(true);
        const formData = new FormData(event.currentTarget);

        try {
            ensureStockApiSuccess(
                await apiPost(API_ROUTES.stock.categories, {
                    name: formData.get("name"),
                    description: formData.get("description") || null,
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
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="overflow-hidden p-0 sm:max-w-[400px]">
                <div className="border-b border-gray-100 bg-slate-50/50 px-6 py-4">
                    <DialogTitle className="text-lg font-semibold text-slate-800">
                        {STOCK_ADMIN_TEXT.addCategoryTitle}
                    </DialogTitle>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
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
            <Label htmlFor={props.id} className="text-sm font-semibold text-slate-700">
                {props.label}{" "}
                {props.required && <span className="text-rose-500">*</span>}
            </Label>
            <Input
                id={props.id}
                name={props.name}
                required={props.required}
                className="h-10 focus-visible:ring-blue-500"
            />
        </div>
    );
}

function DialogNumberField(props: {
    id: string;
    name: string;
    label: string;
    defaultValue: number;
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={props.id} className="text-sm font-semibold text-slate-700">
                {props.label} <span className="text-rose-500">*</span>
            </Label>
            <Input
                id={props.id}
                name={props.name}
                type="number"
                min={1}
                defaultValue={props.defaultValue}
                required
                className="h-10 focus-visible:ring-blue-500"
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
        <div className="flex justify-end gap-3 pt-3">
            <Button
                type="button"
                variant="ghost"
                onClick={props.onClose}
                disabled={props.loading}
                className="h-10 px-5 font-medium text-slate-600 hover:bg-slate-100"
            >
                {STOCK_ADMIN_TEXT.cancel}
            </Button>
            <Button
                type="submit"
                disabled={props.loading}
                className="h-10 bg-blue-600 px-7 font-bold text-white shadow-sm transition-all hover:bg-blue-700"
            >
                {props.loading ? STOCK_ADMIN_TEXT.saving : props.submitLabel}
            </Button>
        </div>
    );
}
