"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { API_ROUTES } from "@/lib/ssot/routes";

type StockImageUploadFieldProps = {
    label: string;
    scope: "item" | "variant";
    value: string;
    onChange: (value: string) => void;
};

type UploadResponse = {
    upload?: {
        url: string;
    };
    error?: string;
};

export function StockImageUploadField({
    label,
    scope,
    value,
    onChange,
}: StockImageUploadFieldProps) {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [uploading, setUploading] = useState(false);

    async function handleFileChange(
        event: ChangeEvent<HTMLInputElement>,
    ): Promise<void> {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("scope", scope);
        formData.append("file", file);

        try {
            const response = await fetch(API_ROUTES.uploads.image, {
                method: "POST",
                body: formData,
            });
            const result = (await response.json()) as UploadResponse;

            if (!response.ok || !result.upload?.url) {
                throw new Error(result.error ?? "อัปโหลดรูปไม่สำเร็จ");
            }

            onChange(result.upload.url);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ";
            toast.error(message);
        } finally {
            setUploading(false);
            if (inputRef.current) {
                inputRef.current.value = "";
            }
        }
    }

    return (
        <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-700">{label}</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => void handleFileChange(event)}
                />

                {value ? (
                    <div className="space-y-3">
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <Image
                                src={value}
                                alt={label}
                                width={640}
                                height={360}
                                unoptimized
                                className="h-40 w-full object-contain"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={uploading}
                                onClick={() => inputRef.current?.click()}
                                className="border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                                {uploading ? (
                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                ) : (
                                    <ImagePlus className="mr-1.5 h-4 w-4" />
                                )}
                                เปลี่ยนรูป
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={uploading}
                                onClick={() => onChange("")}
                                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            >
                                <Trash2 className="mr-1.5 h-4 w-4" />
                                ลบรูป
                            </Button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        disabled={uploading}
                        onClick={() => inputRef.current?.click()}
                        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-sm text-slate-500 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed"
                    >
                        {uploading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <ImagePlus className="h-5 w-5" />
                        )}
                        <span>
                            {uploading ? "กำลังอัปโหลด..." : "อัปโหลดรูปภาพ"}
                        </span>
                        <span className="text-xs text-slate-400">
                            รองรับ JPG, PNG, WEBP
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
