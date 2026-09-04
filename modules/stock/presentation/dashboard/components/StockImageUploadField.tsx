"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_MAX_MB } from "@/lib/ssot/uploads";
import { ensureStockApiSuccess } from "./stockAdminInventory.shared";

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

        if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
            toast.error(`ไฟล์รูปต้องมีขนาดไม่เกิน ${IMAGE_UPLOAD_MAX_MB} MB`);
            event.target.value = "";
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("scope", scope);
        formData.append("file", file);

        try {
            const result = ensureStockApiSuccess(
                await apiPost<UploadResponse>(API_ROUTES.uploads.image, formData),
                "อัปโหลดรูปไม่สำเร็จ",
            );

            if (!result.upload?.url) {
                throw new Error(result.error ?? "อัปโหลดรูปไม่สำเร็จ");
            }

            onChange(result.upload.url);
        } catch (error: unknown) {
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
            <div className="text-sm font-semibold text-content-body">{label}</div>
            <div className="rounded-2xl border border-border-subtle bg-surface-subtle/70 p-4">
                <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label={label}
                    className="hidden"
                    onChange={(event) => void handleFileChange(event)}
                />

                {value ? (
                    <div className="space-y-3">
                        <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
                            <Image
                                src={value}
                                alt={label}
                                width={640}
                                height={360}
                                sizes="(max-width: 760px) 100vw, 640px"
                                loading="lazy"
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
                                className="border-action-primary-border text-action-primary-foreground hover:bg-action-primary-surface"
                            >
                                {uploading ? (
                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                                )}
                                เปลี่ยนรูป
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={uploading}
                                onClick={() => onChange("")}
                                className="text-status-danger-foreground hover:bg-status-danger-surface hover:text-status-danger-strong"
                            >
                                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                                ลบรูป
                            </Button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        disabled={uploading}
                        onClick={() => inputRef.current?.click()}
                        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-raised px-4 py-8 text-sm text-content-muted transition hover:border-action-primary-border-strong hover:text-action-primary-foreground disabled:cursor-not-allowed"
                    >
                        {uploading ? (
                            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                        ) : (
                            <ImagePlus className="h-5 w-5" aria-hidden="true" />
                        )}
                        <span>
                            {uploading ? "กำลังอัปโหลด…" : "อัปโหลดรูปภาพ"}
                        </span>
                        <span className="text-xs text-content-subtle">
                            รองรับ JPG, PNG, WEBP ไม่เกิน {IMAGE_UPLOAD_MAX_MB} MB
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
