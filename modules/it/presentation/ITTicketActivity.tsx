"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { ChevronDown, CircleAlert, History, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { API_ROUTES } from "@/lib/ssot/routes";

import {
    IT_TICKET_ACTIVITY_DEFAULT_LIMIT,
    type ITTicketActivityPage,
} from "../contracts";
import {
    formatITTicketActivityTimestamp,
    formatITTicketDate,
    mergeITTicketActivityItems,
    parseITTicketActivityPage,
    readITTicketReadError,
    describeITTicketActivityActor,
    describeITTicketActivityItem,
} from "./dashboard/ticket-presentation";

export type ITTicketActivityPageLoader = (
    ticketId: number,
    input: { readonly cursor?: string; readonly signal?: AbortSignal },
) => Promise<ITTicketActivityPage>;

type Audience = "REQUESTER" | "OPERATOR";
type Surface = "DASHBOARD" | "LIFF";
type ActivityState =
    | { readonly key: string; readonly kind: "loaded"; readonly page: ITTicketActivityPage }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

export interface ITTicketActivityProps {
    readonly ticketId: number;
    readonly ticketCreatedAt: string;
    readonly audience: Audience;
    readonly surface?: Surface;
    readonly revision?: number | string;
    readonly collapsible?: boolean;
    readonly pageLoader?: ITTicketActivityPageLoader;
}

