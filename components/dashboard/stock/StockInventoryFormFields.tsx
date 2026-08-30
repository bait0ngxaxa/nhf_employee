"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { STOCK_ADMIN_TEXT } from "./stockAdminInventory.shared";

type CategoryOption = { id: number; name: string };

export function InventoryTextField(props: {
    id: string;
    name: string;
    label: string;
    required?: boolean;
    type?: string;
    placeholder?: string;
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
                type={props.type}
                placeholder={props.placeholder}
                className="h-11 focus-visible:ring-action-primary-focus"
            />
        </div>
    );
}

export function InventoryNumberField(props: {
    id: string;
    name: string;
    label: string;
    defaultValue: number;
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
                defaultValue={props.defaultValue}
                required
                className="h-11 focus-visible:ring-action-primary-focus"
            />
        </div>
    );
}

export function InventoryCategoryField(props: {
    categories: CategoryOption[];
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor="categoryId" className="text-sm font-semibold text-content-body">
                {STOCK_ADMIN_TEXT.category}{" "}
                {props.required && <span className="text-status-danger-icon">*</span>}
            </Label>
            <Select name="categoryId" value={props.value} onValueChange={props.onChange}>
                <SelectTrigger className="h-11 focus:ring-action-primary-focus">
                    <SelectValue placeholder={STOCK_ADMIN_TEXT.categoryPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                    {props.categories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export function InventoryDialogActions(props: {
    loading: boolean;
    submitLabel: string;
    onClose: () => void;
}) {
    return (
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border-subtle bg-surface-raised px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
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
