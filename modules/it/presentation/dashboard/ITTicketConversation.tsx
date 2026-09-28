"use client";

/* eslint-disable @next/next/no-img-element -- Protected images must load in the authenticated browser, not through Next's server optimizer. */

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactElement } from "react";
import { CircleAlert, MessageSquareText, RefreshCw, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { API_ROUTES } from "@/lib/ssot/routes";

import {
    IT_TICKET_COMMENTABLE_STATUSES,
    IT_TICKET_COMMENT_MAX_LENGTH,
    IT_TICKET_ATTACHMENT_ACCEPTED_TYPES,
    IT_TICKET_ATTACHMENT_MAX_BYTES,
    IT_TICKET_ATTACHMENT_MAX_FILES,
    IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES,
    IT_TICKET_STATUS_LABELS,
    IT_TICKET_CONVERSATION_DEFAULT_LIMIT,
    type ITTicketConversationItem,
    type ITTicketConversationPage,
} from "../../contracts";
import type { ITTicketStatus } from "@prisma/client";
import {
    createITTicketCommentAttemptSignature,
    validateITTicketAttachmentSelection,
    type SelectedITTicketAttachment,
} from "./ticket-attachment-client";
import {
    formatITTicketDate,
    mergeITTicketConversationItems,
    parseITTicketCommentSubmission,
    parseITTicketConversationPage,
    readITTicketReadError,
} from "./ticket-presentation";

type ConversationState =
    | { readonly key: string; readonly kind: "loaded"; readonly page: ITTicketConversationPage }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

function conversationRoute(ticketId: number, operator: boolean): string {
    const base = operator
        ? API_ROUTES.itOperatorTickets.conversationById(ticketId)
        : API_ROUTES.itTickets.conversationById(ticketId);
    return `${base}?limit=${IT_TICKET_CONVERSATION_DEFAULT_LIMIT}`;
}

function commentsRoute(ticketId: number, operator: boolean): string {
    return operator
        ? API_ROUTES.itOperatorTickets.commentsById(ticketId)
        : API_ROUTES.itTickets.commentsById(ticketId);
}

function isCommentable(status: ITTicketStatus): boolean {
    return IT_TICKET_COMMENTABLE_STATUSES.some((candidate) => candidate === status);
}

function formatAttachmentSize(sizeBytes: number): string {
    return `${(sizeBytes / (1024 * 1024)).toLocaleString("th-TH", {
        maximumFractionDigits: 1,
    })} MiB`;
}

function ConversationEntry({ item }: { readonly item: ITTicketConversationItem }): ReactElement {
    const isOperatorMessage = item.authorSide === "OPERATOR";
    return (
        <li className="relative pb-5 last:pb-0">
            <span aria-hidden="true" className="absolute -left-[1.35rem] top-1.5 size-2.5 rounded-full border-2 border-surface-raised bg-brand-solid ring-1 ring-border-neutral" />
            <article className={`rounded-lg border border-border-neutral p-3 sm:p-4 ${isOperatorMessage ? "bg-sky-50/70 dark:bg-sky-950/25" : "bg-surface-raised"}`}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <p className="text-sm font-medium leading-6 text-content-heading [overflow-wrap:anywhere]">
                        <span>{item.authorDisplayName}</span>
                        <span className="ml-2 text-xs font-normal text-content-muted">
                            {item.authorSide === "REQUESTER" ? "ผู้แจ้ง" : "เจ้าหน้าที่ IT"}
                        </span>
                    </p>
                    <time dateTime={item.createdAt} className="shrink-0 text-xs tabular-nums text-content-muted">
                        {formatITTicketDate(item.createdAt)}
                    </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-content-body">
                    {item.body}
                </p>
                {item.attachments.length > 0 ? (
                    <ul aria-label="รูปภาพที่แนบมากับข้อความ" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {item.attachments.map((attachment) => {
                            const imageUrl = API_ROUTES.itTicketAttachments.byId(attachment.id);
                            return (
                                <li key={attachment.id} className="min-w-0">
                                    <figure className="space-y-1.5">
                                        <a
                                            href={imageUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`เปิดภาพแนบ ${attachment.originalName}`}
                                            className="block overflow-hidden rounded-md border border-border-neutral bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            <img
                                                src={imageUrl}
                                                alt={`ภาพแนบจาก ${item.authorDisplayName}: ${attachment.originalName}`}
                                                width={attachment.width}
                                                height={attachment.height}
                                                loading="lazy"
                                                className="aspect-[4/3] max-h-56 w-full object-contain"
                                            />
                                        </a>
                                        <figcaption className="space-y-0.5 text-xs leading-5 text-content-secondary">
                                            <span className="block break-words font-medium text-content-body">
                                                {attachment.originalName}
                                            </span>
                                            <span className="block">
                                                {attachment.width} × {attachment.height} px · {formatAttachmentSize(attachment.sizeBytes)}
                                            </span>
                                        </figcaption>
                                    </figure>
                                </li>
                            );
                        })}
                    </ul>
                ) : null}
            </article>
        </li>
    );
}

export function ITTicketConversation({
    ticketId,
    status,
    canComment,
    operator,
}: {
    readonly ticketId: number;
    readonly status: ITTicketStatus;
    readonly canComment: boolean;
    readonly operator: boolean;
}): ReactElement {
    const [conversationState, setConversationState] = useState<ConversationState | null>(null);
    const [conversationRetry, setConversationRetry] = useState(0);
    const [olderBusy, setOlderBusy] = useState(false);
    const [olderError, setOlderError] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [selectedAttachments, setSelectedAttachmentsState] = useState<SelectedITTicketAttachment[]>([]);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState<string | null>(null);
    const [postMessage, setPostMessage] = useState<string | null>(null);
    const [postingDenied, setPostingDenied] = useState(false);
    const requestKey = `${ticketId}:${operator ? "operator" : "requester"}:${conversationRetry}`;
    const currentConversation = conversationState?.key === requestKey ? conversationState : null;
    const loadedConversation = currentConversation?.kind === "loaded" ? currentConversation.page : null;
    const conversationError = currentConversation?.kind === "error" ? currentConversation.message : null;
    const loading = currentConversation === null;
    const commentable = isCommentable(status);
    const canPost = canComment && commentable && !postingDenied;
    const postInFlight = useRef(false);
    const olderInFlight = useRef(false);
    const selectedAttachmentsRef = useRef<SelectedITTicketAttachment[]>([]);
    const idempotencyAttempt = useRef<{ readonly signature: string; readonly key: string } | null>(null);

    const updateSelectedAttachments = (next: SelectedITTicketAttachment[]): void => {
        selectedAttachmentsRef.current = next;
        setSelectedAttachmentsState(next);
    };

    useEffect(() => () => {
        for (const attachment of selectedAttachmentsRef.current) {
            URL.revokeObjectURL(attachment.previewUrl);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void fetch(conversationRoute(ticketId, operator), { signal: controller.signal })
            .then(async (response) => {
                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) {
                    throw new Error(readITTicketReadError(payload, response.status, operator));
                }
                const page = parseITTicketConversationPage(payload);
                if (page === null) throw new Error("ข้อมูลการสนทนาไม่ถูกต้อง กรุณาลองอีกครั้ง");
                if (!controller.signal.aborted) {
                    setConversationState({ key: requestKey, kind: "loaded", page });
                }
            })
            .catch((cause: unknown) => {
                if (controller.signal.aborted) return;
                setConversationState({
                    key: requestKey,
                    kind: "error",
                    message: cause instanceof Error
                        ? cause.message
                        : readITTicketReadError(null, 500, operator),
                });
            });
        return () => controller.abort();
    }, [ticketId, operator, requestKey]);

    const loadOlder = async (): Promise<void> => {
        if (!loadedConversation?.olderCursor || olderInFlight.current) return;
        olderInFlight.current = true;
        setOlderBusy(true);
        setOlderError(null);
        try {
            const base = conversationRoute(ticketId, operator).split("?")[0];
            const query = new URLSearchParams({
                limit: String(IT_TICKET_CONVERSATION_DEFAULT_LIMIT),
                cursor: loadedConversation.olderCursor,
            });
            const response = await fetch(`${base}?${query.toString()}`);
            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(readITTicketReadError(payload, response.status, operator));
            }
            const olderPage = parseITTicketConversationPage(payload);
            if (olderPage === null) throw new Error("ข้อมูลการสนทนาไม่ถูกต้อง กรุณาลองอีกครั้ง");
            setConversationState((current) => {
                if (current?.key !== requestKey || current.kind !== "loaded") return current;
                return {
                    key: requestKey,
                    kind: "loaded",
                    page: {
                        items: mergeITTicketConversationItems(olderPage.items, current.page.items),
                        olderCursor: olderPage.olderCursor,
                        hasMore: olderPage.hasMore,
                    },
                };
            });
        } catch (cause) {
            setOlderError(cause instanceof Error
                ? cause.message
                : readITTicketReadError(null, 500, operator));
        } finally {
            olderInFlight.current = false;
            setOlderBusy(false);
        }
    };

    const handleDraftChange = (value: string): void => {
        setDraft(value);
        setPostError(null);
        setPostMessage(null);
    };

    const handleAttachmentSelection = (event: ChangeEvent<HTMLInputElement>): void => {
        const input = event.currentTarget;
        const incoming = Array.from(input.files ?? []);
        input.value = "";
        if (incoming.length === 0) return;

        const error = validateITTicketAttachmentSelection(
            selectedAttachmentsRef.current.map((attachment) => attachment.file),
            incoming,
        );
        if (error !== null) {
            setAttachmentError(error);
            return;
        }

        setAttachmentError(null);
        updateSelectedAttachments([
            ...selectedAttachmentsRef.current,
            ...incoming.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
        ]);
        setPostError(null);
        setPostMessage(null);
    };

    const handleRemoveAttachment = (index: number): void => {
        const current = selectedAttachmentsRef.current;
        const removed = current[index];
        if (!removed) return;
        URL.revokeObjectURL(removed.previewUrl);
        updateSelectedAttachments(current.filter((_, currentIndex) => currentIndex !== index));
        setAttachmentError(null);
        setPostError(null);
        setPostMessage(null);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        const body = draft.trim();
        if (!body || !canPost || postInFlight.current) return;

        const files = selectedAttachmentsRef.current.map((attachment) => attachment.file);
        postInFlight.current = true;
        setPosting(true);
        setPostError(null);
        setPostMessage(null);
        try {
            const signature = await createITTicketCommentAttemptSignature(
                ticketId,
                operator,
                body,
                files,
            );
            const existingAttempt = idempotencyAttempt.current;
            const idempotencyKey = existingAttempt?.signature === signature
                ? existingAttempt.key
                : globalThis.crypto.randomUUID();
            idempotencyAttempt.current = { signature, key: idempotencyKey };
            let requestBody: BodyInit;
            const headers = new Headers({ "Idempotency-Key": idempotencyKey });
            if (files.length > 0) {
                const formData = new FormData();
                formData.append("body", body);
                for (const file of files) formData.append("attachments", file, file.name);
                requestBody = formData;
            } else {
                headers.set("Content-Type", "application/json");
                requestBody = JSON.stringify({ body });
            }
            const response = await fetch(commentsRoute(ticketId, operator), {
                method: "POST",
                headers,
                body: requestBody,
            });
            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) setPostingDenied(true);
                throw new Error(readITTicketReadError(payload, response.status, operator));
            }
            const result = parseITTicketCommentSubmission(payload);
            if (result === null) throw new Error("ระบบยืนยันผลการส่งข้อความไม่ได้ กรุณาลองส่งซ้ำ");

            const current = conversationState;
            if (current?.key === requestKey && current.kind === "loaded") {
                setConversationState({
                    key: requestKey,
                    kind: "loaded",
                    page: {
                        ...current.page,
                        items: mergeITTicketConversationItems(current.page.items, [result.comment]),
                    },
                });
            } else {
                setConversationRetry((retry) => retry + 1);
            }
            setDraft("");
            for (const attachment of selectedAttachmentsRef.current) {
                URL.revokeObjectURL(attachment.previewUrl);
            }
            updateSelectedAttachments([]);
            setAttachmentError(null);
            idempotencyAttempt.current = null;
            setPostMessage(result.replayed ? "ข้อความนี้ถูกส่งเรียบร้อยแล้ว" : "ส่งข้อความเรียบร้อยแล้ว");
        } catch (cause) {
            setPostError(cause instanceof Error
                ? cause.message
                : readITTicketReadError(null, 500, operator));
        } finally {
            postInFlight.current = false;
            setPosting(false);
        }
    };

    return (
        <section aria-labelledby="it-ticket-conversation-heading" className="space-y-5 rounded-xl border border-border-neutral bg-surface-raised p-4 md:p-6">
            <header className="flex items-start gap-3">
                <MessageSquareText aria-hidden="true" className="mt-1 size-5 shrink-0 text-brand-foreground" />
                <div className="min-w-0 space-y-1">
                    <h2 id="it-ticket-conversation-heading" className="text-lg font-semibold text-content-heading">
                        การสนทนา
                    </h2>
                    <p className="text-sm leading-6 text-content-secondary">
                        ข้อความจากผู้แจ้งและเจ้าหน้าที่ IT
                    </p>
                </div>
            </header>

            {loading ? (
                <div role="status" aria-label="กำลังโหลดการสนทนา" className="space-y-3">
                    <div className="h-16 animate-pulse rounded-lg bg-surface-subtle" />
                    <div className="h-16 animate-pulse rounded-lg bg-surface-subtle" />
                </div>
            ) : null}
            {!loading && conversationError ? (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                    <div className="flex gap-2">
                        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        <p>{conversationError}</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setConversationRetry((retry) => retry + 1)}>
                        <RefreshCw aria-hidden="true" />
                        ลองอีกครั้ง
                    </Button>
                </div>
            ) : null}
            {!loading && !conversationError && loadedConversation ? (
                loadedConversation.items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border-neutral bg-surface-subtle px-4 py-6 text-center text-sm text-content-secondary">
                        ยังไม่มีข้อความในบทสนทนา
                    </p>
                ) : (
                    <div>
                        {loadedConversation.hasMore ? (
                            <div className="mb-4 space-y-2">
                                {olderError ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{olderError}</p> : null}
                                <Button type="button" size="sm" variant="outline" disabled={olderBusy} onClick={() => void loadOlder()}>
                                    <RefreshCw aria-hidden="true" className={olderBusy ? "animate-spin" : ""} />
                                    {olderBusy ? "กำลังโหลดข้อความเก่า…" : olderError ? "ลองโหลดข้อความเก่าอีกครั้ง" : "ดูข้อความก่อนหน้า"}
                                </Button>
                            </div>
                        ) : null}
                        <ol aria-label="ข้อความในการสนทนา" className="ml-4 border-l border-border-neutral pl-4">
                            {loadedConversation.items.map((item) => (
                                <ConversationEntry key={item.id} item={item} />
                            ))}
                        </ol>
                    </div>
                )
            ) : null}

            {canPost ? (
                <form className="space-y-3 border-t border-border-neutral pt-5" onSubmit={(event) => void handleSubmit(event)}>
                    <label htmlFor={`it-ticket-comment-${ticketId}`} className="block text-sm font-semibold text-content-heading">
                        ตอบกลับ
                    </label>
                    <Textarea
                        id={`it-ticket-comment-${ticketId}`}
                        value={draft}
                        maxLength={IT_TICKET_COMMENT_MAX_LENGTH}
                        rows={4}
                        disabled={posting}
                        onChange={(event) => handleDraftChange(event.target.value)}
                        placeholder="พิมพ์ข้อความที่ต้องการส่งถึงอีกฝ่าย"
                        aria-describedby={`it-ticket-comment-limit-${ticketId}`}
                        className="min-h-28 resize-y"
                    />
                    <div className="space-y-2">
                        <label htmlFor={`it-ticket-attachments-${ticketId}`} className="block text-sm font-semibold text-content-heading">
                            รูปภาพประกอบ (ไม่บังคับ)
                        </label>
                        <input
                            id={`it-ticket-attachments-${ticketId}`}
                            type="file"
                            multiple
                            accept={`${IT_TICKET_ATTACHMENT_ACCEPTED_TYPES.join(",")},.jpg,.jpeg,.png,.webp`}
                            disabled={posting || selectedAttachments.length >= IT_TICKET_ATTACHMENT_MAX_FILES}
                            onChange={handleAttachmentSelection}
                            aria-describedby={`it-ticket-attachments-help-${ticketId}`}
                            aria-invalid={attachmentError ? true : undefined}
                            className="block min-h-11 w-full cursor-pointer rounded-md border border-border-neutral bg-surface-raised text-sm text-content-body file:mr-3 file:min-h-11 file:cursor-pointer file:border-0 file:bg-surface-subtle file:px-3 file:font-medium file:text-content-body hover:file:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <p id={`it-ticket-attachments-help-${ticketId}`} className="text-xs leading-5 text-content-muted">
                            JPG, PNG หรือ WEBP · สูงสุด {IT_TICKET_ATTACHMENT_MAX_FILES} รูป · ไม่เกิน {formatAttachmentSize(IT_TICKET_ATTACHMENT_MAX_BYTES)} ต่อรูป และ {formatAttachmentSize(IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES)} รวม
                        </p>
                        {attachmentError ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{attachmentError}</p> : null}
                        {selectedAttachments.length > 0 ? (
                            <ul aria-label="รูปภาพที่เลือก" className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3">
                                {selectedAttachments.map((attachment, index) => (
                                    <li key={`${attachment.file.name}:${attachment.file.lastModified}:${index}`} className="min-w-0 rounded-lg border border-border-neutral bg-surface-subtle p-2">
                                        <img
                                            src={attachment.previewUrl}
                                            alt={`ตัวอย่างรูปภาพ ${attachment.file.name}`}
                                            className="aspect-[4/3] max-h-40 w-full rounded-md object-contain"
                                        />
                                        <p className="mt-2 break-words text-xs font-medium leading-5 text-content-body">{attachment.file.name}</p>
                                        <div className="mt-1 flex items-center justify-between gap-2">
                                            <span className="text-xs tabular-nums text-content-muted">{formatAttachmentSize(attachment.file.size)}</span>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                disabled={posting}
                                                onClick={() => handleRemoveAttachment(index)}
                                                aria-label={`นำรูป ${attachment.file.name} ออก`}
                                                className="min-h-11"
                                            >
                                                <X aria-hidden="true" />
                                                นำออก
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p id={`it-ticket-comment-limit-${ticketId}`} className="text-xs leading-5 text-content-muted">
                            {draft.length.toLocaleString("th-TH")}/{IT_TICKET_COMMENT_MAX_LENGTH.toLocaleString("th-TH")} ตัวอักษร · ขีดจำกัดทางเทคนิคของระบบ
                        </p>
                        <Button type="submit" disabled={posting || draft.trim().length === 0} aria-busy={posting}>
                            <Send aria-hidden="true" />
                            {posting ? "กำลังส่ง…" : "ส่งข้อความ"}
                        </Button>
                    </div>
                    {operator || status !== "WAITING_REQUESTER" ? null : (
                        <p className="text-xs leading-5 text-content-secondary">
                            การตอบกลับจะไม่เปลี่ยนสถานะ Ticket อัตโนมัติ
                        </p>
                    )}
                    {postError ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{postError}</p> : null}
                    {postMessage ? <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{postMessage}</p> : null}
                </form>
            ) : (
                <p className="border-t border-border-neutral pt-4 text-sm leading-6 text-content-secondary">
                    {!commentable
                        ? `Ticket อยู่ในสถานะ “${IT_TICKET_STATUS_LABELS[status]}” จึงอ่านบทสนทนาได้อย่างเดียวและส่งข้อความเพิ่มเติมไม่ได้`
                        : postingDenied
                            ? "สิทธิ์ตอบกลับหรือสถานะพนักงานเปลี่ยนแปลง จึงปิดการตอบกลับไว้"
                            : "บัญชีนี้ไม่มีสิทธิ์ตอบกลับ Ticket นี้"}
                </p>
            )}
        </section>
    );
}
