"use client";

import { useSearchParams } from "next/navigation";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactElement,
} from "react";
import { toast } from "sonner";

import { ErrorState, LoadingState } from "@/components/ui/state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    cancelLiffLeave,
    confirmLiffLeaveNotTaken,
    decideLiffLeaveCancellation,
    fetchLiffLeaveApprovals,
    fetchLiffLeaveProfile,
    fetchLiffLeaveRequest,
    requestLiffLeaveNotTaken,
    submitLiffLeaveDecision,
} from "@/lib/client/liff-leave";
import { fetchLiffHome } from "@/lib/client/liff-home";
import { LiffApiError } from "@/lib/client/liff";
import type { LeaveHistoryFilters } from "@/lib/services/leave/history-filters";
import type {
    ApproverLeaveAction,
    EmployeeLeaveAction,
    LiffEmployeeLeaveRequest,
    LiffLeaveApprovalItem,
    LiffLeaveApprovalsResponse,
    LiffLeaveProfileResponse,
    LiffLeaveRequestDetail as LiffLeaveRequestDetailData,
} from "@/lib/types/leave";

import { LiffLeaveApprovals } from "./LiffLeaveApprovals";
import {
    LiffLeaveDecisionSheet,
    type LiffLeaveMutationIntent,
} from "./LiffLeaveDecisionSheet";
import { LiffLeaveHistory } from "./LiffLeaveHistory";
import { LiffLeaveOverview } from "./LiffLeaveOverview";
import { LiffLeaveRequestDetail } from "./LiffLeaveRequestDetail";
import { LiffLeaveRequestForm } from "./LiffLeaveRequestForm";
import {
    formatLeaveDateRange,
    getLeaveTypeLabel,
} from "./leave-format";

type LeaveViewState = "LOADING" | "READY" | "ERROR";
type LeaveTab = "mine" | "approvals";
type ApprovalCategory = "pending" | "notTakenPending" | "cancellationPending";

const INITIAL_APPROVAL_PAGES = {
    pendingPage: 1,
    notTakenPage: 1,
    cancellationPage: 1,
} as const;

const EMPTY_APPROVALS: LiffLeaveApprovalsResponse = {
    pending: [],
    notTakenPending: [],
    cancellationPending: [],
    metadata: {
        pending: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 },
        notTakenPending: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 },
        cancellationPending: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 },
    },
    hasActionableWork: false,
};

const DEEP_LINK_ACTIONS = new Set(["approve", "review", "cancel", "not-taken"]);

function getViewError(error: unknown): string {
    if (error instanceof LiffApiError) return error.message;
    return "ไม่สามารถโหลดข้อมูล Leave ได้ กรุณาลองใหม่อีกครั้ง";
}

