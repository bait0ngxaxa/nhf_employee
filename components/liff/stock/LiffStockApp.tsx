"use client";

import type { StockRequestStatus } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactElement,
} from "react";
import { toast } from "sonner";

import {
    useStockBrowseCart,
    type StockCartAvailabilityReconciliation,
    type StockCartVariantAvailability,
} from "@/components/dashboard/stock/useStockBrowseCart";
import { useLiffWorkforce } from "@/components/liff/LiffBootstrap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiffApiError } from "@/lib/client/liff";
import { fetchLiffHome } from "@/lib/client/liff-home";
import {
    cancelLiffStockRequest,
    fetchLiffStockCategories,
    fetchLiffStockItems,
    fetchLiffStockMyRequests,
    fetchLiffStockProcessingQueue,
    fetchLiffStockRequest,
    fetchLiffStockVariantAvailability,
    issueLiffStockRequest,
    submitLiffStockRequest,
} from "@/lib/client/liff-stock";
import type {
    LiffStockCatalogItem,
    LiffStockCatalogResponse,
    LiffStockCategory,
    LiffStockRequestAction,
    LiffStockRequestDetail,
    LiffStockRequestsResponse,
    LiffStockRequestSummary,
} from "@/lib/types/stock-liff";

import { LiffStockBrowse } from "./LiffStockBrowse";
import { LiffStockCart } from "./LiffStockCart";
import {
    LiffStockDecisionSheet,
    type LiffStockDecisionIntent,
} from "./LiffStockDecisionSheet";
import { LiffStockMyRequests } from "./LiffStockMyRequests";
import { LiffStockProcessorQueue } from "./LiffStockProcessorQueue";
import { LiffStockRequestDetail as LiffStockRequestDetailSheet } from "./LiffStockRequestDetail";
import { LiffStockVariantPicker } from "./LiffStockVariantPicker";

type StockTab = "browse" | "mine" | "processing";

type CatalogLoadInput = {
    page: number;
    search: string;
    categoryId: number | undefined;
};

const CATALOG_PAGE_SIZE = 12;
const REQUEST_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const DEEP_LINK_ACTIONS = new Set(["issue", "review"]);

const EMPTY_CATALOG: LiffStockCatalogResponse = {
    items: [],
    total: 0,
    page: 1,
    limit: CATALOG_PAGE_SIZE,
    totalPages: 0,
};

const EMPTY_REQUESTS: LiffStockRequestsResponse = {
    requests: [],
    total: 0,
    page: 1,
    limit: REQUEST_PAGE_SIZE,
    totalPages: 0,
};

function getStockError(error: unknown): string {
    if (error instanceof LiffApiError) return error.message;
    return "ไม่สามารถโหลดข้อมูล Stock ได้ กรุณาลองใหม่อีกครั้ง";
}

function isDeterministicStockConflict(error: unknown): boolean {
    return error instanceof LiffApiError && error.status === 409;
}

function notifyCartAvailabilityReconciliation(
    reconciliation: StockCartAvailabilityReconciliation,
): void {
    if (reconciliation.adjustedCount === 0 && reconciliation.removedCount === 0) {
        return;
    }

    if (reconciliation.adjustedCount > 0 && reconciliation.removedCount > 0) {
        toast.info(
            "จำนวนวัสดุบางรายการถูกปรับตามสต็อกล่าสุด และวัสดุที่ไม่มีสต็อกพร้อมเบิกถูกนำออกจากตะกร้า",
        );
        return;
    }

    if (reconciliation.adjustedCount > 0) {
        toast.info("จำนวนวัสดุบางรายการถูกปรับตามสต็อกล่าสุด");
        return;
    }

    toast.info("วัสดุบางรายการไม่มีสต็อกพร้อมเบิกแล้วและถูกนำออกจากตะกร้า");
}

