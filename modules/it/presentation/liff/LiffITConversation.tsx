"use client";

/* eslint-disable @next/next/no-img-element -- Private attachment bytes are fetched with the authenticated LIFF session and displayed from a protected Blob URL. */

import {
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type FormEvent,
    type ReactElement,
} from "react";
import {
    CircleAlert,
    RefreshCw,
    Send,
    X,
} from "lucide-react";
import type { ITTicketStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LiffApiError } from "@/modules/line/client";
import {
    IT_TICKET_ATTACHMENT_ACCEPTED_TYPES,
    IT_TICKET_ATTACHMENT_MAX_BYTES,
    IT_TICKET_ATTACHMENT_MAX_FILES,
    IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES,
    IT_TICKET_COMMENTABLE_STATUSES,
    IT_TICKET_COMMENT_MAX_LENGTH,
    IT_TICKET_STATUS_LABELS,
    type ITTicketAttachmentSummary,
    type ITTicketTimelineEvent,
    type ITTicketTimelineItem,
    type ITTicketTimelinePage,
} from "../../contracts";
import {
    createITTicketCommentAttemptSignature,
    validateITTicketAttachmentSelection,
    type SelectedITTicketAttachment,
} from "../dashboard/ticket-attachment-client";
import {
    formatITTicketDate,
    mergeITTicketTimelineItems,
} from "../dashboard/ticket-presentation";
import {
    fetchLiffITAttachment,
    fetchLiffITTicketTimeline,
    postLiffITTicketComment,
} from "./api";

type TimelineState =
    | { readonly key: string; readonly kind: "loaded"; readonly page: ITTicketTimelinePage }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof LiffApiError ? error.message : fallback;
}

function formatAttachmentSize(sizeBytes: number): string {
    return `${(sizeBytes / (1024 * 1024)).toLocaleString("th-TH", { maximumFractionDigits: 1 })} MiB`;
}

function eventDescription(event: ITTicketTimelineEvent): string {
    switch (event.type) {
        case "CREATED":
            return "สร้าง Ticket แล้ว";
        case "ASSIGNED":
        case "UNASSIGNED":
            return "เจ้าหน้าที่ IT อัปเดตการรับเรื่อง";
        case "STATUS_CHANGED":
            return `เปลี่ยนสถานะจาก ${event.fromStatus === null ? "ไม่ระบุสถานะ" : IT_TICKET_STATUS_LABELS[event.fromStatus]} เป็น ${event.toStatus === null ? "ไม่ระบุสถานะ" : IT_TICKET_STATUS_LABELS[event.toStatus]}`;
        case "CATEGORY_CHANGED":
            return "เจ้าหน้าที่ IT ปรับข้อมูลการจัดหมวดหมู่";
    }
}

function PrivateAttachment({
    attachment,
}: {
    readonly attachment: ITTicketAttachmentSummary;
}): ReactElement {
    const [retry, setRetry] = useState(0);
    const [imageState, setImageState] = useState<
        | { readonly key: string; readonly kind: "loaded"; readonly url: string }
        | { readonly key: string; readonly kind: "error"; readonly message: string }
        | null
    >(null);
    const requestKey = `${attachment.id}:${retry}`;
    const currentState = imageState?.key === requestKey ? imageState : null;

    useEffect(() => {
        const controller = new AbortController();
        let objectUrl: string | null = null;
        void fetchLiffITAttachment(attachment.id, controller.signal)
            .then((blob) => {
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(blob);
                setImageState({ key: requestKey, kind: "loaded", url: objectUrl });
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setImageState({
                    key: requestKey,
                    kind: "error",
                    message: getErrorMessage(error, "ไม่สามารถเปิดรูปภาพนี้ได้ กรุณาลองอีกครั้ง"),
                });
            });
        return () => {
            controller.abort();
            if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
        };
    }, [attachment.id, requestKey]);

    return (
        <figure className="min-w-0 space-y-2">
            <div className="flex min-h-28 items-center justify-center overflow-hidden rounded-lg border border-border-neutral bg-surface-subtle">
                {currentState === null ? (
                    <p role="status" className="px-3 py-4 text-center text-xs leading-5 text-content-muted">กำลังโหลดรูปภาพ…</p>
                ) : null}
                {currentState?.kind === "loaded" ? (
                    <img
                        src={currentState.url}
                        alt={`รูปภาพประกอบ: ${attachment.originalName}`}
                        width={attachment.width}
                        height={attachment.height}
                        loading="lazy"
                        className="max-h-64 w-full object-contain"
                    />
                ) : null}
                {currentState?.kind === "error" ? (
                    <div className="space-y-2 px-3 py-4 text-center">
                        <p role="alert" className="text-xs leading-5 text-rose-800 dark:text-rose-200">{currentState.message}</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}>
                            <RefreshCw aria-hidden="true" className="size-4" />
                            ลองอีกครั้ง
                        </Button>
                    </div>
                ) : null}
            </div>
            <figcaption className="space-y-0.5 text-xs leading-5 text-content-muted">
                <span className="block break-words font-medium text-content-body">{attachment.originalName}</span>
                <span className="block">{attachment.width} × {attachment.height} px · {formatAttachmentSize(attachment.sizeBytes)}</span>
            </figcaption>
        </figure>
    );
}

