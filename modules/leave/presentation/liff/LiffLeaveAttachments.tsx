"use client";

import Image from "next/image";
import { ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { fetchLiffLeaveAttachment } from "./api";
import type { LeaveAttachmentSummary } from "../types";

interface LiffLeaveAttachmentsProps {
    attachments: LeaveAttachmentSummary[];
}

export function LiffLeaveAttachments({
    attachments,
}: LiffLeaveAttachmentsProps): ReactElement | null {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    if (attachments.length === 0) return null;

    const openAttachment = async (attachmentId: string): Promise<void> => {
        setActiveId(attachmentId);
        setIsLoading(true);
        setError(null);
        try {
            const blob = await fetchLiffLeaveAttachment(attachmentId);
            const nextUrl = URL.createObjectURL(blob);
            setPreviewUrl((current) => {
                if (current) URL.revokeObjectURL(current);
                return nextUrl;
            });
        } catch {
            setPreviewUrl(null);
            setError("เปิดไฟล์แนบไม่สำเร็จ กรุณาลองใหม่");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="space-y-3" aria-labelledby="liff-leave-attachments-heading">
            <div className="flex items-center justify-between gap-3">
                <h3
                    id="liff-leave-attachments-heading"
                    className="text-sm font-semibold text-content-heading"
                >
                    หลักฐานประกอบ
                </h3>
                <span className="text-xs font-medium text-content-muted">
                    {attachments.length} รูป
                </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {attachments.map((attachment, index) => (
                    <Button
                        key={attachment.id}
                        type="button"
                        variant="outline"
                        className="h-auto min-h-12 min-w-0 flex-col gap-1 px-2 py-2 text-xs"
                        disabled={isLoading}
                        onClick={() => void openAttachment(attachment.id)}
                    >
                        {isLoading && activeId === attachment.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <ImageIcon className="size-4" aria-hidden="true" />
                        )}
                        รูปที่ {index + 1}
                    </Button>
                ))}
            </div>
            {error ? (
                <p role="alert" className="text-sm font-medium text-status-danger-strong">
                    {error}
                </p>
            ) : null}
            {previewUrl ? (
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-muted">
                    <Image
                        src={previewUrl}
                        alt="ภาพหลักฐานประกอบคำขอลา"
                        fill
                        unoptimized
                        sizes="(max-width: 512px) 100vw, 512px"
                        className="object-contain"
                    />
                </div>
            ) : null}
        </section>
    );
}
