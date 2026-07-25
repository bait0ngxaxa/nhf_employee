"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    FileImage,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { fetchLeaveAttachmentImage } from "@/lib/services/leave/client";
import type { LeaveAttachmentSummary } from "@/lib/types/leave";
import { cn } from "@/lib/ui/utils";

interface LeaveAttachmentViewerDialogProps {
    open: boolean;
    attachments: LeaveAttachmentSummary[];
    onOpenChange: (open: boolean) => void;
}

type PrivateImageState = {
    viewUrl: string;
    status: "loaded" | "error";
    objectUrl?: string;
};

export function LeaveAttachmentViewerDialog({
    open,
    attachments,
    onOpenChange,
}: LeaveAttachmentViewerDialogProps): React.JSX.Element | null {
    const [activeIndex, setActiveIndex] = useState(0);
    const [imageStates, setImageStates] = useState<Record<string, PrivateImageState>>({});
    const attachmentCount = attachments.length;
    const safeActiveIndex = Math.min(activeIndex, Math.max(attachmentCount - 1, 0));
    const activeAttachment = attachments[safeActiveIndex];
    const activeImageState = activeAttachment
        ? imageStates[activeAttachment.id]
        : undefined;
    const activeLoadState =
        activeImageState?.viewUrl === activeAttachment?.viewUrl
            ? activeImageState.status
            : "loading";
    const activeImageUrl =
        activeLoadState === "loaded" ? activeImageState?.objectUrl : undefined;

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const controller = new AbortController();
        const createdObjectUrls: string[] = [];

        for (const attachment of attachments) {
            async function loadPrivateImage(): Promise<void> {
                try {
                    const blob = await fetchLeaveAttachmentImage(
                        attachment.id,
                        controller.signal,
                    );
                    if (controller.signal.aborted) {
                        return;
                    }

                    const objectUrl = URL.createObjectURL(blob);
                    createdObjectUrls.push(objectUrl);
                    setImageStates((current) => ({
                        ...current,
                        [attachment.id]: {
                            viewUrl: attachment.viewUrl,
                            status: "loaded",
                            objectUrl,
                        },
                    }));
                } catch {
                    if (controller.signal.aborted) {
                        return;
                    }
                    setImageStates((current) => ({
                        ...current,
                        [attachment.id]: {
                            viewUrl: attachment.viewUrl,
                            status: "error",
                        },
                    }));
                }
            }

            void loadPrivateImage();
        }

        return () => {
            controller.abort();
            for (const objectUrl of createdObjectUrls) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [attachments, open]);

    useEffect(() => {
        if (!open || attachmentCount <= 1) {
            return undefined;
        }

        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                setActiveIndex((current) =>
                    (current - 1 + attachmentCount) % attachmentCount,
                );
            }
            if (event.key === "ArrowRight") {
                event.preventDefault();
                setActiveIndex((current) => (current + 1) % attachmentCount);
            }
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [attachmentCount, open]);

    if (!activeAttachment) {
        return null;
    }

    function changeImage(direction: -1 | 1): void {
        setActiveIndex(
            (current) => (current + direction + attachmentCount) % attachmentCount,
        );
    }

    function handleOpenChange(nextOpen: boolean): void {
        if (!nextOpen) {
            setActiveIndex(0);
            setImageStates({});
        }
        onOpenChange(nextOpen);
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="flex max-h-[92dvh] flex-col gap-4 overflow-hidden rounded-xl p-0 sm:max-w-4xl"
            >
                <DialogHeader className="border-b border-slate-200 px-5 py-4 pr-14 text-left">
                    <DialogTitle className="text-lg/7 text-slate-950">
                        หลักฐานประกอบคำขอลา
                    </DialogTitle>
                    <DialogDescription className="text-sm/6 text-slate-600">
                        รูปที่ {safeActiveIndex + 1} จาก {attachmentCount}
                    </DialogDescription>
                </DialogHeader>

                <DialogClose asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-3 top-3 text-slate-600"
                        aria-label="ปิดหน้าต่างหลักฐาน"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </Button>
                </DialogClose>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
                    <div className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-xl bg-slate-950 sm:min-h-[28rem]">
                        {activeImageUrl ? (
                            <Image
                                key={activeAttachment.id}
                                src={activeImageUrl}
                                alt={`หลักฐานประกอบคำขอลา รูปที่ ${safeActiveIndex + 1} จาก ${attachmentCount}`}
                                fill
                                unoptimized
                                priority
                                sizes="(max-width: 640px) 100vw, 896px"
                                className="object-contain"
                            />
                        ) : null}

                        {activeLoadState === "loading" ? (
                            <div
                                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-200"
                                role="status"
                            >
                                <div className="h-8 w-8 animate-pulse rounded-full bg-slate-700 motion-reduce:animate-none" />
                                <span className="text-sm">กำลังโหลดหลักฐาน…</span>
                            </div>
                        ) : null}

                        {activeLoadState === "error" ? (
                            <div
                                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 px-6 text-center text-slate-100"
                                role="alert"
                            >
                                <FileImage className="h-9 w-9 text-slate-400" aria-hidden="true" />
                                <p className="text-sm/6">
                                    ไม่สามารถเปิดหลักฐานได้ กรุณาลองใหม่ภายหลัง
                                </p>
                            </div>
                        ) : null}

                        {attachmentCount > 1 ? (
                            <>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="icon"
                                    className="absolute left-3 top-1/2 -translate-y-1/2"
                                    aria-label="ดูรูปก่อนหน้า"
                                    onClick={() => changeImage(-1)}
                                >
                                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="icon"
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                    aria-label="ดูรูปถัดไป"
                                    onClick={() => changeImage(1)}
                                >
                                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                </Button>
                            </>
                        ) : null}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {attachmentCount > 1 ? (
                            <div
                                className="flex gap-2 overflow-x-auto pb-1"
                                role="group"
                                aria-label="รูปหลักฐานทั้งหมด"
                            >
                                {attachments.map((attachment, index) => {
                                    const thumbnailUrl =
                                        imageStates[attachment.id]?.objectUrl;

                                    return (
                                        <button
                                            key={attachment.id}
                                            type="button"
                                            className={cn(
                                                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2",
                                                index === safeActiveIndex
                                                    ? "border-indigo-600"
                                                    : "border-transparent hover:border-slate-400",
                                            )}
                                            aria-label={`ดูหลักฐานรูปที่ ${index + 1}`}
                                            aria-current={index === safeActiveIndex ? "true" : undefined}
                                            onClick={() => setActiveIndex(index)}
                                        >
                                            {thumbnailUrl ? (
                                                <Image
                                                    src={thumbnailUrl}
                                                    alt=""
                                                    fill
                                                    unoptimized
                                                    loading="lazy"
                                                    sizes="64px"
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <span className="text-sm font-medium text-slate-600">
                                                    {index + 1}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <span className="text-sm text-slate-500">มีหลักฐาน 1 รูป</span>
                        )}

                        {activeImageUrl ? (
                            <Button variant="outline" size="sm" asChild>
                                <a
                                    href={activeImageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                    เปิดหลักฐานในแท็บใหม่
                                </a>
                            </Button>
                        ) : (
                            <Button variant="outline" size="sm" disabled>
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                เปิดหลักฐานในแท็บใหม่
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