function TimelineItem({ item }: { readonly item: ITTicketTimelineItem }): ReactElement {
    if (item.type !== "COMMENT") {
        return (
            <li className="py-2">
                <article className="mx-auto max-w-[92%] rounded-lg bg-surface-subtle px-3 py-2 text-center">
                    <p className="text-xs font-semibold leading-5 text-content-secondary">{eventDescription(item)}</p>
                    <time dateTime={item.createdAt} className="mt-1 block text-xs tabular-nums text-content-muted">{formatITTicketDate(item.createdAt)}</time>
                </article>
            </li>
        );
    }

    const requesterMessage = item.authorSide === "REQUESTER";
    return (
        <li className={`flex py-2 ${requesterMessage ? "justify-end" : "justify-start"}`}>
            <article className={`min-w-0 max-w-[90%] rounded-2xl px-3.5 py-3 ${requesterMessage ? "rounded-br-md bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-50" : "rounded-bl-md border border-border-neutral bg-surface-raised text-content-body"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="break-words text-xs font-semibold leading-5">
                        {item.authorDisplayName}
                        <span className="ml-2 font-medium opacity-75">{requesterMessage ? "ผู้แจ้ง" : "เจ้าหน้าที่ IT"}</span>
                    </p>
                    <time dateTime={item.createdAt} className="text-xs tabular-nums opacity-75">{formatITTicketDate(item.createdAt)}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{item.body}</p>
                {item.attachments.length > 0 ? (
                    <ul aria-label="รูปภาพที่แนบมากับข้อความ" className="mt-3 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                        {item.attachments.map((attachment) => (
                            <li key={attachment.id} className="min-w-0">
                                <PrivateAttachment attachment={attachment} />
                            </li>
                        ))}
                    </ul>
                ) : null}
            </article>
        </li>
    );
}

export function LiffITConversation({
    ticketId,
    status,
    refreshVersion,
    ticketRefreshing,
    onTicketRefresh,
}: {
    readonly ticketId: number;
    readonly status: ITTicketStatus;
    readonly refreshVersion: number;
    readonly ticketRefreshing: boolean;
    readonly onTicketRefresh: () => void;
}): ReactElement {
    const [timelineState, setTimelineState] = useState<TimelineState | null>(null);
    const [retry, setRetry] = useState(0);
    const [olderBusy, setOlderBusy] = useState(false);
    const [olderErrorState, setOlderErrorState] = useState<{ readonly key: string; readonly message: string } | null>(null);
    const [draft, setDraft] = useState("");
    const [selectedAttachments, setSelectedAttachments] = useState<SelectedITTicketAttachment[]>([]);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const [postErrorState, setPostErrorState] = useState<{
        readonly refreshVersion: number;
        readonly message: string;
    } | null>(null);
    const [postMessage, setPostMessage] = useState<string | null>(null);
    const [posting, setPosting] = useState(false);
    const [postingDeniedAt, setPostingDeniedAt] = useState<number | null>(null);
    const [refreshAfterConflictAt, setRefreshAfterConflictAt] = useState<number | null>(null);
    const selectedAttachmentsRef = useRef<SelectedITTicketAttachment[]>([]);
    const postInFlightRef = useRef(false);
    const olderInFlightRef = useRef(false);
    const olderControllerRef = useRef<AbortController | null>(null);
    const commentAttemptRef = useRef<{ readonly signature: string; readonly key: string } | null>(null);

    const requestKey = `${ticketId}:${refreshVersion}:${retry}`;
    const timeline = timelineState?.key === requestKey && timelineState.kind === "loaded"
        ? timelineState.page
        : null;
    const timelineError = timelineState?.key === requestKey && timelineState.kind === "error"
        ? timelineState.message
        : null;
    const olderError = olderErrorState?.key === requestKey ? olderErrorState.message : null;
    const postError = postErrorState?.refreshVersion === refreshVersion
        ? postErrorState.message
        : null;
    const loading = timeline === null && timelineError === null;
    const commentable = IT_TICKET_COMMENTABLE_STATUSES.some((candidate) => candidate === status);
    const canReply = commentable
        && postingDeniedAt !== refreshVersion
        && !ticketRefreshing;

    const updateSelectedAttachments = (next: SelectedITTicketAttachment[]): void => {
        selectedAttachmentsRef.current = next;
        setSelectedAttachments(next);
    };

    useEffect(() => {
        const controller = new AbortController();
        void fetchLiffITTicketTimeline(ticketId, { signal: controller.signal })
            .then((page) => {
                if (!controller.signal.aborted) {
                    setTimelineState({ key: requestKey, kind: "loaded", page });
                }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setTimelineState({
                    key: requestKey,
                    kind: "error",
                    message: getErrorMessage(error, "ไม่สามารถโหลดประวัติ Ticket ได้ กรุณาลองอีกครั้ง"),
                });
            });
        return () => {
            controller.abort();
            olderControllerRef.current?.abort();
        };
    }, [requestKey, ticketId]);

    useEffect(() => () => {
        olderControllerRef.current?.abort();
        for (const attachment of selectedAttachmentsRef.current) {
            URL.revokeObjectURL(attachment.previewUrl);
        }
    }, []);

    const loadOlder = async (): Promise<void> => {
        const cursor = timeline?.olderCursor;
        if (!cursor || olderInFlightRef.current) return;
        const controller = new AbortController();
        olderControllerRef.current = controller;
        olderInFlightRef.current = true;
        setOlderBusy(true);
        setOlderErrorState(null);
        try {
            const olderPage = await fetchLiffITTicketTimeline(ticketId, {
                cursor,
                signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            setTimelineState((current) => {
                if (current?.key !== requestKey || current.kind !== "loaded") return current;
                return {
                    key: requestKey,
                    kind: "loaded",
                    page: {
                        items: mergeITTicketTimelineItems(olderPage.items, current.page.items),
                        olderCursor: olderPage.olderCursor,
                        hasMore: olderPage.hasMore,
                    },
                };
            });
        } catch (error) {
            if (controller.signal.aborted) return;
            setOlderErrorState({
                key: requestKey,
                message: getErrorMessage(error, "ไม่สามารถโหลดประวัติก่อนหน้าได้ กรุณาลองอีกครั้ง"),
            });
        } finally {
            if (olderControllerRef.current === controller) {
                olderControllerRef.current = null;
                olderInFlightRef.current = false;
                setOlderBusy(false);
            }
        }
    };

    const handleAttachmentSelection = (event: ChangeEvent<HTMLInputElement>): void => {
        const input = event.currentTarget;
        const incoming = Array.from(input.files ?? []);
        input.value = "";
        if (incoming.length === 0) return;

        const validationError = validateITTicketAttachmentSelection(
            selectedAttachmentsRef.current.map((attachment) => attachment.file),
            incoming,
        );
        if (validationError !== null) {
            setAttachmentError(validationError);
            return;
        }

        commentAttemptRef.current = null;
        setAttachmentError(null);
        setPostErrorState(null);
        setPostMessage(null);
        updateSelectedAttachments([
            ...selectedAttachmentsRef.current,
            ...incoming.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
        ]);
    };

    const removeAttachment = (index: number): void => {
        const current = selectedAttachmentsRef.current;
        const removed = current[index];
        if (!removed) return;
        URL.revokeObjectURL(removed.previewUrl);
        commentAttemptRef.current = null;
        updateSelectedAttachments(current.filter((_, currentIndex) => currentIndex !== index));
        setAttachmentError(null);
        setPostErrorState(null);
        setPostMessage(null);
    };

    const handleDraftChange = (nextDraft: string): void => {
        if (nextDraft.trim() !== draft.trim()) commentAttemptRef.current = null;
        setDraft(nextDraft);
        setPostErrorState(null);
        setPostMessage(null);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        const body = draft.trim();
        if (!body || !canReply || postInFlightRef.current) return;

        const files = selectedAttachmentsRef.current.map((attachment) => attachment.file);
        postInFlightRef.current = true;
        setPosting(true);
        setPostErrorState(null);
        setPostMessage(null);
        try {
            const signature = await createITTicketCommentAttemptSignature(
                ticketId,
                false,
                body,
                files,
            );
            const existingAttempt = commentAttemptRef.current;
            const attempt = existingAttempt?.signature === signature
                ? existingAttempt
                : { signature, key: globalThis.crypto.randomUUID() };
            commentAttemptRef.current = attempt;

            const result = await postLiffITTicketComment(ticketId, body, files, attempt.key);
            if (timeline !== null) {
                setTimelineState((current) => {
                    if (current?.key !== requestKey || current.kind !== "loaded") return current;
                    return {
                        key: requestKey,
                        kind: "loaded",
                        page: {
                            ...current.page,
                            items: mergeITTicketTimelineItems(current.page.items, [result.comment]),
                        },
                    };
                });
            } else {
                setRetry((value) => value + 1);
            }

            setDraft("");
            for (const attachment of selectedAttachmentsRef.current) {
                URL.revokeObjectURL(attachment.previewUrl);
            }
            updateSelectedAttachments([]);
            setAttachmentError(null);
            commentAttemptRef.current = null;
            setPostMessage(result.replayed ? "ข้อความนี้ส่งเรียบร้อยแล้ว" : "ส่งข้อความเรียบร้อยแล้ว");
        } catch (error) {
            if (error instanceof LiffApiError && [403, 404, 409].includes(error.status ?? 0)) {
                setPostingDeniedAt(refreshVersion);
                setRefreshAfterConflictAt(error.status === 409 ? refreshVersion : null);
            }
            setPostErrorState({
                refreshVersion,
                message: getErrorMessage(error, "ไม่สามารถส่งข้อความได้ กรุณาลองอีกครั้ง"),
            });
        } finally {
            postInFlightRef.current = false;
            setPosting(false);
        }
    };

    return (
        <div className="space-y-4">
            {loading ? (
                <div role="status" aria-label="กำลังโหลดการสนทนา" className="space-y-3 rounded-xl border border-border-neutral bg-surface-raised p-4">
                    <div className="h-16 animate-pulse motion-reduce:animate-none rounded-xl bg-surface-subtle" />
                    <div className="ml-auto h-16 w-4/5 animate-pulse motion-reduce:animate-none rounded-xl bg-surface-subtle" />
                </div>
            ) : null}
            {timelineError ? (
                <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                    <p className="flex items-start gap-2"><CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />{timelineError}</p>
                    <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setRetry((value) => value + 1)}>
                        <RefreshCw aria-hidden="true" className="size-4" />
                        โหลดประวัติอีกครั้ง
                    </Button>
                </div>
            ) : null}
            {timeline ? (
                <>
                    {timeline.hasMore ? (
                        <div className="space-y-2">
                            {olderError ? <p role="alert" className="text-sm leading-6 text-rose-800 dark:text-rose-200">{olderError}</p> : null}
                            <Button type="button" variant="outline" className="min-h-11 w-full" disabled={olderBusy} onClick={() => void loadOlder()}>
                                <RefreshCw aria-hidden="true" className={`size-4 motion-reduce:animate-none ${olderBusy ? "animate-spin" : ""}`} />
                                {olderBusy ? "กำลังโหลดประวัติเก่า…" : olderError ? "ลองโหลดประวัติเก่าอีกครั้ง" : "ดูประวัติก่อนหน้า"}
                            </Button>
                        </div>
                    ) : null}
                    {timeline.items.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border-neutral bg-surface-raised px-4 py-6 text-center text-sm leading-6 text-content-secondary">
                            ยังไม่มีข้อความหรือประวัติการดำเนินการ
                        </p>
                    ) : (
                        <ol aria-label="ลำดับการสนทนาและเหตุการณ์ Ticket" className="space-y-1">
                            {timeline.items.map((item) => (
                                <TimelineItem key={`${item.type}:${item.id}`} item={item} />
                            ))}
                        </ol>
                    )}
                </>
            ) : null}

            {!commentable ? (
                <p className="rounded-xl border border-border-neutral bg-surface-subtle p-4 text-sm leading-6 text-content-secondary">
                    Ticket นี้อยู่ในสถานะ {IT_TICKET_STATUS_LABELS[status]} จึงอ่านประวัติได้ แต่ไม่สามารถส่งข้อความตอบกลับได้
                </p>
            ) : null}
            {commentable && status === "WAITING_REQUESTER" ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    การตอบกลับของคุณจะไม่เปลี่ยนสถานะ Ticket โดยอัตโนมัติ
                </p>
            ) : null}
            {postError && !canReply ? (
                <div role="alert" className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                    <p className="flex items-start gap-2"><CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />{postError}</p>
                    {refreshAfterConflictAt === refreshVersion ? (
                        <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onTicketRefresh}>
                            <RefreshCw aria-hidden="true" className="size-4" />
                            โหลดสถานะ Ticket ล่าสุด
                        </Button>
                    ) : null}
                </div>
            ) : null}
            {canReply ? (
                <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 rounded-xl border border-border-neutral bg-surface-raised p-4">
                    <label htmlFor={`liff-it-comment-${ticketId}`} className="block text-sm font-semibold text-content-heading">ตอบกลับ</label>
                    <Textarea
                        id={`liff-it-comment-${ticketId}`}
                        value={draft}
                        onChange={(event) => handleDraftChange(event.currentTarget.value)}
                        maxLength={IT_TICKET_COMMENT_MAX_LENGTH}
                        rows={4}
                        disabled={posting}
                        placeholder="พิมพ์ข้อความที่ต้องการส่งถึงเจ้าหน้าที่ IT"
                        aria-describedby={`liff-it-comment-count-${ticketId}`}
                        className="min-h-28 resize-y text-base leading-7"
                    />
                    <p id={`liff-it-comment-count-${ticketId}`} className="text-right text-xs tabular-nums text-content-muted">{draft.length}/{IT_TICKET_COMMENT_MAX_LENGTH}</p>

                    <div className="space-y-2">
                        <label htmlFor={`liff-it-attachments-${ticketId}`} className="block text-sm font-semibold text-content-heading">รูปภาพประกอบ (ไม่บังคับ)</label>
                        <input
                            id={`liff-it-attachments-${ticketId}`}
                            type="file"
                            multiple
                            accept={`${IT_TICKET_ATTACHMENT_ACCEPTED_TYPES.join(",")},.jpg,.jpeg,.png,.webp`}
                            disabled={posting || selectedAttachments.length >= IT_TICKET_ATTACHMENT_MAX_FILES}
                            onChange={handleAttachmentSelection}
                            aria-describedby={`liff-it-attachments-help-${ticketId}`}
                            aria-invalid={attachmentError ? true : undefined}
                            className="block min-h-12 w-full cursor-pointer rounded-md border border-border-neutral bg-surface-raised text-sm text-content-body file:mr-3 file:min-h-11 file:cursor-pointer file:border-0 file:bg-surface-subtle file:px-3 file:font-medium file:text-content-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <p id={`liff-it-attachments-help-${ticketId}`} className="text-xs leading-5 text-content-muted">
                            JPG, PNG หรือ WEBP · สูงสุด {IT_TICKET_ATTACHMENT_MAX_FILES} รูป · ไม่เกิน {formatAttachmentSize(IT_TICKET_ATTACHMENT_MAX_BYTES)} ต่อรูป และ {formatAttachmentSize(IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES)} รวม
                        </p>
                    </div>

                    {attachmentError ? <p role="alert" className="text-sm leading-6 text-rose-800 dark:text-rose-200">{attachmentError}</p> : null}
                    {selectedAttachments.length > 0 ? (
                        <ul aria-label="รูปภาพที่เลือก" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                            {selectedAttachments.map((attachment, index) => (
                                <li key={`${attachment.file.name}:${attachment.previewUrl}`} className="min-w-0 space-y-2">
                                    <div className="relative overflow-hidden rounded-lg border border-border-neutral bg-surface-subtle">
                                        <img src={attachment.previewUrl} alt={`ตัวอย่างรูปภาพ ${attachment.file.name}`} className="max-h-48 w-full object-contain" />
                                        <button
                                            type="button"
                                            aria-label={`นำรูปภาพ ${attachment.file.name} ออก`}
                                            disabled={posting}
                                            onClick={() => removeAttachment(index)}
                                            className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-full bg-surface-raised text-content-heading shadow-sm hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                                        >
                                            <X aria-hidden="true" className="size-4" />
                                        </button>
                                    </div>
                                    <p className="break-words text-xs leading-5 text-content-secondary">{attachment.file.name} · {formatAttachmentSize(attachment.file.size)}</p>
                                </li>
                            ))}
                        </ul>
                    ) : null}

                    {postError ? (
                        <div role="alert" className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                            <p className="flex items-start gap-2"><CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />{postError}</p>
                            {refreshAfterConflictAt === refreshVersion ? (
                                <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onTicketRefresh}>
                                    <RefreshCw aria-hidden="true" className="size-4" />
                                    โหลดสถานะ Ticket ล่าสุด
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                    {postMessage ? <p role="status" className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{postMessage}</p> : null}
                    <Button type="submit" disabled={posting || !draft.trim()} className="min-h-12 w-full text-base">
                        {posting ? <RefreshCw aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Send aria-hidden="true" className="size-4" />}
                        {posting ? "กำลังส่งข้อความ…" : "ส่งข้อความ"}
                    </Button>
                </form>
            ) : null}
        </div>
    );
}
