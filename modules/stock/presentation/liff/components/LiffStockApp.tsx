"use client";

import type { StockRequestStatus } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactElement,
    type ReactNode,
} from "react";
import { toast } from "sonner";

import {
    useStockBrowseCart,
    type StockCartAvailabilityReconciliation,
    type StockCartVariantAvailability,
} from "../../dashboard/components/useStockBrowseCart";
import type { BrowseCartItem } from "../../dashboard/components/stockVariant.shared";
import {
    isRecoveredLiffMutation,
    LIFF_SESSION_RECOVERED_MUTATION_MESSAGE,
    LiffApiError,
    useLiffWorkforce,
} from "@/modules/line/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { fetchLiffHome } from "@/modules/line/client";
import type { StockPresentationCapabilities } from "../../../application/types";
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
} from "../api";
import type {
    LiffStockCatalogItem,
    LiffStockCatalogVariant,
    LiffStockCatalogResponse,
    LiffStockCategory,
    LiffStockRequestAction,
    LiffStockRequestDetail,
    LiffStockRequestsResponse,
    LiffStockRequestSummary,
} from "../../../contracts/liff";

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

function getVisibleStockTabs(
    capabilities: StockPresentationCapabilities | null,
): StockTab[] {
    if (!capabilities) return [];

    return [
        ...(capabilities.canReadCatalog ? ["browse" as const] : []),
        ...(capabilities.canReadOwnRequests ? ["mine" as const] : []),
        ...(capabilities.canProcessRequests ? ["processing" as const] : []),
    ];
}

type CatalogLoadInput = {
    page: number;
    search: string;
    categoryId: number | undefined;
};

const CATALOG_PAGE_SIZE = 12;
const REQUEST_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const DEEP_LINK_ACTIONS = new Set(["issue", "review"]);

type StockDeepLinkAction = "issue" | "review";

export type StockDeepLinkIntent =
    | { kind: "none" }
    | {
        kind: "invalid";
        key: string;
        message: string;
    }
    | {
        kind: "detail";
        key: string;
        requestId: number;
        actionIntent: StockDeepLinkAction | null;
    };

export function parseLiffStockDeepLink(searchParams: Pick<URLSearchParams, "get">): StockDeepLinkIntent {
    const requestIdValue = searchParams.get("requestId");
    if (!requestIdValue) {
        return { kind: "none" };
    }

    const rawActionIntent = searchParams.get("action");
    const actionIntent = rawActionIntent && DEEP_LINK_ACTIONS.has(rawActionIntent)
        ? rawActionIntent as StockDeepLinkAction
        : null;
    const key = `${requestIdValue}:${rawActionIntent ?? ""}`;
    const invalidMessage = "ลิงก์คำขอเบิกไม่ถูกต้อง กำลังแสดง Stock ตามปกติ";

    if (!/^[1-9]\d*$/.test(requestIdValue)) {
        return { kind: "invalid", key, message: invalidMessage };
    }

    const requestId = Number(requestIdValue);
    if (!Number.isSafeInteger(requestId)) {
        return { kind: "invalid", key, message: invalidMessage };
    }

    return {
        kind: "detail",
        key,
        requestId,
        actionIntent,
    };
}

type StockDeepLinkSessionOutcome =
    | "none"
    | "pending"
    | "invalid"
    | "read-denied"
    | "process-denied"
    | "authorized";

type StockDeepLinkNoticeSession = {
    intentKey: string | null;
    outcome: StockDeepLinkSessionOutcome;
    notice: string | null;
};

function resolveStockDeepLinkNoticeSession(
    intent: StockDeepLinkIntent,
    capabilities: StockPresentationCapabilities | null,
): StockDeepLinkNoticeSession {
    if (intent.kind === "none") {
        return { intentKey: null, outcome: "none", notice: null };
    }
    if (intent.kind === "invalid") {
        return { intentKey: intent.key, outcome: "invalid", notice: intent.message };
    }
    if (!capabilities) {
        return { intentKey: intent.key, outcome: "pending", notice: null };
    }

    const canReadRequest = capabilities.canReadOwnRequests === true
        || capabilities.canReadAllRequests === true;
    if (!canReadRequest) {
        return {
            intentKey: intent.key,
            outcome: "read-denied",
            notice: "บัญชีนี้ไม่มีสิทธิ์ดูรายละเอียดคำขอเบิกนี้",
        };
    }

    const isProcessorIntent = intent.actionIntent === "issue"
        || intent.actionIntent === "review";
    if (isProcessorIntent && capabilities.canProcessRequests !== true) {
        return {
            intentKey: intent.key,
            outcome: "process-denied",
            notice: "บัญชีนี้ไม่มีสิทธิ์ดำเนินการคำขอเบิกนี้",
        };
    }

    return { intentKey: intent.key, outcome: "authorized", notice: null };
}

