"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import { CircleAlert, MessageSquareText, RefreshCw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { API_ROUTES } from "@/lib/ssot/routes";

import {
    IT_TICKET_COMMENTABLE_STATUSES,
    IT_TICKET_COMMENT_MAX_LENGTH,
    IT_TICKET_STATUS_LABELS,
    IT_TICKET_TIMELINE_DEFAULT_LIMIT,
    type ITTicketTimelineEvent,
    type ITTicketTimelineItem,
    type ITTicketTimelinePage,
} from "../../contracts";
import type { ITTicketStatus } from "@prisma/client";
import {
    formatITTicketDate,
    mergeITTicketTimelineItems,
    parseITTicketCommentSubmission,
    parseITTicketTimelinePage,
    readITTicketConversationError,
} from "./ticket-presentation";

type TimelineState =
    | { readonly key: string; readonly kind: "loaded"; readonly page: ITTicketTimelinePage }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

function timelineRoute(ticketId: number, operator: boolean): string {
    const base = operator
        ? API_ROUTES.itOperatorTickets.timelineById(ticketId)
        : API_ROUTES.itTickets.timelineById(ticketId);
    return `${base}?limit=${IT_TICKET_TIMELINE_DEFAULT_LIMIT}`;
}

function commentsRoute(ticketId: number, operator: boolean): string {
    return operator
        ? API_ROUTES.itOperatorTickets.commentsById(ticketId)
        : API_ROUTES.itTickets.commentsById(ticketId);
}

function isCommentable(status: ITTicketStatus): boolean {
    return IT_TICKET_COMMENTABLE_STATUSES.some((candidate) => candidate === status);
}

function eventDescription(event: ITTicketTimelineEvent): string {
    switch (event.type) {
        case "CREATED":
            return `${event.actorDisplayName} สร้าง Ticket`;
        case "ASSIGNED":
            return `${event.actorDisplayName} เปลี่ยนผู้รับผิดชอบจาก ${event.fromAssigneeDisplayName ?? "ไม่มีผู้รับผิดชอบ"} เป็น ${event.toAssigneeDisplayName ?? "ไม่มีผู้รับผิดชอบ"}`;
        case "UNASSIGNED":
            return `${event.actorDisplayName} นำความรับผิดชอบของ ${event.fromAssigneeDisplayName ?? "ผู้รับผิดชอบเดิม"} ออก`;
        case "STATUS_CHANGED":
            return `${event.actorDisplayName} เปลี่ยนสถานะจาก ${event.fromStatus === null ? "ไม่ระบุสถานะ" : IT_TICKET_STATUS_LABELS[event.fromStatus]} เป็น ${event.toStatus === null ? "ไม่ระบุสถานะ" : IT_TICKET_STATUS_LABELS[event.toStatus]}`;
        case "CATEGORY_CHANGED":
            return `${event.actorDisplayName} เปลี่ยนหมวดหมู่จาก ${event.fromCategoryName ?? "ไม่จัดหมวดหมู่"} เป็น ${event.toCategoryName ?? "ไม่จัดหมวดหมู่"}`;
    }
}

