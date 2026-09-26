"use client";

import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import { ArrowDown, CircleAlert, RefreshCw, TicketCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { API_ROUTES, APP_ROUTES } from "@/lib/ssot/routes";

import {
    IT_TICKET_STATUS_LABELS,
    IT_TICKET_TYPE_LABELS,
    type ITOperatorReferenceData,
    type ITOperatorTicket,
    type ITOperatorTicketList,
} from "../../contracts";
import type { ITTicketStatus, ITTicketType } from "@prisma/client";
import {
    formatITTicketDate,
    IT_TICKET_STATUS_STYLES,
    isITTicketStatus,
    isITTicketType,
    parseITOperatorReferenceData,
    parseITOperatorTicketList,
    readITOperatorError,
} from "./ticket-presentation";

interface QueueFilters {
    readonly status?: ITTicketStatus;
    readonly type?: ITTicketType;
    readonly categoryId?: number | "uncategorized";
    readonly assignmentState?: "ASSIGNED" | "UNASSIGNED";
    readonly assigneeUserId?: number;
}

type QueueState =
    | {
        readonly key: string;
        readonly kind: "loaded";
        readonly list: ITOperatorTicketList;
        readonly loadingMore: boolean;
        readonly loadMoreError: string | null;
    }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

type ReferenceState =
    | { readonly key: number; readonly kind: "loaded"; readonly value: ITOperatorReferenceData }
    | { readonly key: number; readonly kind: "error"; readonly message: string };

function TicketStatus({ status }: { readonly status: ITTicketStatus }): ReactElement {
    return (
        <span className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-xs font-semibold ${IT_TICKET_STATUS_STYLES[status]}`}>
            {IT_TICKET_STATUS_LABELS[status]}
        </span>
    );
}

function TicketAssignment({ ticket }: { readonly ticket: ITOperatorTicket }): ReactElement {
    return ticket.assignee
        ? <span>{ticket.assignee.displayName}</span>
        : <span className="font-medium text-amber-800 dark:text-amber-200">ยังไม่มีผู้รับผิดชอบ</span>;
}

function TicketCategory({ ticket }: { readonly ticket: ITOperatorTicket }): ReactElement {
    if (ticket.category === null) {
        return <span className="text-content-muted">ยังไม่จัดหมวดหมู่</span>;
    }
    return (
        <span>
            {ticket.category.name}
            {!ticket.category.isActive ? (
                <span className="ml-1 text-xs text-content-muted">(ปิดใช้งาน)</span>
            ) : null}
        </span>
    );
}

function QueueSkeleton(): ReactElement {
    return (
        <div role="status" aria-label="กำลังโหลดคิว IT Ticket" className="space-y-3 p-4">
            {[0, 1, 2, 3].map((row) => (
                <div key={row} className="grid gap-3 border-b border-border-neutral pb-4 last:border-0 md:grid-cols-[2fr_1fr_1fr]">
                    <Skeleton className="h-5 w-4/5" />
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-5 w-1/2" />
                </div>
            ))}
        </div>
    );
}

function QueueFiltersForm({
    draft,
    setDraft,
    reference,
    onSubmit,
}: {
    readonly draft: QueueFilters;
    readonly setDraft: (filters: QueueFilters) => void;
    readonly reference: ITOperatorReferenceData | null;
    readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}): ReactElement {
    const fieldClassName = "mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-content-body outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

    return (
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border-neutral bg-surface-subtle p-4 md:p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <label className="min-w-0 text-sm font-medium text-content-secondary">
                    สถานะ
                    <select
                        aria-label="กรองตามสถานะ"
                        className={fieldClassName}
                        value={draft.status ?? ""}
                        onChange={(event) => {
                            const status = event.target.value;
                            setDraft({ ...draft, status: isITTicketStatus(status) ? status : undefined });
                        }}
                    >
                        <option value="">ทุกสถานะ</option>
                        {Object.entries(IT_TICKET_STATUS_LABELS).map(([status, label]) => (
                            <option key={status} value={status}>{label}</option>
                        ))}
                    </select>
                </label>
                <label className="min-w-0 text-sm font-medium text-content-secondary">
                    ประเภท
                    <select
                        aria-label="กรองตามประเภท"
                        className={fieldClassName}
                        value={draft.type ?? ""}
                        onChange={(event) => {
                            const type = event.target.value;
                            setDraft({ ...draft, type: isITTicketType(type) ? type : undefined });
                        }}
                    >
                        <option value="">ทุกประเภท</option>
                        {Object.entries(IT_TICKET_TYPE_LABELS).map(([type, label]) => (
                            <option key={type} value={type}>{label}</option>
                        ))}
                    </select>
                </label>
                <label className="min-w-0 text-sm font-medium text-content-secondary">
                    หมวดหมู่
                    <select
                        aria-label="กรองตามหมวดหมู่"
                        className={fieldClassName}
                        value={draft.categoryId === undefined ? "" : String(draft.categoryId)}
                        onChange={(event) => {
                            const value = event.target.value;
                            setDraft({
                                ...draft,
                                categoryId: value === ""
                                    ? undefined
                                    : value === "uncategorized"
                                        ? "uncategorized"
                                        : Number(value),
                            });
                        }}
                    >
                        <option value="">ทุกหมวดหมู่</option>
                        <option value="uncategorized">ยังไม่จัดหมวดหมู่</option>
                        {reference?.categories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                    </select>
                </label>
                <label className="min-w-0 text-sm font-medium text-content-secondary">
                    การมอบหมาย
                    <select
                        aria-label="กรองตามการมอบหมาย"
                        className={fieldClassName}
                        value={draft.assignmentState ?? ""}
                        onChange={(event) => {
                            const value = event.target.value;
                            const assignmentState = value === "ASSIGNED" || value === "UNASSIGNED"
                                ? value
                                : undefined;
                            setDraft({
                                ...draft,
                                assignmentState,
                                ...(value === "UNASSIGNED" ? { assigneeUserId: undefined } : {}),
                            });
                        }}
                    >
                        <option value="">ทั้งหมด</option>
                        <option value="UNASSIGNED">ยังไม่มีผู้รับผิดชอบ</option>
                        <option value="ASSIGNED">มอบหมายแล้ว</option>
                    </select>
                </label>
                <label className="min-w-0 text-sm font-medium text-content-secondary">
                    ผู้รับผิดชอบ
                    <select
                        aria-label="กรองตามผู้รับผิดชอบ"
                        className={fieldClassName}
                        value={draft.assigneeUserId === undefined ? "" : String(draft.assigneeUserId)}
                        onChange={(event) => {
                            const value = event.target.value;
                            setDraft({
                                ...draft,
                                assignmentState: value ? "ASSIGNED" : undefined,
                                assigneeUserId: value ? Number(value) : undefined,
                            });
                        }}
                    >
                        <option value="">ผู้รับผิดชอบทุกคน</option>
                        {reference?.assignableOperators.map((operator) => (
                            <option key={operator.userId} value={operator.userId}>{operator.displayName}</option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <Button type="submit">ใช้ตัวกรอง</Button>
                <span className="text-xs leading-5 text-content-muted">ผลลัพธ์โหลดจากระบบตามลำดับรายการล่าสุด</span>
            </div>
        </form>
    );
}

export function ITTicketOperatorQueue(): ReactElement {
    const [filters, setFilters] = useState<QueueFilters>({});
    const [draft, setDraft] = useState<QueueFilters>({});
    const [refreshKey, setRefreshKey] = useState(0);
    const [queueState, setQueueState] = useState<QueueState | null>(null);
    const [referenceState, setReferenceState] = useState<ReferenceState | null>(null);
    const requestKey = `${JSON.stringify(filters)}:${refreshKey}`;
    const currentQueueState = queueState?.key === requestKey ? queueState : null;
    const list = currentQueueState?.kind === "loaded" ? currentQueueState.list : null;
    const queueError = currentQueueState?.kind === "error" ? currentQueueState.message : null;
    const loading = currentQueueState === null;
    const currentReference = referenceState?.key === refreshKey ? referenceState : null;
    const reference = currentReference?.kind === "loaded" ? currentReference.value : null;
    const referenceError = currentReference?.kind === "error" ? currentReference.message : null;

    useEffect(() => {
        const controller = new AbortController();
        const query = new URLSearchParams();
        if (filters.status) query.set("status", filters.status);
        if (filters.type) query.set("type", filters.type);
        if (filters.categoryId !== undefined) query.set("categoryId", String(filters.categoryId));
        if (filters.assignmentState) query.set("assignmentState", filters.assignmentState);
        if (filters.assigneeUserId !== undefined) query.set("assigneeUserId", String(filters.assigneeUserId));

        const suffix = query.toString();
        const url = suffix
            ? `${API_ROUTES.itOperatorTickets.list}?${suffix}`
            : API_ROUTES.itOperatorTickets.list;
        void fetch(url, { signal: controller.signal })
            .then(async (response) => {
                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) throw new Error(readITOperatorError(payload, response.status));
                const parsed = parseITOperatorTicketList(payload);
                if (parsed === null) throw new Error("ข้อมูลคิว IT Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
                if (controller.signal.aborted) return;
                setQueueState({
                    key: requestKey,
                    kind: "loaded",
                    list: parsed,
                    loadingMore: false,
                    loadMoreError: null,
                });
            })
            .catch((cause: unknown) => {
                if (controller.signal.aborted) return;
                setQueueState({
                    key: requestKey,
                    kind: "error",
                    message: cause instanceof Error
                        ? cause.message
                        : readITOperatorError(null, 500),
                });
            });
        return () => controller.abort();
    }, [filters, requestKey]);

    useEffect(() => {
        const controller = new AbortController();
        void fetch(API_ROUTES.itOperatorTickets.reference, { signal: controller.signal })
            .then(async (response) => {
                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) throw new Error(readITOperatorError(payload, response.status));
                const parsed = parseITOperatorReferenceData(payload);
                if (parsed === null) throw new Error("ข้อมูลตัวเลือกคิว IT ไม่ถูกต้อง กรุณาลองอีกครั้ง");
                if (controller.signal.aborted) return;
                setReferenceState({ key: refreshKey, kind: "loaded", value: parsed });
            })
            .catch((cause: unknown) => {
                if (controller.signal.aborted) return;
                setReferenceState({
                    key: refreshKey,
                    kind: "error",
                    message: cause instanceof Error ? cause.message : readITOperatorError(null, 500),
                });
            });
        return () => controller.abort();
    }, [refreshKey]);

    const handleFilterSubmit = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        setFilters(draft);
    };

    const handleLoadMore = async (): Promise<void> => {
        if (!list?.nextCursor || currentQueueState?.kind !== "loaded" || currentQueueState.loadingMore) return;
        const cursor = list.nextCursor;
        setQueueState({ ...currentQueueState, loadingMore: true, loadMoreError: null });
        const query = new URLSearchParams({ cursor });
        if (filters.status) query.set("status", filters.status);
        if (filters.type) query.set("type", filters.type);
        if (filters.categoryId !== undefined) query.set("categoryId", String(filters.categoryId));
        if (filters.assignmentState) query.set("assignmentState", filters.assignmentState);
        if (filters.assigneeUserId !== undefined) query.set("assigneeUserId", String(filters.assigneeUserId));

        try {
            const response = await fetch(`${API_ROUTES.itOperatorTickets.list}?${query}`);
            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) throw new Error(readITOperatorError(payload, response.status));
            const nextPage = parseITOperatorTicketList(payload);
            if (nextPage === null) throw new Error("ข้อมูลคิว IT Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
            setQueueState((current) => current?.key !== requestKey || current.kind !== "loaded"
                ? current
                : {
                    ...current,
                    list: {
                        tickets: [...current.list.tickets, ...nextPage.tickets],
                        nextCursor: nextPage.nextCursor,
                        limit: nextPage.limit,
                    },
                    loadingMore: false,
                    loadMoreError: null,
                });
        } catch (cause: unknown) {
            setQueueState((current) => current?.key !== requestKey || current.kind !== "loaded"
                ? current
                : {
                    ...current,
                    loadingMore: false,
                    loadMoreError: cause instanceof Error
                        ? cause.message
                        : readITOperatorError(null, 500),
                });
        }
    };

    const retry = (): void => setRefreshKey((current) => current + 1);

    return (
        <section className="min-h-[calc(100dvh-6rem)]">
            <div className="mx-auto max-w-7xl space-y-6">
                <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 space-y-1">
                        <h1 data-page-heading tabIndex={-1} className="text-2xl font-bold tracking-tight text-content-heading [overflow-wrap:anywhere] md:text-3xl">
                            คิว IT Ticket
                        </h1>
                        <p className="max-w-[70ch] text-sm leading-6 text-content-secondary">
                            ตรวจสอบผู้แจ้ง สถานะ ผู้รับผิดชอบ และหมวดหมู่ แล้วเปิดรายการเพื่อดำเนินการ
                        </p>
                    </div>
                    <Button type="button" variant="outline" onClick={retry}>
                        <RefreshCw aria-hidden="true" />
                        โหลดข้อมูลใหม่
                    </Button>
                </header>

                {referenceError ? (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                        <p>{referenceError}</p>
                        <Button type="button" size="sm" variant="outline" onClick={retry}>โหลดตัวเลือกอีกครั้ง</Button>
                    </div>
                ) : null}

                <QueueFiltersForm
                    draft={draft}
                    setDraft={setDraft}
                    reference={reference}
                    onSubmit={handleFilterSubmit}
                />

                <section aria-label="รายการ Ticket">
                    {list ? (
                        <p className="mb-3 text-sm text-content-secondary">
                            แสดง {list.tickets.length} รายการ
                        </p>
                    ) : null}
                    {loading ? (
                        <Card><QueueSkeleton /></Card>
                    ) : null}
                    {!loading && queueError ? (
                        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                            <div className="flex gap-3">
                                <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                                <p>{queueError}</p>
                            </div>
                            <Button type="button" variant="outline" onClick={retry}>ลองอีกครั้ง</Button>
                        </div>
                    ) : null}
                    {!loading && !queueError && list?.tickets.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border-neutral bg-surface-subtle px-5 py-10 text-center">
                            <TicketCheck aria-hidden="true" className="mx-auto size-8 text-content-muted" />
                            <h2 className="mt-3 font-semibold text-content-heading">ไม่พบ Ticket ในตัวกรองนี้</h2>
                            <p className="mx-auto mt-1 max-w-[56ch] text-sm leading-6 text-content-secondary">
                                ปรับตัวกรองเพื่อดูรายการอื่น หรือกลับมาตรวจสอบคิวอีกครั้ง
                            </p>
                        </div>
                    ) : null}
                    {!loading && !queueError && list && list.tickets.length > 0 ? (
                        <>
                            <Card className="hidden overflow-hidden py-0 2xl:block">
                                <CardContent className="overflow-x-auto px-0 py-0">
                                    <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                                        <thead className="bg-surface-subtle text-xs font-semibold text-content-secondary">
                                            <tr>
                                                <th scope="col" className="px-4 py-3">Ticket</th>
                                                <th scope="col" className="px-4 py-3">ผู้แจ้ง</th>
                                                <th scope="col" className="px-4 py-3">สถานะ</th>
                                                <th scope="col" className="px-4 py-3">ผู้รับผิดชอบ</th>
                                                <th scope="col" className="px-4 py-3">หมวดหมู่</th>
                                                <th scope="col" className="px-4 py-3">สร้างเมื่อ</th>
                                                <th scope="col" className="px-4 py-3">อัปเดตล่าสุด</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-neutral">
                                            {list.tickets.map((ticket) => (
                                                <tr key={ticket.id} className="align-top hover:bg-surface-subtle">
                                                    <td className="max-w-[22rem] px-4 py-4">
                                                        <Link
                                                            href={`${APP_ROUTES.dashboardITQueue}/${ticket.id}`}
                                                            className="font-semibold text-content-heading underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                        >
                                                            #{ticket.id} · {ticket.title}
                                                        </Link>
                                                        <p className="mt-1 text-xs text-content-secondary">{IT_TICKET_TYPE_LABELS[ticket.type]}</p>
                                                    </td>
                                                    <td className="max-w-48 px-4 py-4">
                                                        <p className="font-medium text-content-body">{ticket.requester.displayName}</p>
                                                        <p className="mt-1 text-xs text-content-muted">
                                                            {ticket.requester.departmentNameSnapshot ?? "ไม่ระบุแผนก"}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-4"><TicketStatus status={ticket.status} /></td>
                                                    <td className="max-w-48 px-4 py-4"><TicketAssignment ticket={ticket} /></td>
                                                    <td className="max-w-40 px-4 py-4"><TicketCategory ticket={ticket} /></td>
                                                    <td className="whitespace-nowrap px-4 py-4 text-xs text-content-secondary">{formatITTicketDate(ticket.createdAt)}</td>
                                                    <td className="whitespace-nowrap px-4 py-4 text-xs text-content-secondary">{formatITTicketDate(ticket.updatedAt)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>
                            <ul aria-label="รายการ Ticket สำหรับหน้าจอขนาดเล็ก" className="space-y-3 2xl:hidden">
                                {list.tickets.map((ticket) => (
                                    <li key={ticket.id}>
                                        <Link
                                            href={`${APP_ROUTES.dashboardITQueue}/${ticket.id}`}
                                            className="block rounded-xl border border-border-neutral bg-background p-4 outline-none transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <span className="min-w-0 font-semibold text-content-heading [overflow-wrap:anywhere]">
                                                    #{ticket.id} · {ticket.title}
                                                </span>
                                                <TicketStatus status={ticket.status} />
                                            </div>
                                            <p className="mt-1 text-sm text-content-secondary">{IT_TICKET_TYPE_LABELS[ticket.type]}</p>
                                            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-border-neutral pt-3 text-sm">
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-content-muted">ผู้แจ้ง</dt>
                                                    <dd className="mt-1 break-words text-content-body">{ticket.requester.displayName}</dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-content-muted">ผู้รับผิดชอบ</dt>
                                                    <dd className="mt-1 break-words text-content-body"><TicketAssignment ticket={ticket} /></dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-content-muted">หมวดหมู่</dt>
                                                    <dd className="mt-1 break-words text-content-body"><TicketCategory ticket={ticket} /></dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-content-muted">แผนกผู้แจ้ง</dt>
                                                    <dd className="mt-1 break-words text-content-body">{ticket.requester.departmentNameSnapshot ?? "ไม่ระบุแผนก"}</dd>
                                                </div>
                                            </dl>
                                            <div className="mt-3 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-content-muted">
                                                <span>สร้าง {formatITTicketDate(ticket.createdAt)}</span>
                                                <span>อัปเดต {formatITTicketDate(ticket.updatedAt)}</span>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : null}
                    {currentQueueState?.kind === "loaded" && currentQueueState.loadMoreError ? (
                        <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                            <p>{currentQueueState.loadMoreError}</p>
                            <Button type="button" size="sm" variant="outline" onClick={() => void handleLoadMore()}>โหลดหน้าถัดไปอีกครั้ง</Button>
                        </div>
                    ) : null}
                    {list?.nextCursor ? (
                        <div className="flex justify-center pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={currentQueueState?.kind !== "loaded" || currentQueueState.loadingMore}
                                onClick={() => void handleLoadMore()}
                            >
                                <ArrowDown aria-hidden="true" />
                                {currentQueueState?.kind === "loaded" && currentQueueState.loadingMore
                                    ? "กำลังโหลดรายการถัดไป"
                                    : "โหลดรายการถัดไป"}
                            </Button>
                        </div>
                    ) : null}
                </section>
            </div>
        </section>
    );
}