function useStockDeepLinkNoticeSession(
    intent: StockDeepLinkIntent,
    capabilities: StockPresentationCapabilities | null,
): {
    session: StockDeepLinkNoticeSession;
    acknowledge: () => void;
} {
    const intentKey = intent.kind === "none" ? null : intent.key;
    const [session, setSession] = useState<StockDeepLinkNoticeSession>({
        intentKey: null,
        outcome: "none",
        notice: null,
    });
    const resolvedSession = resolveStockDeepLinkNoticeSession(intent, capabilities);
    if (
        session.intentKey !== resolvedSession.intentKey
        || (session.outcome === "pending" && resolvedSession.outcome !== "pending")
    ) {
        setSession(resolvedSession);
    }

    const acknowledge = useCallback((): void => {
        setSession((currentSession) =>
            currentSession.intentKey === intentKey && currentSession.notice !== null
                ? { ...currentSession, notice: null }
                : currentSession,
        );
    }, [intentKey, setSession]);

    return { session, acknowledge };
}

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
    const deepLinkIntent = parseLiffStockDeepLink(searchParams);
    const deepLinkIntentKey = deepLinkIntent.kind === "none"
        ? null
        : deepLinkIntent.key;
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
    const stockCapabilitiesRef = useRef<StockPresentationCapabilities | null>(null);

    useEffect(() => () => {
        catalogRequestSequenceRef.current += 1;
        requestHistorySequenceRef.current += 1;
        processingQueueSequenceRef.current += 1;
        detailRequestSequenceRef.current += 1;
        availabilityRequestSequenceRef.current += 1;
    }, []);

    const [activeTab, setActiveTab] = useState<StockTab>("browse");
    const [createUiSessionId, setCreateUiSessionId] = useState(0);
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

    const [stockCapabilities, setStockCapabilities] =
        useState<StockPresentationCapabilities | null>(null);
    const [stockHomeLoading, setStockHomeLoading] = useState(true);
    const [stockHomeError, setStockHomeError] = useState<string | null>(null);
    const [processingQueue, setProcessingQueue] = useState<LiffStockRequestsResponse>(EMPTY_REQUESTS);
    const [processingSearch, setProcessingSearch] = useState("");
    const [processingPage, setProcessingPage] = useState(1);
    const [processingLoading, setProcessingLoading] = useState(false);
    const [processingError, setProcessingError] = useState<string | null>(null);

    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState<LiffStockRequestDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [detailActionIntent, setDetailActionIntent] = useState<string | null>(null);
    const [operationalNotice, setOperationalNotice] = useState<string | null>(null);
    const {
        session: deepLinkNoticeSession,
        acknowledge: acknowledgeDeepLinkNotice,
    } = useStockDeepLinkNoticeSession(deepLinkIntent, stockCapabilities);
    const [decisionIntent, setDecisionIntent] = useState<LiffStockDecisionIntent | null>(null);
    const [decisionFromDetail, setDecisionFromDetail] = useState(false);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [busyRequestId, setBusyRequestId] = useState<number | null>(null);

    const loadCatalog = useCallback(async (input: CatalogLoadInput): Promise<void> => {
        if (stockCapabilitiesRef.current?.canReadCatalog !== true) {
            return;
        }
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
        if (stockCapabilitiesRef.current?.canReadOwnRequests !== true) {
            return;
        }
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
        if (stockCapabilitiesRef.current?.canProcessRequests !== true) {
            return;
        }
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
        const capabilities = stockCapabilitiesRef.current;
        const isProcessorIntent = actionIntent === "issue"
            || actionIntent === "review";
        const canReadRequest = capabilities?.canReadOwnRequests === true
            || capabilities?.canReadAllRequests === true;
        if (!canReadRequest) {
            setOperationalNotice("บัญชีนี้ไม่มีสิทธิ์ดูรายละเอียดคำขอเบิกนี้");
            return;
        }
        if (isProcessorIntent && capabilities?.canProcessRequests !== true) {
            setOperationalNotice(
                "บัญชีนี้ไม่มีสิทธิ์ดำเนินการคำขอเบิกนี้",
            );
            return;
        }
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
            if (open && isProcessorIntent && capabilities?.canProcessRequests === true) {
                setActiveTab("processing");
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

    const openManualDetail = useCallback(async (
        requestId: number,
        actionIntent: string | null = null,
    ): Promise<void> => {
        acknowledgeDeepLinkNotice();
        await openDetail(requestId, actionIntent);
    }, [acknowledgeDeepLinkNotice, openDetail]);

    const refreshDetail = useCallback(async (requestId: number): Promise<void> => {
        await loadDetail(requestId, null, false);
    }, [loadDetail]);

    const loadStockCapabilities = useCallback(async (): Promise<StockPresentationCapabilities | null> => {
        stockCapabilitiesRef.current = null;
        setStockCapabilities(null);
        setStockHomeLoading(true);
        setStockHomeError(null);
        try {
            const home = await fetchLiffHome();
            const nextCapabilities = home.capabilities.stockCapabilities;
            if (!nextCapabilities) {
                throw new Error("ไม่พบสิทธิ์การใช้งาน Stock");
            }
            const nextVisibleTabs = getVisibleStockTabs(nextCapabilities);
            const nextFirstVisibleTab = nextVisibleTabs[0];
            setActiveTab((currentTab) => {
                if (!nextFirstVisibleTab) return "browse";
                return nextVisibleTabs.includes(currentTab) ? currentTab : nextFirstVisibleTab;
            });
            stockCapabilitiesRef.current = nextCapabilities;
            setStockCapabilities(nextCapabilities);
            return nextCapabilities;
        } catch (error: unknown) {
            stockCapabilitiesRef.current = null;
            setStockCapabilities(null);
            setStockHomeError(getStockError(error));
            return null;
        } finally {
            setStockHomeLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadStockCapabilities();
    }, [loadStockCapabilities]);

    useEffect(() => {
        let cancelled = false;
        if (stockCapabilitiesRef.current?.canReadCatalog !== true) {
            setCategories([]);
            return () => {
                cancelled = true;
            };
        }
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
    }, [stockCapabilities]);

    useEffect(() => {
        catalogQueryRef.current = {
            page: catalogPage,
            search: catalogSearch,
            categoryId,
        };
    }, [catalogPage, catalogSearch, categoryId]);

    useEffect(() => {
        if (stockCapabilitiesRef.current?.canReadCatalog !== true) {
            return;
        }
        const timeoutId = window.setTimeout(() => {
            void loadCatalog({
                page: catalogPage,
                search: catalogSearch,
                categoryId,
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timeoutId);
    }, [catalogPage, catalogSearch, categoryId, loadCatalog, stockCapabilities]);

    useEffect(() => {
        if (stockCapabilitiesRef.current?.canReadOwnRequests !== true) {
            return;
        }
        const timeoutId = window.setTimeout(() => {
            void loadMyRequests({
                page: requestPage,
                search: requestSearch,
                status: requestStatus,
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timeoutId);
    }, [loadMyRequests, requestPage, requestSearch, requestStatus, stockCapabilities]);

    useEffect(() => {
        if (stockCapabilitiesRef.current?.canProcessRequests !== true) return;
        const timeoutId = window.setTimeout(() => {
            void loadProcessingQueue({
                page: processingPage,
                search: processingSearch,
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timeoutId);
    }, [
        loadProcessingQueue,
        processingPage,
        processingSearch,
        stockCapabilities,
    ]);

    useEffect(() => {
        if (deepLinkIntentKey === null) {
            deepLinkHandledRef.current = null;
            return;
        }
        if (deepLinkHandledRef.current === deepLinkIntentKey) return;
        if (deepLinkIntent.kind === "invalid") {
            deepLinkHandledRef.current = deepLinkIntentKey;
            return;
        }
        if (deepLinkIntent.kind !== "detail") return;

        const resolution = resolveStockDeepLinkNoticeSession(
            deepLinkIntent,
            stockCapabilitiesRef.current,
        );
        if (resolution.outcome === "pending") return;
        if (resolution.outcome !== "authorized") {
            deepLinkHandledRef.current = deepLinkIntentKey;
            return;
        }

        deepLinkHandledRef.current = deepLinkIntentKey;
        void openDetail(deepLinkIntent.requestId, deepLinkIntent.actionIntent);
    }, [deepLinkIntent, deepLinkIntentKey, openDetail, stockCapabilities]);

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
        canCreateRequests: stockCapabilities?.canCreateRequests === true,
        submitRequest: submitLiffStockRequest,
        onSubmitted: () => {
            setCreateUiSessionId((currentId) => currentId + 1);
            setRequestPage(1);
            void Promise.all([
                loadMyRequests({ page: 1, search: requestSearch, status: requestStatus }),
                loadCatalog({ page: catalogPage, search: catalogSearch, categoryId }),
            ]);
        },
        onSubmitError: async (error) => {
            if (isRecoveredLiffMutation(error)) {
                setOperationalNotice(LIFF_SESSION_RECOVERED_MUTATION_MESSAGE);
                const capabilities = await loadStockCapabilities();
                const refreshes: Promise<void>[] = [];
                if (capabilities?.canReadOwnRequests) {
                    refreshes.push(loadMyRequests({
                        page: requestPage,
                        search: requestSearch,
                        status: requestStatus,
                    }));
                }
                if (capabilities?.canReadCatalog) {
                    refreshes.push(refreshCartAvailabilityRef.current());
                }
                await Promise.allSettled(refreshes);
                return;
            }
            if (isDeterministicStockConflict(error)) {
                void refreshCartAvailabilityRef.current();
            }
        },
    });

    const refreshCartAvailability = useCallback(async (): Promise<void> => {
        if (stockCapabilitiesRef.current?.canReadCatalog !== true) {
            return;
        }
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
        const capabilities = stockCapabilitiesRef.current;
        const canUseAction = action === "ISSUE"
            ? capabilities?.canProcessRequests === true
            : request.requester
                ? capabilities?.canCancelAnyRequests === true
                : capabilities?.canCancelOwnRequests === true;
        if (!canUseAction) {
            setOperationalNotice(
                action === "ISSUE"
                    ? "บัญชีนี้ไม่มีสิทธิ์จ่ายวัสดุ"
                    : "บัญชีนี้ไม่มีสิทธิ์ยกเลิกคำขอนี้",
            );
            return;
        }
        if (!request.availableActions.includes(action)) return;
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
        const capabilities = stockCapabilitiesRef.current;
        const canUseAction = action === "ISSUE"
            ? capabilities?.canProcessRequests === true
            : actorMode === "processor"
                ? capabilities?.canCancelAnyRequests === true
                : capabilities?.canCancelOwnRequests === true;
        if (!canUseAction) {
            setMutationError(
                action === "ISSUE"
                    ? "บัญชีนี้ไม่มีสิทธิ์จ่ายวัสดุ"
                    : "บัญชีนี้ไม่มีสิทธิ์ยกเลิกคำขอนี้",
            );
            setDecisionIntent(null);
            setDecisionFromDetail(false);
            return;
        }
        if (!request.availableActions.includes(action)) {
            setMutationError("สถานะคำขอเปลี่ยนแปลงแล้ว กรุณาตรวจสอบรายละเอียดล่าสุด");
            return;
        }
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
            if (stockCapabilitiesRef.current?.canProcessRequests === true) {
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
            if (isRecoveredLiffMutation(error)) {
                setMutationError(LIFF_SESSION_RECOVERED_MUTATION_MESSAGE);
                setOperationalNotice(LIFF_SESSION_RECOVERED_MUTATION_MESSAGE);
                const refreshedCapabilities = await loadStockCapabilities();
                const refreshes: Promise<void>[] = [];
                if (refreshedCapabilities?.canReadOwnRequests) {
                    refreshes.push(loadMyRequests({
                        page: requestPage,
                        search: requestSearch,
                        status: requestStatus,
                    }));
                }
                if (action === "ISSUE" && refreshedCapabilities?.canReadCatalog) {
                    refreshes.push(loadCatalog({
                        page: catalogPage,
                        search: catalogSearch,
                        categoryId,
                    }));
                }
                if (refreshedCapabilities?.canProcessRequests) {
                    refreshes.push(loadProcessingQueue({
                        page: processingPage,
                        search: processingSearch,
                    }));
                }
                await Promise.allSettled(refreshes);
                if (
                    decisionFromDetail
                    && (refreshedCapabilities?.canReadOwnRequests
                        || refreshedCapabilities?.canReadAllRequests
                        || refreshedCapabilities?.canProcessRequests)
                ) {
                    await openDetail(request.id, null);
                }
                setDecisionIntent(null);
                setDecisionFromDetail(false);
                return;
            }
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

    const canReadCatalog = stockCapabilities?.canReadCatalog === true;
    const canReadOwnRequests = stockCapabilities?.canReadOwnRequests === true;
    const canProcessRequests = stockCapabilities?.canProcessRequests === true;
    const visibleTabs = getVisibleStockTabs(stockCapabilities);
    const firstVisibleTab = visibleTabs[0] ?? null;
    const safeActiveTab = visibleTabs.includes(activeTab)
        ? activeTab
        : firstVisibleTab;
    if (stockHomeLoading && !stockCapabilities) {
        return (
            <main
                id="main"
                className="bg-surface-subtle px-[max(1rem,env(safe-area-inset-left))] pb-8 pt-5 pr-[max(1rem,env(safe-area-inset-right))]"
            >
                <div className="mx-auto flex min-h-64 w-full max-w-lg items-center justify-center text-sm font-medium text-content-secondary" role="status">
                    กำลังตรวจสอบสิทธิ์การใช้งาน Stock…
                </div>
            </main>
        );
    }

    if (stockHomeError && !stockCapabilities) {
        return (
            <main
                id="main"
                className="bg-surface-subtle px-[max(1rem,env(safe-area-inset-left))] pb-8 pt-5 pr-[max(1rem,env(safe-area-inset-right))]"
            >
                <div className="mx-auto flex min-h-64 w-full max-w-lg flex-col items-center justify-center gap-3 px-4 text-center" role="alert">
                    <p className="text-sm leading-6 text-status-danger-foreground">{stockHomeError}</p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void loadStockCapabilities()}
                        className="min-h-11"
                    >
                        ลองตรวจสอบอีกครั้ง
                    </Button>
                </div>
            </main>
        );
    }

    if (!stockCapabilities || !firstVisibleTab || !safeActiveTab) {
        return (
            <main
                id="main"
                className="bg-surface-subtle px-[max(1rem,env(safe-area-inset-left))] pb-8 pt-5 pr-[max(1rem,env(safe-area-inset-right))]"
            >
                <div className="mx-auto flex min-h-64 w-full max-w-lg items-center justify-center px-4 text-center text-sm leading-6 text-content-secondary" role="status">
                    บัญชีนี้ยังไม่มีพื้นที่ใช้งาน Stock ใน NHFapp
                </div>
            </main>
        );
    }

    return (
        <main
            id="main"
            className="bg-surface-subtle px-[max(1rem,env(safe-area-inset-left))] pb-8 pt-5 pr-[max(1rem,env(safe-area-inset-right))]"
        >
            <div className="mx-auto w-full max-w-lg space-y-4">
                {operationalNotice ?? deepLinkNoticeSession.notice ? (
                    <div
                        role="status"
                        className="border-y border-status-warning-border bg-status-warning-surface px-3 py-3 text-sm leading-6 text-status-warning-strong"
                    >
                        {operationalNotice ?? deepLinkNoticeSession.notice}
                    </div>
                ) : null}

                <LiffStockCreateCapabilitySession
                    key={`${stockCapabilities.canCreateRequests ? "can-create" : "read-only"}-${createUiSessionId}`}
                    canCreateRequests={stockCapabilities.canCreateRequests}
                    cartItems={cartItems}
                    totalQuantity={cartCount}
                    projectCode={projectCode}
                    submitting={submitting}
                    onProjectCodeChange={setProjectCode}
                    onChangeQuantity={updateCartQuantity}
                    onRemove={removeFromCart}
                    onClear={clearCart}
                    onSubmit={() => void submitRequest()}
                    addVariantsToCart={addVariantsToCart}
                >
                    {({ onChooseVariant, onOpenCart }) => (
                        <Tabs
                            value={safeActiveTab}
                            onValueChange={(value) => {
                                const nextTab = value as StockTab;
                                if (visibleTabs.includes(nextTab)) setActiveTab(nextTab);
                            }}
                        >
                    <TabsList
                        className={`grid w-full bg-surface-muted p-1 ${
                            visibleTabs.length === 1
                                ? "grid-cols-1"
                                : visibleTabs.length === 2
                                    ? "grid-cols-2"
                                    : "grid-cols-3"
                        }`}
                    >
                        {canReadCatalog ? (
                            <TabsTrigger value="browse" className="min-h-11">
                                เบิกวัสดุ
                            </TabsTrigger>
                        ) : null}
                        {canReadOwnRequests ? (
                            <TabsTrigger value="mine" className="min-h-11">
                                คำขอของฉัน
                            </TabsTrigger>
                        ) : null}
                        {canProcessRequests ? (
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

                    {canReadCatalog ? <TabsContent value="browse" className="mt-5">
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
                            onChooseVariant={onChooseVariant}
                            onOpenCart={onOpenCart}
                            canCreateRequests={stockCapabilities.canCreateRequests}
                        />
                    </TabsContent> : null}

                    {canReadOwnRequests ? <TabsContent value="mine" className="mt-5">
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
                            onOpenDetail={(requestId) => void openManualDetail(requestId)}
                            onAction={startAction}
                            canCancelOwnRequests={stockCapabilities.canCancelOwnRequests}
                        />
                    </TabsContent> : null}

                    {canProcessRequests ? (
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
                                onOpenDetail={(requestId) => void openManualDetail(requestId)}
                                onAction={startAction}
                                canProcessRequests={stockCapabilities.canProcessRequests}
                                canCancelAnyRequests={stockCapabilities.canCancelAnyRequests}
                                canReadAllRequests={stockCapabilities.canReadAllRequests}
                            />
                        </TabsContent>
                    ) : null}
                        </Tabs>
                    )}
                </LiffStockCreateCapabilitySession>
            </div>
            <LiffStockRequestDetailSheet
                open={detailOpen}
                detail={detail}
                loading={detailLoading}
                error={detailError}
                actionIntent={detailActionIntent}
                canProcessRequests={stockCapabilities.canProcessRequests}
                canCancelOwnRequests={stockCapabilities.canCancelOwnRequests}
                canCancelAnyRequests={stockCapabilities.canCancelAnyRequests}
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

type LiffStockCreateCapabilitySessionProps = {
    canCreateRequests: boolean;
    cartItems: BrowseCartItem[];
    totalQuantity: number;
    projectCode: string;
    submitting: boolean;
    onProjectCodeChange: (value: string) => void;
    onChangeQuantity: (variantId: number, delta: number) => void;
    onRemove: (variantId: number) => void;
    onClear: () => void;
    onSubmit: () => void;
    addVariantsToCart: (
        item: LiffStockCatalogItem,
        selections: ReadonlyArray<{
            variant: LiffStockCatalogVariant;
            quantity: number;
        }>,
    ) => void;
    children: (handlers: {
        onChooseVariant: (item: LiffStockCatalogItem) => void;
        onOpenCart: () => void;
    }) => ReactNode;
};

function LiffStockCreateCapabilitySession({
    canCreateRequests,
    cartItems,
    totalQuantity,
    projectCode,
    submitting,
    onProjectCodeChange,
    onChangeQuantity,
    onRemove,
    onClear,
    onSubmit,
    addVariantsToCart,
    children,
}: LiffStockCreateCapabilitySessionProps): ReactElement {
    const [variantPickerItem, setVariantPickerItem] = useState<LiffStockCatalogItem | null>(null);
    const [cartOpen, setCartOpen] = useState(false);

    function onChooseVariant(item: LiffStockCatalogItem): void {
        if (canCreateRequests) {
            setVariantPickerItem(item);
        }
    }

    function onOpenCart(): void {
        if (canCreateRequests) {
            setCartOpen(true);
        }
    }

    return (
        <>
            {children({ onChooseVariant, onOpenCart })}
            <LiffStockVariantPicker
                item={variantPickerItem}
                open={variantPickerItem !== null}
                onOpenChange={(open) => {
                    if (!open) setVariantPickerItem(null);
                }}
                onConfirm={(selections) => {
                    if (!variantPickerItem || !canCreateRequests) return;
                    addVariantsToCart(variantPickerItem, selections);
                    setVariantPickerItem(null);
                }}
                canCreateRequests={canCreateRequests}
            />
            <LiffStockCart
                open={cartOpen}
                items={cartItems}
                totalQuantity={totalQuantity}
                projectCode={projectCode}
                submitting={submitting}
                onOpenChange={(open) => {
                    if (!open || canCreateRequests) setCartOpen(open);
                }}
                onProjectCodeChange={onProjectCodeChange}
                onChangeQuantity={onChangeQuantity}
                onRemove={onRemove}
                onClear={onClear}
                onSubmit={onSubmit}
                canCreateRequests={canCreateRequests}
            />
        </>
    );
}
