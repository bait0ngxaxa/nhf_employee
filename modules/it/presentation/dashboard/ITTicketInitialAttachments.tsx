"use client";

/* eslint-disable @next/next/no-img-element -- Private images are fetched with the authenticated browser session. */

import { useEffect, useState, type ReactElement } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { API_ROUTES } from "@/lib/ssot/routes";

import type { ITTicketAttachmentSummary } from "../../contracts";

export type ITTicketAttachmentBlobLoader = (
    attachmentId: string,
    signal: AbortSignal,
) => Promise<Blob>;

async function fetchDashboardITTicketAttachment(
    attachmentId: string,
    signal: AbortSignal,
): Promise<Blob> {
    const response = await fetch(API_ROUTES.itTicketAttachments.byId(attachmentId), {
        cache: "no-store",
        credentials: "include",
        signal,
    });
    if (!response.ok) throw new Error("ไม่สามารถเปิดรูปภาพได้");
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
    const blob = await response.blob();
    if (contentType !== "image/webp" || blob.type !== "image/webp") {
        throw new Error("ชนิดรูปภาพไม่ถูกต้อง");
    }
    return blob;
}

function formatSize(sizeBytes: number): string {
    return `${(sizeBytes / (1024 * 1024)).toLocaleString("th-TH", {
        maximumFractionDigits: 1,
    })} MiB`;
}

function InitialAttachmentImage({
    attachment,
    loadBlob,
}: {
    readonly attachment: ITTicketAttachmentSummary;
    readonly loadBlob: ITTicketAttachmentBlobLoader;
}): ReactElement {
    const [retry, setRetry] = useState(0);
    const [state, setState] = useState<
        | { readonly key: string; readonly kind: "loaded"; readonly url: string }
        | { readonly key: string; readonly kind: "error" }
        | null
    >(null);
    const key = `${attachment.id}:${retry}`;
    const current = state?.key === key ? state : null;

    useEffect(() => {
        const controller = new AbortController();
        let objectUrl: string | null = null;
        void loadBlob(attachment.id, controller.signal)
            .then((blob) => {
                if (blob.type !== "image/webp") throw new Error("Invalid private image type");
                objectUrl = URL.createObjectURL(blob);
                if (controller.signal.aborted) {
                    URL.revokeObjectURL(objectUrl);
                    objectUrl = null;
                    return;
                }
                setState({ key, kind: "loaded", url: objectUrl });
            })
            .catch(() => {
                if (!controller.signal.aborted) setState({ key, kind: "error" });
            });
        return () => {
            controller.abort();
            if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
        };
    }, [attachment.id, key, loadBlob]);

    return (
        <li className="min-w-0">
            <figure className="space-y-1.5">
                {current?.kind === "loaded" ? (
                    <a
                        href={current.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`เปิดภาพประกอบ ${attachment.originalName}`}
                        className="block overflow-hidden rounded-md border border-border-neutral bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        <img
                            src={current.url}
                            alt={`รูปภาพประกอบ: ${attachment.originalName}`}
                            width={attachment.width}
                            height={attachment.height}
                            loading="lazy"
                            decoding="async"
                            className="aspect-[4/3] max-h-64 w-full object-contain"
                        />
                    </a>
                ) : current?.kind === "error" ? (
                    <div role="alert" className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                        <CircleAlert aria-hidden="true" className="size-5" />
                        <span>เปิดรูปภาพไม่ได้</span>
                        <Button type="button" variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>
                            <RefreshCw aria-hidden="true" className="size-4" />
                            ลองอีกครั้ง
                        </Button>
                    </div>
                ) : (
                    <div role="status" aria-label={`กำลังโหลดรูปภาพ ${attachment.originalName}`} className="flex min-h-36 items-center justify-center rounded-md border border-border-neutral bg-surface-subtle text-sm text-content-secondary">
                        กำลังโหลดรูปภาพ…
                    </div>
                )}
                <figcaption className="space-y-0.5 text-xs leading-5 text-content-secondary">
                    <span className="block break-words font-medium text-content-body">{attachment.originalName}</span>
                    <span className="block">{attachment.width} × {attachment.height} px · {formatSize(attachment.sizeBytes)}</span>
                </figcaption>
            </figure>
        </li>
    );
}

export function ITTicketInitialAttachments({
    attachments,
    loadBlob = fetchDashboardITTicketAttachment,
}: {
    readonly attachments: readonly ITTicketAttachmentSummary[];
    readonly loadBlob?: ITTicketAttachmentBlobLoader;
}): ReactElement | null {
    if (attachments.length === 0) return null;
    return (
        <section aria-labelledby="it-ticket-initial-attachments-heading" className="space-y-3">
            <h2 id="it-ticket-initial-attachments-heading" className="text-sm font-semibold text-content-heading">
                รูปภาพประกอบ
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {attachments.map((attachment) => (
                    <InitialAttachmentImage
                        key={attachment.id}
                        attachment={attachment}
                        loadBlob={loadBlob}
                    />
                ))}
            </ul>
        </section>
    );
}
