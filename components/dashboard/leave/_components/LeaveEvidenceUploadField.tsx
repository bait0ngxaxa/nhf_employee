"use client";

import Image from "next/image";
import {
    ImagePlus,
    ShieldCheck,
    Trash2,
} from "lucide-react";
import {
    useEffect,
    useId,
    useRef,
    useState,
    type ChangeEvent,
} from "react";

import { Button } from "@/components/ui/button";
import {
    LEAVE_ATTACHMENT_ACCEPTED_TYPES,
    LEAVE_ATTACHMENT_MAX_FILES,
    LEAVE_ATTACHMENT_MAX_MB,
    LEAVE_ATTACHMENT_MAX_TOTAL_MB,
} from "@/lib/ssot/leave-attachments";

interface LeaveEvidenceUploadFieldProps {
    attachments: readonly File[];
    attachmentError: string | null;
    disabled: boolean;
    addAttachments: (files: readonly File[]) => void;
    removeAttachment: (index: number) => void;
}

interface AttachmentPreview {
    file: File;
    url: string;
}

function formatFileSize(sizeBytes: number): string {
    const sizeKilobytes = Math.ceil(sizeBytes / 1024);
    if (sizeKilobytes < 1024) {
        return `${Math.max(1, sizeKilobytes)} KB`;
    }

    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeaveEvidenceUploadField({
    attachments,
    attachmentError,
    disabled,
    addAttachments,
    removeAttachment,
}: LeaveEvidenceUploadFieldProps) {
    const inputId = useId();
    const descriptionId = useId();
    const errorId = useId();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const objectUrlsRef = useRef(new Map<File, string>());
    const [previews, setPreviews] = useState<AttachmentPreview[]>([]);

    useEffect(() => {
        const objectUrls = objectUrlsRef.current;
        const activeFiles = new Set(attachments);

        for (const [file, url] of objectUrls) {
            if (!activeFiles.has(file)) {
                URL.revokeObjectURL(url);
                objectUrls.delete(file);
            }
        }

        const nextPreviews = attachments.map((file) => {
            const existingUrl = objectUrls.get(file);
            if (existingUrl) {
                return { file, url: existingUrl };
            }

            const url = URL.createObjectURL(file);
            objectUrls.set(file, url);
            return { file, url };
        });
        setPreviews(nextPreviews);
    }, [attachments]);

    useEffect(
        () => () => {
            for (const url of objectUrlsRef.current.values()) {
                URL.revokeObjectURL(url);
            }
            objectUrlsRef.current.clear();
        },
        [],
    );

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const files = Array.from(event.currentTarget.files ?? []);
        if (files.length > 0) {
            addAttachments(files);
        }
        event.currentTarget.value = "";
    };

    const hasReachedLimit = attachments.length >= LEAVE_ATTACHMENT_MAX_FILES;
    const pickerDisabled = disabled || hasReachedLimit;
    const describedBy = attachmentError
        ? `${descriptionId} ${errorId}`
        : descriptionId;

    return (
        <section className="grid gap-3" aria-labelledby={`${inputId}-label`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                    id={`${inputId}-label`}
                    htmlFor={inputId}
                    className="text-sm font-medium text-foreground"
                >
                    ไฟล์แนบประกอบคำขอลา{" "}
                    <span className="font-normal text-muted-foreground">
                        (ไม่บังคับ)
                    </span>
                </label>
                <span className="text-xs font-medium text-muted-foreground">
                    {attachments.length}/{LEAVE_ATTACHMENT_MAX_FILES} ไฟล์
                </span>
            </div>

            <div
                className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4"
                aria-invalid={attachmentError ? true : undefined}
            >
                <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    multiple
                    accept={LEAVE_ATTACHMENT_ACCEPTED_TYPES.join(",")}
                    disabled={pickerDisabled}
                    aria-label="เลือกไฟล์รูปภาพประกอบคำขอลา"
                    aria-describedby={describedBy}
                    className="sr-only"
                    onChange={handleFileChange}
                />

                {previews.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {previews.map(({ file, url }, index) => (
                            <article
                                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                                className="min-w-0 overflow-hidden rounded-lg border border-border bg-background"
                            >
                                <div className="relative aspect-[4/3] bg-muted">
                                    <Image
                                        src={url}
                                        alt={`ตัวอย่างรูปภาพ ${file.name}`}
                                        fill
                                        sizes="(max-width: 640px) 100vw, 320px"
                                        unoptimized
                                        className="object-cover"
                                    />
                                </div>
                                <div className="flex items-center gap-2 p-3">
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className="truncate text-sm font-medium text-foreground"
                                            title={file.name}
                                        >
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatFileSize(file.size)}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        disabled={disabled}
                                        aria-label={`ลบไฟล์แนบ ${file.name}`}
                                        onClick={() => removeAttachment(index)}
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <Trash2 aria-hidden="true" />
                                    </Button>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="py-2 text-center text-sm text-muted-foreground">
                        ยังไม่มีไฟล์แนบ
                    </div>
                )}

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={pickerDisabled}
                        onClick={() => inputRef.current?.click()}
                        className="w-full sm:w-auto"
                    >
                        <ImagePlus aria-hidden="true" />
                        {attachments.length > 0
                            ? "เพิ่มรูปภาพ"
                            : "เลือกรูปภาพ"}
                    </Button>
                    <p
                        id={descriptionId}
                        className="text-xs leading-5 text-muted-foreground"
                    >
                        JPG, PNG หรือ WEBP ไม่เกิน {LEAVE_ATTACHMENT_MAX_MB} MB
                        ต่อรูป และรวมไม่เกิน {LEAVE_ATTACHMENT_MAX_TOTAL_MB} MB
                    </p>
                </div>
            </div>

            <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <p>
                    ไฟล์แนบเป็นข้อมูลส่วนบุคคลและใช้ประกอบการพิจารณาคำขอลาเท่านั้น
                </p>
            </div>

            {attachmentError ? (
                <p
                    id={errorId}
                    role="alert"
                    aria-live="assertive"
                    className="text-sm font-medium text-destructive"
                >
                    {attachmentError}
                </p>
            ) : null}
        </section>
    );
}
