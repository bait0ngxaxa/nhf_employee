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
            <Label htmlFor={props.id} className="text-sm font-semibold text-slate-700">
                {props.label}{" "}
                {props.required && <span className="text-rose-500">*</span>}
            </Label>
            <Input
                id={props.id}
                name={props.name}
                required={props.required}
                type={props.type}
                placeholder={props.placeholder}
                className="h-10 focus-visible:ring-blue-500"
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

export function InventoryCategoryField(props: {
    categories: CategoryOption[];
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor="categoryId" className="text-sm font-semibold text-slate-700">
                {STOCK_ADMIN_TEXT.category}{" "}
                {props.required && <span className="text-rose-500">*</span>}
            </Label>
            <Select name="categoryId" value={props.value} onValueChange={props.onChange}>
                <SelectTrigger className="h-10 focus:ring-blue-500">
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