export function LiffLeaveApp(): ReactElement {
    const searchParams = useSearchParams();
    const deepLinkRequestId = searchParams.get("requestId");
    const rawActionIntent = searchParams.get("action");
    const actionIntent = rawActionIntent && DEEP_LINK_ACTIONS.has(rawActionIntent)
        ? rawActionIntent
        : null;
    const deepLinkHandledRef = useRef<string | null>(null);
    const [state, setState] = useState<LeaveViewState>("LOADING");
    const [viewError, setViewError] = useState<string | null>(null);
    const [profile, setProfile] = useState<LiffLeaveProfileResponse | null>(null);
    const [approvals, setApprovals] = useState<LiffLeaveApprovalsResponse>(EMPTY_APPROVALS);
    const [canApproveLeave, setCanApproveLeave] = useState(false);
    const [approvalError, setApprovalError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<LeaveTab>("mine");
    const [hadApprovalWork, setHadApprovalWork] = useState(false);
    const [profilePage, setProfilePage] = useState(1);
    const [historyFilters, setHistoryFilters] = useState<LeaveHistoryFilters>({});
    const [approvalPages, setApprovalPages] = useState({ ...INITIAL_APPROVAL_PAGES });
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const [isApprovalsLoading, setIsApprovalsLoading] = useState(false);
    const [requestFormOpen, setRequestFormOpen] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<LiffLeaveRequestDetailData | null>(null);
    const [selectedDetailActionIntent, setSelectedDetailActionIntent] = useState<string | null>(null);
    const [focusNotice, setFocusNotice] = useState<string | null>(null);
    const [mutationIntent, setMutationIntent] = useState<LiffLeaveMutationIntent | null>(null);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [isMutating, setIsMutating] = useState(false);

    const initialRequestSequenceRef = useRef(0);
    const profileRequestSequenceRef = useRef(0);
    const approvalsRequestSequenceRef = useRef(0);
    const capabilityRequestSequenceRef = useRef(0);
    const detailRequestSequenceRef = useRef(0);

    useEffect(() => () => {
        initialRequestSequenceRef.current += 1;
        profileRequestSequenceRef.current += 1;
        approvalsRequestSequenceRef.current += 1;
        capabilityRequestSequenceRef.current += 1;
        detailRequestSequenceRef.current += 1;
    }, []);

    const refreshApprovals = useCallback(async (
        pages: typeof INITIAL_APPROVAL_PAGES,
    ): Promise<void> => {
        const requestSequence = ++approvalsRequestSequenceRef.current;
        setIsApprovalsLoading(true);
        setApprovalError(null);
        try {
            const nextApprovals = await fetchLiffLeaveApprovals(pages);
            if (requestSequence !== approvalsRequestSequenceRef.current) return;
            setApprovals(nextApprovals);
            if (nextApprovals.hasActionableWork) setHadApprovalWork(true);
        } catch (error) {
            if (requestSequence !== approvalsRequestSequenceRef.current) return;
            const message = getViewError(error);
            setApprovalError(message);
            toast.error(message);
        } finally {
            if (requestSequence === approvalsRequestSequenceRef.current) {
                setIsApprovalsLoading(false);
            }
        }
    }, []);

    const loadApproverExperience = useCallback(async (): Promise<void> => {
        const requestSequence = ++capabilityRequestSequenceRef.current;
        try {
            const home = await fetchLiffHome();
            if (requestSequence !== capabilityRequestSequenceRef.current) return;
            if (!home.capabilities.canApproveLeave) return;

            setCanApproveLeave(true);
            await refreshApprovals(INITIAL_APPROVAL_PAGES);
        } catch {
            // Capability is an optimization hint; employee Leave and deep links remain usable.
        }
    }, [refreshApprovals]);

    const loadInitialData = useCallback(async (): Promise<void> => {
        const requestSequence = ++initialRequestSequenceRef.current;
        profileRequestSequenceRef.current += 1;
        approvalsRequestSequenceRef.current += 1;
        capabilityRequestSequenceRef.current += 1;
        detailRequestSequenceRef.current += 1;
        setState("LOADING");
        setViewError(null);
        setApprovalError(null);
        setCanApproveLeave(false);
        setApprovals(EMPTY_APPROVALS);
        setHadApprovalWork(false);
        setIsProfileLoading(false);
        setIsApprovalsLoading(false);
        setSelectedDetail(null);
        setSelectedDetailActionIntent(null);
        try {
            const nextProfile = await fetchLiffLeaveProfile({ page: 1 });
            if (requestSequence !== initialRequestSequenceRef.current) return;
            setProfile(nextProfile);
            setState("READY");
            void loadApproverExperience();
        } catch (error) {
            if (requestSequence !== initialRequestSequenceRef.current) return;
            setViewError(getViewError(error));
            setState("ERROR");
        }
    }, [loadApproverExperience]);

    useEffect(() => {
        void loadInitialData();
    }, [loadInitialData]);

    const openDetail = useCallback(async (
        requestId: string,
        intent: string | null = null,
    ): Promise<void> => {
        const requestSequence = ++detailRequestSequenceRef.current;
        setFocusNotice(null);
        setSelectedDetail(null);
        setSelectedDetailActionIntent(intent);
        try {
            const detail = await fetchLiffLeaveRequest(requestId);
            if (requestSequence !== detailRequestSequenceRef.current) return;
            setSelectedDetail(detail);
            if (detail.viewerRole === "APPROVER" && detail.availableActions.length > 0) {
                setHadApprovalWork(true);
                if (intent === "approve" || intent === "review") {
                    setActiveTab("approvals");
                }
            }
        } catch (error) {
            if (requestSequence !== detailRequestSequenceRef.current) return;
            setSelectedDetail(null);
            setSelectedDetailActionIntent(null);
            setFocusNotice(
                error instanceof LiffApiError && error.status === 404
                    ? "ไม่พบคำขอลานี้ หรือคุณไม่มีสิทธิ์ดูรายการดังกล่าว"
                    : getViewError(error),
            );
        }
    }, []);

    useEffect(() => {
        if (
            state !== "READY"
            || !deepLinkRequestId
        ) {
            if (!deepLinkRequestId) deepLinkHandledRef.current = null;
            return;
        }
        const deepLinkKey = `${deepLinkRequestId}:${actionIntent ?? ""}`;
        if (deepLinkHandledRef.current === deepLinkKey) return;
        deepLinkHandledRef.current = deepLinkKey;
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(deepLinkRequestId)) {
            setFocusNotice("ลิงก์คำขอลาไม่ถูกต้อง กำลังแสดงรายการของคุณตามปกติ");
            return;
        }
        void openDetail(deepLinkRequestId, actionIntent);
    }, [actionIntent, deepLinkRequestId, openDetail, state]);

    const refreshProfile = useCallback(async (
        page: number = profilePage,
        filters: LeaveHistoryFilters = historyFilters,
    ): Promise<void> => {
        const requestSequence = ++profileRequestSequenceRef.current;
        setIsProfileLoading(true);
        try {
            const nextProfile = await fetchLiffLeaveProfile({ page, filters });
            if (requestSequence !== profileRequestSequenceRef.current) return;
            setProfile(nextProfile);
        } catch (error) {
            if (requestSequence !== profileRequestSequenceRef.current) return;
            toast.error(getViewError(error));
        } finally {
            if (requestSequence === profileRequestSequenceRef.current) {
                setIsProfileLoading(false);
            }
        }
    }, [historyFilters, profilePage]);

    const startAction = useCallback((
        action: EmployeeLeaveAction | ApproverLeaveAction,
        request: LiffEmployeeLeaveRequest | LiffLeaveApprovalItem | LiffLeaveRequestDetailData,
    ): void => {
        detailRequestSequenceRef.current += 1;
        setSelectedDetail(null);
        setSelectedDetailActionIntent(null);
        setMutationError(null);
        setMutationIntent({
            requestId: request.id,
            action,
            title: getLeaveTypeLabel(request.leaveType),
            summary: formatLeaveDateRange(request.startDate, request.endDate),
            hasWarnings: Boolean(
                "overQuotaDays" in request
                && (request.overQuotaDays > 0 || request.emergencyReason || request.specialReason),
            ),
        });
    }, []);

    const executeMutation = async (reason: string | undefined): Promise<void> => {
        if (!mutationIntent || isMutating) return;
        setIsMutating(true);
        setMutationError(null);
        try {
            const { requestId, action } = mutationIntent;
            if (action === "CANCEL" || action === "REQUEST_CANCELLATION") {
                await cancelLiffLeave(requestId, reason);
            } else if (action === "REQUEST_NOT_TAKEN") {
                await requestLiffLeaveNotTaken(requestId, reason ?? "");
            } else if (action === "APPROVE" || action === "REJECT") {
                await submitLiffLeaveDecision({
                    leaveId: requestId,
                    action,
                    reason,
                });
            } else if (action === "CONFIRM_NOT_TAKEN") {
                await confirmLiffLeaveNotTaken(requestId, reason);
            } else {
                await decideLiffLeaveCancellation({
                    leaveId: requestId,
                    action: action === "CONFIRM_CANCELLATION" ? "CONFIRM" : "REJECT",
                    reason,
                });
            }

            const isEmployeeAction = action === "CANCEL"
                || action === "REQUEST_CANCELLATION"
                || action === "REQUEST_NOT_TAKEN";
            if (isEmployeeAction) {
                await refreshProfile();
            } else {
                const firstPages = { ...INITIAL_APPROVAL_PAGES };
                setApprovalPages(firstPages);
                await refreshApprovals(firstPages);
            }
            toast.success(getMutationSuccessMessage(action));
            setMutationIntent(null);
        } catch (error) {
            setMutationError(getViewError(error));
        } finally {
            setIsMutating(false);
        }
    };

    if (state === "ERROR") {
        return (
            <ErrorState
                title="เปิด Leave ไม่สำเร็จ"
                description={viewError ?? "กรุณาลองใหม่อีกครั้ง"}
                action={{ label: "ลองใหม่", onClick: () => void loadInitialData() }}
                className="min-h-[60svh] rounded-none border-0 bg-surface-subtle px-4 py-10"
            />
        );
    }

    if (state !== "READY" || !profile) {
        return (
            <LoadingState
                label="กำลังโหลดข้อมูล Leave..."
                className="min-h-[60svh] rounded-none border-0 bg-surface-subtle px-4 py-10"
            />
        );
    }

    const showApprovalTab = canApproveLeave
        || hadApprovalWork
        || approvals.hasActionableWork;

    return (
        <main
            id="main"
            className="bg-surface-subtle px-[max(1rem,env(safe-area-inset-left))] pb-8 pt-5 pr-[max(1rem,env(safe-area-inset-right))]"
        >
            <div className="mx-auto w-full max-w-lg space-y-5">
                {focusNotice ? (
                    <div role="status" className="rounded-xl border border-status-warning-border bg-status-warning-surface px-3 py-3 text-sm leading-6 text-status-warning-strong">
                        {focusNotice}
                    </div>
                ) : null}
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LeaveTab)}>
                    {showApprovalTab ? (
                        <TabsList className="grid w-full grid-cols-2 bg-surface-muted p-1">
                            <TabsTrigger value="mine">วันลาของฉัน</TabsTrigger>
                            <TabsTrigger value="approvals">
                                รอพิจารณา
                                {approvals.hasActionableWork ? (
                                    <span className="ml-1 size-2 rounded-full bg-status-attention-icon" aria-label="มีรายการรอพิจารณา" />
                                ) : null}
                            </TabsTrigger>
                        </TabsList>
                    ) : null}
                    <TabsContent value="mine" className="mt-5 space-y-7">
                        <LiffLeaveOverview
                            quotas={profile.quotas}
                            onCreateRequest={() => setRequestFormOpen(true)}
                        />
                        <LiffLeaveHistory
                            profile={profile}
                            filters={historyFilters}
                            isLoading={isProfileLoading}
                            onApplyFilters={(filters) => {
                                setHistoryFilters(filters);
                                setProfilePage(1);
                                void refreshProfile(1, filters);
                            }}
                            onPageChange={(page) => {
                                setProfilePage(page);
                                void refreshProfile(page);
                            }}
                            onOpenDetail={(requestId) => void openDetail(requestId)}
                            onAction={startAction}
                        />
                    </TabsContent>
                    {showApprovalTab ? (
                        <TabsContent value="approvals" className="mt-5">
                            {approvalError ? (
                                <ErrorState
                                    title="โหลดรายการรอพิจารณาไม่สำเร็จ"
                                    description={approvalError}
                                    action={{
                                        label: "ลองโหลดรายการอีกครั้ง",
                                        onClick: () => void refreshApprovals(approvalPages),
                                    }}
                                    className="min-h-64 border-border-subtle bg-surface-raised px-4 py-8"
                                />
                            ) : (
                                <LiffLeaveApprovals
                                    approvals={approvals}
                                    isLoading={isApprovalsLoading}
                                    onOpenDetail={(requestId) => void openDetail(requestId)}
                                    onAction={startAction}
                                    onPageChange={(category, page) => {
                                        const pageKey: Record<ApprovalCategory, keyof typeof approvalPages> = {
                                            pending: "pendingPage",
                                            notTakenPending: "notTakenPage",
                                            cancellationPending: "cancellationPage",
                                        };
                                        const nextPages = { ...approvalPages, [pageKey[category]]: page };
                                        setApprovalPages(nextPages);
                                        void refreshApprovals(nextPages);
                                    }}
                                />
                            )}
                        </TabsContent>
                    ) : null}
                </Tabs>
            </div>

            <LiffLeaveRequestForm
                open={requestFormOpen}
                quotas={profile.quotas}
                onOpenChange={setRequestFormOpen}
                onSuccess={async () => {
                    setProfilePage(1);
                    await refreshProfile(1);
                }}
            />
            <LiffLeaveRequestDetail
                detail={selectedDetail}
                actionIntent={selectedDetailActionIntent}
                onOpenChange={(open) => {
                    if (!open) {
                        detailRequestSequenceRef.current += 1;
                        setSelectedDetail(null);
                        setSelectedDetailActionIntent(null);
                    }
                }}
                onAction={startAction}
            />
            <LiffLeaveDecisionSheet
                intent={mutationIntent}
                busy={isMutating}
                error={mutationError}
                onOpenChange={(open) => {
                    if (!open) {
                        setMutationIntent(null);
                        setMutationError(null);
                    }
                }}
                onConfirm={executeMutation}
            />
        </main>
    );
}

function getMutationSuccessMessage(
    action: EmployeeLeaveAction | ApproverLeaveAction,
): string {
    const messages: Record<EmployeeLeaveAction | ApproverLeaveAction, string> = {
        CANCEL: "ยกเลิกคำขอลาเรียบร้อยแล้ว",
        REQUEST_CANCELLATION: "ส่งคำขอยกเลิกวันลาแล้ว",
        REQUEST_NOT_TAKEN: "ส่งคำขอแจ้งไม่ได้ใช้วันลาแล้ว",
        APPROVE: "อนุมัติคำขอลาเรียบร้อยแล้ว",
        REJECT: "ไม่อนุมัติคำขอลาเรียบร้อยแล้ว",
        CONFIRM_NOT_TAKEN: "ยืนยันและคืนโควต้าเรียบร้อยแล้ว",
        CONFIRM_CANCELLATION: "ยืนยันยกเลิกและคืนโควต้าเรียบร้อยแล้ว",
        REJECT_CANCELLATION: "ปิดคำขอยกเลิกแล้ว วันลาเดิมยังคงอนุมัติ",
    };
    return messages[action];
}