function TimelineEntry({ item }: { readonly item: ITTicketTimelineItem }): ReactElement {
    const isComment = item.type === "COMMENT";
    const isOperatorMessage = isComment && item.authorSide === "OPERATOR";
    return (
        <li className="relative pb-5 last:pb-0">
            <span aria-hidden="true" className="absolute -left-[1.35rem] top-1.5 size-2.5 rounded-full border-2 border-surface-raised bg-brand-solid ring-1 ring-border-neutral" />
            <article className={`rounded-lg border border-border-neutral p-3 sm:p-4 ${isOperatorMessage ? "bg-sky-50/70 dark:bg-sky-950/25" : "bg-surface-raised"}`}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <p className="text-sm font-medium leading-6 text-content-heading [overflow-wrap:anywhere]">
                        {isComment ? (
                            <>
                                <span>{item.authorDisplayName}</span>
                                <span className="ml-2 text-xs font-normal text-content-muted">
                                    {item.authorSide === "REQUESTER" ? "ผู้แจ้ง" : "เจ้าหน้าที่ IT"}
                                </span>
                            </>
                        ) : eventDescription(item)}
                    </p>
                    <time dateTime={item.createdAt} className="shrink-0 text-xs tabular-nums text-content-muted">
                        {formatITTicketDate(item.createdAt)}
                    </time>
                </div>
                {isComment ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-content-body">
                        {item.body}
                    </p>
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
    const [timelineState, setTimelineState] = useState<TimelineState | null>(null);
    const [timelineRetry, setTimelineRetry] = useState(0);
    const [olderBusy, setOlderBusy] = useState(false);
    const [olderError, setOlderError] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState<string | null>(null);
    const [postMessage, setPostMessage] = useState<string | null>(null);
    const [postingDenied, setPostingDenied] = useState(false);
    const requestKey = `${ticketId}:${operator ? "operator" : "requester"}:${timelineRetry}`;
    const currentTimeline = timelineState?.key === requestKey ? timelineState : null;
    const loadedTimeline = currentTimeline?.kind === "loaded" ? currentTimeline.page : null;
    const timelineError = currentTimeline?.kind === "error" ? currentTimeline.message : null;
    const loading = currentTimeline === null;
    const commentable = isCommentable(status);
    const canPost = canComment && commentable && !postingDenied;
    const postInFlight = useRef(false);
    const olderInFlight = useRef(false);
    const idempotencyAttempt = useRef<{ readonly body: string; readonly key: string } | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        void fetch(timelineRoute(ticketId, operator), { signal: controller.signal })
            .then(async (response) => {
                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) {
                    throw new Error(readITTicketConversationError(payload, response.status, operator));
                }
                const page = parseITTicketTimelinePage(payload);
                if (page === null) throw new Error("ข้อมูลประวัติ Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
                if (!controller.signal.aborted) {
                    setTimelineState({ key: requestKey, kind: "loaded", page });
                }
            })
            .catch((cause: unknown) => {
                if (controller.signal.aborted) return;
                setTimelineState({
                    key: requestKey,
                    kind: "error",
                    message: cause instanceof Error
                        ? cause.message
                        : readITTicketConversationError(null, 500, operator),
                });
            });
        return () => controller.abort();
    }, [ticketId, operator, requestKey]);

    const loadOlder = async (): Promise<void> => {
        if (!loadedTimeline?.olderCursor || olderInFlight.current) return;
        olderInFlight.current = true;
        setOlderBusy(true);
        setOlderError(null);
        try {
            const base = timelineRoute(ticketId, operator).split("?")[0];
            const query = new URLSearchParams({
                limit: String(IT_TICKET_TIMELINE_DEFAULT_LIMIT),
                cursor: loadedTimeline.olderCursor,
            });
            const response = await fetch(`${base}?${query.toString()}`);
            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(readITTicketConversationError(payload, response.status, operator));
            }
            const olderPage = parseITTicketTimelinePage(payload);
            if (olderPage === null) throw new Error("ข้อมูลประวัติ Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
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
        } catch (cause) {
            setOlderError(cause instanceof Error
                ? cause.message
                : readITTicketConversationError(null, 500, operator));
        } finally {
            olderInFlight.current = false;
            setOlderBusy(false);
        }
    };

    const handleDraftChange = (value: string): void => {
        const nextCanonical = value.trim();
        if (idempotencyAttempt.current !== null
            && idempotencyAttempt.current.body !== nextCanonical) {
            idempotencyAttempt.current = null;
        }
        setDraft(value);
        setPostError(null);
        setPostMessage(null);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        const body = draft.trim();
        if (!body || !canPost || postInFlight.current) return;

        const existingAttempt = idempotencyAttempt.current;
        const idempotencyKey = existingAttempt?.body === body
            ? existingAttempt.key
            : globalThis.crypto.randomUUID();
        idempotencyAttempt.current = { body, key: idempotencyKey };
        postInFlight.current = true;
        setPosting(true);
        setPostError(null);
        setPostMessage(null);
        try {
            const response = await fetch(commentsRoute(ticketId, operator), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": idempotencyKey,
                },
                body: JSON.stringify({ body }),
            });
            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) setPostingDenied(true);
                throw new Error(readITTicketConversationError(payload, response.status, operator));
            }
            const result = parseITTicketCommentSubmission(payload);
            if (result === null) throw new Error("ระบบยืนยันผลการส่งข้อความไม่ได้ กรุณาลองส่งซ้ำ");

            const current = timelineState;
            if (current?.key === requestKey && current.kind === "loaded") {
                setTimelineState({
                    key: requestKey,
                    kind: "loaded",
                    page: {
                        ...current.page,
                        items: mergeITTicketTimelineItems(current.page.items, [result.comment]),
                    },
                });
            } else {
                setTimelineRetry((retry) => retry + 1);
            }
            setDraft("");
            idempotencyAttempt.current = null;
            setPostMessage(result.replayed ? "ข้อความนี้ถูกส่งเรียบร้อยแล้ว" : "ส่งข้อความเรียบร้อยแล้ว");
        } catch (cause) {
            setPostError(cause instanceof Error
                ? cause.message
                : readITTicketConversationError(null, 500, operator));
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
                        การสนทนาและประวัติ
                    </h2>
                    <p className="text-sm leading-6 text-content-secondary">
                        ข้อความในส่วนนี้ผู้แจ้งและเจ้าหน้าที่ IT ที่มีสิทธิ์สามารถอ่านได้
                    </p>
                </div>
            </header>

            {loading ? (
                <div role="status" aria-label="กำลังโหลดประวัติ Ticket" className="space-y-3">
                    <div className="h-16 animate-pulse rounded-lg bg-surface-subtle" />
                    <div className="h-16 animate-pulse rounded-lg bg-surface-subtle" />
                </div>
            ) : null}
            {!loading && timelineError ? (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                    <div className="flex gap-2">
                        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        <p>{timelineError}</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setTimelineRetry((retry) => retry + 1)}>
                        <RefreshCw aria-hidden="true" />
                        ลองอีกครั้ง
                    </Button>
                </div>
            ) : null}
            {!loading && !timelineError && loadedTimeline ? (
                loadedTimeline.items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border-neutral bg-surface-subtle px-4 py-6 text-center text-sm text-content-secondary">
                        ยังไม่มีข้อความหรือประวัติการดำเนินการ
                    </p>
                ) : (
                    <div>
                        {loadedTimeline.hasMore ? (
                            <div className="mb-4 space-y-2">
                                {olderError ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{olderError}</p> : null}
                                <Button type="button" size="sm" variant="outline" disabled={olderBusy} onClick={() => void loadOlder()}>
                                    <RefreshCw aria-hidden="true" className={olderBusy ? "animate-spin" : ""} />
                                    {olderBusy ? "กำลังโหลดประวัติเก่า…" : olderError ? "ลองโหลดประวัติเก่าอีกครั้ง" : "ดูประวัติก่อนหน้า"}
                                </Button>
                            </div>
                        ) : null}
                        <ol aria-label="ลำดับการสนทนาและเหตุการณ์ Ticket" className="ml-4 border-l border-border-neutral pl-4">
                            {loadedTimeline.items.map((item) => (
                                <TimelineEntry key={`${item.type}:${item.id}`} item={item} />
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
                        ? `Ticket อยู่ในสถานะ “${IT_TICKET_STATUS_LABELS[status]}” จึงอ่านประวัติได้อย่างเดียวและส่งข้อความเพิ่มเติมไม่ได้`
                        : postingDenied
                            ? "สิทธิ์ตอบกลับหรือสถานะพนักงานเปลี่ยนแปลง จึงปิดการตอบกลับไว้"
                            : "บัญชีนี้ไม่มีสิทธิ์ตอบกลับ Ticket นี้"}
                </p>
            )}
        </section>
    );
}