export function LiffStockApp(): ReactElement {
    const workforce = useLiffWorkforce();
    const searchParams = useSearchParams();
    const deepLinkHandledRef = useRef<string | null>(null);
    const catalogRequestSequenceRef = useRef(0);
    const requestHistorySequenceRef = useRef(0);
    const processingQueueSequenceRef = useRef(0);
    const detailRequestSequenceRef = useRef(0);
    const availabilityRequestSequenceRef = useRef(0);
    const catalogQueryRef = useRef<CatalogLoadInput>({
        page: 1,
        search: "",
        categoryId: undefined,
    });
    const reconcileCartAvailabilityRef = useRef<
        (catalogItems: ReadonlyArray<LiffStockCatalogItem>) => StockCartAvailabilityReconciliation
    >(() => ({
        changed: false,
        adjustedCount: 0,
        removedCount: 0,
    }));
    const reconcileCartVariantAvailabilityRef = useRef<
        (variants: ReadonlyArray<StockCartVariantAvailability>) => StockCartAvailabilityReconciliation
    >(() => ({
        changed: false,
        adjustedCount: 0,
        removedCount: 0,
    }));
    const hasPendingSubmissionRef = useRef<() => boolean>(() => false);
    const refreshCartAvailabilityRef = useRef<() => Promise<void>>(
        () => Promise.resolve(),
    );

    useEffect(() => () => {
        catalogRequestSequenceRef.current += 1;
        requestHistorySequenceRef.current += 1;
        processingQueueSequenceRef.current += 1;
        detailRequestSequenceRef.current += 1;
        availabilityRequestSequenceRef.current += 1;
    }, []);

    const deepLinkRequestId = searchParams.get("requestId");
    const rawActionIntent = searchParams.get("action");
    const deepLinkActionIntent = rawActionIntent
        && DEEP_LINK_ACTIONS.has(rawActionIntent)
        ? rawActionIntent
        : null;

    const [activeTab, setActiveTab] = useState<StockTab>("browse");
    const [catalog, setCatalog] = useState<LiffStockCatalogResponse>(EMPTY_CATALOG);
    const [categories, setCategories] = useState<LiffStockCategory[]>([]);
    const [catalogSearch, setCatalogSearch] = useState("");
    const [categoryId, setCategoryId] = useState<number | undefined>();
    const [catalogPage, setCatalogPage] = useState(1);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [catalogError, setCatalogError] = useState<string | null>(null);

    const [myRequests, setMyRequests] = useState<LiffStockRequestsResponse>(EMPTY_REQUESTS);
    const [requestSearch, setRequestSearch] = useState("");
    const [requestStatus, setRequestStatus] = useState<StockRequestStatus | undefined>();
    const [requestPage, setRequestPage] = useState(1);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [requestsError, setRequestsError] = useState<string | null>(null);

    const [canProcessStockRequests, setCanProcessStockRequests] = useState(false);
    const [processingQueue, setProcessingQueue] = useState<LiffStockRequestsResponse>(EMPTY_REQUESTS);
    const [processingSearch, setProcessingSearch] = useState("");
    const [processingPage, setProcessingPage] = useState(1);
    const [processingLoading, setProcessingLoading] = useState(false);
    const [processingError, setProcessingError] = useState<string | null>(null);

    const [variantPickerItem, setVariantPickerItem] = useState<LiffStockCatalogItem | null>(null);
    const [cartOpen, setCartOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState<LiffStockRequestDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [detailActionIntent, setDetailActionIntent] = useState<string | null>(null);
    const [focusNotice, setFocusNotice] = useState<string | null>(null);
    const [decisionIntent, setDecisionIntent] = useState<LiffStockDecisionIntent | null>(null);
    const [decisionFromDetail, setDecisionFromDetail] = useState(false);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [busyRequestId, setBusyRequestId] = useState<number | null>(null);

    const loadCatalog = useCallback(async (input: CatalogLoadInput): Promise<void> => {
        const sequence = ++catalogRequestSequenceRef.current;
        setCatalogLoading(true);
        setCatalogError(null);
        try {
            const nextCatalog = await fetchLiffStockItems({
                ...input,
                limit: CATALOG_PAGE_SIZE,
            });
            if (sequence !== catalogRequestSequenceRef.current) return;

            setCatalog(nextCatalog);
            if (!hasPendingSubmissionRef.current()) {
                notifyCartAvailabilityReconciliation(
                    reconcileCartAvailabilityRef.current(nextCatalog.items),
                );
            }
        } catch (error) {
            if (sequence !== catalogRequestSequenceRef.current) return;
            setCatalogError(getStockError(error));
        } finally {
            if (sequence === catalogRequestSequenceRef.current) {
                setCatalogLoading(false);
            }
        }
    }, []);

    const loadMyRequests = useCallback(async (input: {
        page: number;
        search: string;
        status: StockRequestStatus | undefined;
    }): Promise<void> => {
        const sequence = ++requestHistorySequenceRef.current;
        setRequestsLoading(true);
        setRequestsError(null);
        try {
            const nextRequests = await fetchLiffStockMyRequests({
                ...input,
                limit: REQUEST_PAGE_SIZE,
            });
            if (sequence !== requestHistorySequenceRef.current) return;

            setMyRequests(nextRequests);
        } catch (error) {
            if (sequence !== requestHistorySequenceRef.current) return;
            setRequestsError(getStockError(error));
        } finally {
            if (sequence === requestHistorySequenceRef.current) {
                setRequestsLoading(false);
            }
        }
    }, []);

    const loadProcessingQueue = useCallback(async (input: {
        page: number;
        search: string;
    }): Promise<void> => {
        const sequence = ++processingQueueSequenceRef.current;
        setProcessingLoading(true);
        setProcessingError(null);
        try {
            const nextQueue = await fetchLiffStockProcessingQueue({
                ...input,
                limit: REQUEST_PAGE_SIZE,
            });
            if (sequence !== processingQueueSequenceRef.current) return;

            setProcessingQueue(nextQueue);
        } catch (error) {
            if (sequence !== processingQueueSequenceRef.current) return;
            setProcessingError(getStockError(error));
        } finally {
            if (sequence === processingQueueSequenceRef.current) {
                setProcessingLoading(false);
            }
        }
    }, []);

    const loadDetail = useCallback(async (
        requestId: number,
        actionIntent: string | null,
        open: boolean,
    ): Promise<void> => {
        const sequence = ++detailRequestSequenceRef.current;
        if (open) {
            setDetailOpen(true);
            setDetail(null);
            setDetailActionIntent(actionIntent);
        }
        setDetailError(null);
        setDetailLoading(true);
        try {
            const nextDetail = await fetchLiffStockRequest(requestId);
            if (sequence !== detailRequestSequenceRef.current) return;

            setDetail(nextDetail);
            setDecisionIntent((currentIntent) => {
                if (currentIntent?.request.id !== nextDetail.id) {
                    return currentIntent;
                }
                return { ...currentIntent, request: nextDetail };
            });
            if (nextDetail.viewerRole === "PROCESSOR") {
                setCanProcessStockRequests(true);
                if (open && (actionIntent === "issue" || actionIntent === "review")) {
                    setActiveTab("processing");
                }
            }
        } catch (error) {
            if (sequence !== detailRequestSequenceRef.current) return;
            setDetailError(getStockError(error));
        } finally {
            if (sequence === detailRequestSequenceRef.current) {
                setDetailLoading(false);
            }
        }
    }, []);

    const openDetail = useCallback(async (
        requestId: number,
        actionIntent: string | null = null,
    ): Promise<void> => {
        await loadDetail(requestId, actionIntent, true);
    }, [loadDetail]);

    const refreshDetail = useCallback(async (requestId: number): Promise<void> => {
        await loadDetail(requestId, null, false);
    }, [loadDetail]);

    useEffect(() => {
        let cancelled = false;
        void fetchLiffStockCategories()
            .then((nextCategories) => {
                if (!cancelled) setCategories(nextCategories);
            })
            .catch(() => {
                if (!cancelled) {
                    toast.error("โหลดหมวดหมู่วัสดุไม่สำเร็จ แต่ยังค้นหาวัสดุได้");
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        catalogQueryRef.current = {
            page: catalogPage,
            search: catalogSearch,
            categoryId,
        };
    }, [catalogPage, catalogSearch, categoryId]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadCatalog({
                page: catalogPage,
                search: catalogSearch,
                categoryId,
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timeoutId);
    }, [catalogPage, catalogSearch, categoryId, loadCatalog]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadMyRequests({
                page: requestPage,
                search: requestSearch,
                status: requestStatus,
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timeoutId);
    }, [loadMyRequests, requestPage, requestSearch, requestStatus]);

    useEffect(() => {
        let cancelled = false;
        void fetchLiffHome()
            .then((home) => {
                if (!cancelled && home.capabilities.canProcessStockRequests) {
                    setCanProcessStockRequests(true);
                }
            })
            .catch(() => {
                // Capability is a UX optimization; employee flows and deep links remain usable.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!canProcessStockRequests) return;
        const timeoutId = window.setTimeout(() => {
            void loadProcessingQueue({
                page: processingPage,
                search: processingSearch,
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timeoutId);
    }, [
        canProcessStockRequests,
        loadProcessingQueue,
        processingPage,
        processingSearch,
    ]);

    useEffect(() => {
        if (!deepLinkRequestId) {
            deepLinkHandledRef.current = null;
            return;
        }
        const deepLinkKey = `${deepLinkRequestId}:${deepLinkActionIntent ?? ""}`;
        if (deepLinkHandledRef.current === deepLinkKey) return;
        deepLinkHandledRef.current = deepLinkKey;
        if (!/^[1-9]\d*$/.test(deepLinkRequestId)) {
            setFocusNotice("ลิงก์คำขอเบิกไม่ถูกต้อง กำลังแสดง Stock ตามปกติ");
            return;
        }
        const requestId = Number(deepLinkRequestId);
        if (!Number.isSafeInteger(requestId)) {
            setFocusNotice("ลิงก์คำขอเบิกไม่ถูกต้อง กำลังแสดง Stock ตามปกติ");
            return;
        }
        void openDetail(requestId, deepLinkActionIntent);
    }, [deepLinkActionIntent, deepLinkRequestId, openDetail]);

    const {
        cartCount,
        cartItems,
        cartQuantityByItemId,
        projectCode,
        recentlyAddedItemId,
        submitting,
        addDirectItem,
        addVariantsToCart,
        clearCart,
        removeFromCart,
        reconcileVariantAvailability,
        reconcileAvailability,
        hasPendingSubmission,
        setProjectCode,
        submitRequest,
        updateCartQuantity,
    } = useStockBrowseCart({
        userId: workforce.userId,
        submitRequest: submitLiffStockRequest,
        onSubmitted: () => {
            setCartOpen(false);
            setRequestPage(1);
            void Promise.all([
                loadMyRequests({ page: 1, search: requestSearch, status: requestStatus }),
                loadCatalog({ page: catalogPage, search: catalogSearch, categoryId }),
            ]);
        },
        onSubmitError: (error) => {
            if (isDeterministicStockConflict(error)) {
                void refreshCartAvailabilityRef.current();
            }
        },
    });

    const refreshCartAvailability = useCallback(async (): Promise<void> => {
        const variantIds = cartItems.map((cartItem) => cartItem.variant.id);
        if (variantIds.length === 0) {
            return;
        }

        const sequence = ++availabilityRequestSequenceRef.current;
        try {
            const latestAvailability = await fetchLiffStockVariantAvailability(
                variantIds,
            );
            if (sequence !== availabilityRequestSequenceRef.current) return;

            notifyCartAvailabilityReconciliation(
                reconcileCartVariantAvailabilityRef.current(latestAvailability),
            );
        } catch (error: unknown) {
            if (sequence !== availabilityRequestSequenceRef.current) return;
            toast.error(getStockError(error));
        }

        if (sequence === availabilityRequestSequenceRef.current) {
            await loadCatalog(catalogQueryRef.current);
        }
    }, [cartItems, loadCatalog]);

    useEffect(() => {
        reconcileCartAvailabilityRef.current = reconcileAvailability;
        reconcileCartVariantAvailabilityRef.current = reconcileVariantAvailability;
        hasPendingSubmissionRef.current = hasPendingSubmission;
        refreshCartAvailabilityRef.current = refreshCartAvailability;
    }, [
        hasPendingSubmission,
        reconcileAvailability,
        reconcileVariantAvailability,
        refreshCartAvailability,
    ]);

    function startAction(
        action: LiffStockRequestAction,
        request: LiffStockRequestSummary,
    ): void {
        setDecisionFromDetail(detailOpen);
        setDetailOpen(false);
        setMutationError(null);
        setDecisionIntent({
            action,
            request,
            actorMode: request.requester ? "processor" : "employee",
        });
    }

    const handleDetailOpenChange = useCallback((open: boolean): void => {
        if (open) {
            setDetailOpen(true);
            return;
        }
        detailRequestSequenceRef.current += 1;
        setDetailOpen(false);
        setDetail(null);
        setDetailActionIntent(null);
        setDetailError(null);
        setDetailLoading(false);
    }, []);

    async function executeMutation(reason?: string): Promise<void> {
        if (!decisionIntent || busyRequestId !== null) return;
        const { action, request, actorMode } = decisionIntent;
        setBusyRequestId(request.id);
        setMutationError(null);
        try {
            if (action === "ISSUE") {
                await issueLiffStockRequest(request.id);
            } else {
                await cancelLiffStockRequest(request.id, reason);
            }

            const refreshes: Promise<void>[] = [
                loadMyRequests({
                    page: requestPage,
                    search: requestSearch,
                    status: requestStatus,
                }),
            ];
            if (action === "ISSUE") {
                refreshes.push(loadCatalog({
                    page: catalogPage,
                    search: catalogSearch,
                    categoryId,
                }));
            }
            if (canProcessStockRequests || actorMode === "processor") {
                refreshes.push(loadProcessingQueue({
                    page: processingPage,
                    search: processingSearch,
                }));
            }
            await Promise.allSettled(refreshes);

            if (decisionFromDetail) {
                await openDetail(request.id, null);
            }
            toast.success(
                action === "ISSUE"
                    ? `จ่ายวัสดุคำขอ #${request.id} เรียบร้อยแล้ว`
                    : `ยกเลิกคำขอ #${request.id} เรียบร้อยแล้ว`,
            );
            setDecisionIntent(null);
        } catch (error) {
            setMutationError(getStockError(error));
            if (action === "ISSUE") {
                const refreshes: Promise<void>[] = [
                    loadCatalog({
                        page: catalogPage,
                        search: catalogSearch,
                        categoryId,
                    }),
                ];
                if (
                    decisionFromDetail
                    && error instanceof LiffApiError
                    && error.status === 409
                ) {
                    refreshes.push(refreshDetail(request.id));
                }
                await Promise.allSettled(refreshes);
            }
        } finally {
            setBusyRequestId(null);
        }
    }

    const showProcessorTab = canProcessStockRequests;

    return (
        <main
            id="main"
            className="bg-surface-subtle px-[max(1rem,env(safe-area-inset-left))] pb-8 pt-5 pr-[max(1rem,env(safe-area-inset-right))]"
        >
            <div className="mx-auto w-full max-w-lg space-y-4">
                {focusNotice ? (
                    <div
                        role="status"
                        className="rounded-xl bg-status-warning-surface px-3 py-3 text-sm leading-6 text-status-warning-strong ring-1 ring-status-warning-border"
                    >
                        {focusNotice}
                    </div>
                ) : null}

                <Tabs
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value as StockTab)}
                >
                    <TabsList
                        className={`grid w-full bg-surface-muted p-1 ${
                            showProcessorTab ? "grid-cols-3" : "grid-cols-2"
                        }`}
                    >
                        <TabsTrigger value="browse" className="min-h-11">
                            เบิกวัสดุ
                        </TabsTrigger>
                        <TabsTrigger value="mine" className="min-h-11">
                            คำขอของฉัน
                        </TabsTrigger>
                        {showProcessorTab ? (
                            <TabsTrigger value="processing" className="min-h-11">
                                รอดำเนินการ
                                {processingQueue.total > 0 ? (
                                    <span
                                        className="ml-1 size-2 rounded-full bg-status-attention-icon"
                                        aria-label="มีคำขอรอดำเนินการ"
                                    />
                                ) : null}
                            </TabsTrigger>
                        ) : null}
                    </TabsList>

                    <TabsContent value="browse" className="mt-5">
                        <LiffStockBrowse
                            catalog={catalog}
                            categories={categories}
                            search={catalogSearch}
                            categoryId={categoryId}
                            loading={catalogLoading}
                            error={catalogError}
                            cartCount={cartCount}
                            cartQuantityByItemId={cartQuantityByItemId}
                            recentlyAddedItemId={recentlyAddedItemId}
                            onSearchChange={(value) => {
                                setCatalogSearch(value);
                                setCatalogPage(1);
                            }}
                            onCategoryChange={(value) => {
                                setCategoryId(value);
                                setCatalogPage(1);
                            }}
                            onPageChange={setCatalogPage}
                            onRetry={() => void loadCatalog({
                                page: catalogPage,
                                search: catalogSearch,
                                categoryId,
                            })}
                            onAddDirect={addDirectItem}
                            onChooseVariant={setVariantPickerItem}
                            onOpenCart={() => setCartOpen(true)}
                        />
                    </TabsContent>

                    <TabsContent value="mine" className="mt-5">
                        <LiffStockMyRequests
                            response={myRequests}
                            search={requestSearch}
                            status={requestStatus}
                            loading={requestsLoading}
                            error={requestsError}
                            busyRequestId={busyRequestId}
                            onSearchChange={(value) => {
                                setRequestSearch(value);
                                setRequestPage(1);
                            }}
                            onStatusChange={(value) => {
                                setRequestStatus(value);
                                setRequestPage(1);
                            }}
                            onPageChange={setRequestPage}
                            onRetry={() => void loadMyRequests({
                                page: requestPage,
                                search: requestSearch,
                                status: requestStatus,
                            })}
                            onOpenDetail={(requestId) => void openDetail(requestId)}
                            onAction={startAction}
                        />
                    </TabsContent>

                    {showProcessorTab ? (
                        <TabsContent value="processing" className="mt-5">
                            <LiffStockProcessorQueue
                                response={processingQueue}
                                search={processingSearch}
                                loading={processingLoading}
                                error={processingError}
                                busyRequestId={busyRequestId}
                                onSearchChange={(value) => {
                                    setProcessingSearch(value);
                                    setProcessingPage(1);
                                }}
                                onPageChange={setProcessingPage}
                                onRetry={() => void loadProcessingQueue({
                                    page: processingPage,
                                    search: processingSearch,
                                })}
                                onOpenDetail={(requestId) => void openDetail(requestId)}
                                onAction={startAction}
                            />
                        </TabsContent>
                    ) : null}
                </Tabs>
            </div>

            <LiffStockVariantPicker
                item={variantPickerItem}
                open={variantPickerItem !== null}
                onOpenChange={(open) => {
                    if (!open) setVariantPickerItem(null);
                }}
                onConfirm={(selections) => {
                    if (!variantPickerItem) return;
                    addVariantsToCart(variantPickerItem, selections);
                    setVariantPickerItem(null);
                }}
            />
            <LiffStockCart
                open={cartOpen}
                items={cartItems}
                totalQuantity={cartCount}
                projectCode={projectCode}
                submitting={submitting}
                onOpenChange={setCartOpen}
                onProjectCodeChange={setProjectCode}
                onChangeQuantity={updateCartQuantity}
                onRemove={removeFromCart}
                onClear={clearCart}
                onSubmit={() => void submitRequest()}
            />
            <LiffStockRequestDetailSheet
                open={detailOpen}
                detail={detail}
                loading={detailLoading}
                error={detailError}
                actionIntent={detailActionIntent}
                onOpenChange={handleDetailOpenChange}
                onAction={startAction}
            />
            <LiffStockDecisionSheet
                intent={decisionIntent}
                busy={busyRequestId !== null}
                error={mutationError}
                onOpenChange={(open) => {
                    if (!open) {
                        setDecisionIntent(null);
                        setMutationError(null);
                        if (decisionFromDetail) setDetailOpen(true);
                    }
                }}
                onConfirm={(reason) => void executeMutation(reason)}
            />
        </main>
    );
}