async function loadDashboardActivityPage(
    ticketId: number,
    audience: Audience,
    input: { readonly cursor?: string; readonly signal?: AbortSignal },
): Promise<ITTicketActivityPage> {
    const base = audience === "OPERATOR"
        ? API_ROUTES.itOperatorTickets.activityById(ticketId)
        : API_ROUTES.itTickets.activityById(ticketId);
    const params = new URLSearchParams({ limit: String(IT_TICKET_ACTIVITY_DEFAULT_LIMIT) });
    if (input.cursor !== undefined) params.set("cursor", input.cursor);

    const response = await fetch(`${base}?${params.toString()}`, {
        ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(readITTicketReadError(payload, response.status, audience === "OPERATOR"));
    }
    const page = parseITTicketActivityPage(payload);
    if (page === null) throw new Error("ข้อมูลประวัติการดำเนินการไม่ถูกต้อง กรุณาลองอีกครั้ง");
    return page;
}

export function ITTicketActivity({
    ticketId,
    ticketCreatedAt,
    audience,
    surface = "DASHBOARD",
    revision,
    collapsible = false,
    pageLoader,
}: ITTicketActivityProps): ReactElement {
    const [activityState, setActivityState] = useState<ActivityState | null>(null);
    const [retry, setRetry] = useState(0);
    const [olderBusy, setOlderBusy] = useState(false);
    const [olderError, setOlderError] = useState<string | null>(null);
    const olderInFlight = useRef(false);
    const olderController = useRef<AbortController | null>(null);
    const requestKey = `${ticketId}:${audience}:${surface}:${revision ?? "default"}:${retry}`;
    const currentState = activityState?.key === requestKey ? activityState : null;
    const page = currentState?.kind === "loaded" ? currentState.page : null;
    const error = currentState?.kind === "error" ? currentState.message : null;
    const loading = currentState === null;

    const loadPage = useCallback((
        requestedTicketId: number,
        input: { readonly cursor?: string; readonly signal?: AbortSignal },
    ): Promise<ITTicketActivityPage> => pageLoader
        ? pageLoader(requestedTicketId, input)
        : loadDashboardActivityPage(requestedTicketId, audience, input),
    [audience, pageLoader]);

    useEffect(() => {
        const controller = new AbortController();
        void loadPage(ticketId, { signal: controller.signal })
            .then((result) => {
                if (!controller.signal.aborted) {
                    setActivityState({ key: requestKey, kind: "loaded", page: result });
                }
            })
            .catch((cause: unknown) => {
                if (controller.signal.aborted) return;
                setActivityState({
                    key: requestKey,
                    kind: "error",
                    message: cause instanceof Error
                        ? cause.message
                        : readITTicketReadError(null, 500, audience === "OPERATOR"),
                });
            });
        return () => {
            controller.abort();
            olderController.current?.abort();
        };
    }, [audience, loadPage, requestKey, ticketId]);

    const loadOlder = async (): Promise<void> => {
        const cursor = page?.olderCursor;
        if (!cursor || olderInFlight.current) return;
        const controller = new AbortController();
        olderController.current = controller;
        olderInFlight.current = true;
        setOlderBusy(true);
        setOlderError(null);
        try {
            const olderPage = await loadPage(ticketId, { cursor, signal: controller.signal });
            if (controller.signal.aborted) return;
            setActivityState((current) => {
                if (current?.key !== requestKey || current.kind !== "loaded") return current;
                return {
                    key: requestKey,
                    kind: "loaded",
                    page: {
                        items: mergeITTicketActivityItems(olderPage.items, current.page.items),
                        olderCursor: olderPage.olderCursor,
                        hasMore: olderPage.hasMore,
                    },
                };
            });
        } catch (cause) {
            if (controller.signal.aborted) return;
            setOlderError(cause instanceof Error
                ? cause.message
                : readITTicketReadError(null, 500, audience === "OPERATOR"));
        } finally {
            if (olderController.current === controller) {
                olderController.current = null;
                olderInFlight.current = false;
                setOlderBusy(false);
            }
        }
    };

    const contents = (
        <>
            {loading ? (
                <div role="status" aria-label="กำลังโหลดประวัติการดำเนินการ" className="space-y-2 py-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-border-neutral/60 motion-reduce:animate-none" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-border-neutral/60 motion-reduce:animate-none" />
                </div>
            ) : null}
            {error ? (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm text-rose-800 dark:text-rose-200">
                    <p className="flex items-start gap-2"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}>
                        <RefreshCw aria-hidden="true" />
                        ลองอีกครั้ง
                    </Button>
                </div>
            ) : null}
            {page ? (
                page.items.length === 0 ? (
                    <p className="py-3 text-sm text-content-secondary">ยังไม่มีประวัติการดำเนินการ</p>
                ) : (
                    <>
                        {page.hasMore ? (
                            <div className="space-y-2 py-2">
                                {olderError ? <p role="alert" className="text-sm text-rose-800 dark:text-rose-200">{olderError}</p> : null}
                                <Button type="button" size="sm" variant="outline" disabled={olderBusy} onClick={() => void loadOlder()}>
                                    <RefreshCw aria-hidden="true" className={olderBusy ? "animate-spin motion-reduce:animate-none" : ""} />
                                    {olderBusy ? "กำลังโหลดประวัติเก่า…" : olderError ? "ลองโหลดประวัติเก่าอีกครั้ง" : "ดูประวัติก่อนหน้า"}
                                </Button>
                            </div>
                        ) : null}
                        <ol aria-label={`ประวัติการดำเนินการ Ticket #${ticketId}`} className="ml-4 border-l border-border-neutral pl-4">
                            {page.items.map((item) => (
                                <li key={item.id} className="relative pb-5 last:pb-0">
                                    <span
                                        aria-hidden="true"
                                        className="absolute -left-[1.35rem] top-1.5 size-2.5 rounded-full border-2 border-surface-raised bg-brand-solid ring-1 ring-border-neutral"
                                    />
                                    <div className="space-y-0.5">
                                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                            <time
                                                dateTime={item.occurredAt}
                                                title={formatITTicketDate(item.occurredAt)}
                                                className="text-xs tabular-nums text-content-muted"
                                            >
                                                {formatITTicketActivityTimestamp(item.occurredAt, ticketCreatedAt)}
                                            </time>
                                            <span className="text-xs font-medium text-content-heading">
                                                ผู้ดำเนินการ: {describeITTicketActivityActor(item, surface)}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-5 text-content-secondary [overflow-wrap:anywhere]">
                                            {describeITTicketActivityItem(item, surface)}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </>
                )
            ) : null}
        </>
    );

    if (collapsible) {
        return (
            <details className="rounded-xl border border-border-neutral bg-surface-subtle">
                <summary className="group flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-content-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                    <History aria-hidden="true" className="size-4 shrink-0 text-content-muted" />
                    <span>ประวัติการดำเนินการ</span>
                    <ChevronDown aria-hidden="true" className="ml-auto size-4 shrink-0 text-content-muted transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border-neutral bg-surface-raised px-4 py-2">
                    {contents}
                </div>
            </details>
        );
    }

    return (
        <section aria-labelledby={`it-ticket-activity-heading-${ticketId}`} className="space-y-2 rounded-xl border border-border-neutral bg-surface-subtle p-4">
            <h2 id={`it-ticket-activity-heading-${ticketId}`} className="flex items-center gap-2 text-base font-semibold text-content-heading">
                <History aria-hidden="true" className="size-4 text-content-muted" />
                ประวัติการดำเนินการ
            </h2>
            {contents}
        </section>
    );
}
