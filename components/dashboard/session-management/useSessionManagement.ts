"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { apiGet, apiPost } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { ConfirmAction, SessionItem, SessionsResponse } from "./types";

async function fetchSessions(): Promise<SessionsResponse> {
    const result = await apiGet<SessionsResponse>(API_ROUTES.auth.sessions);
    if (!result.success) {
        throw new Error(result.error);
    }

    return result.data;
}

interface UseSessionManagementArgs {
    onSignOutCurrent: () => void;
}

interface UseSessionManagementResult {
    sessions: SessionItem[];
    currentSession: SessionItem | null;
    otherSessions: SessionItem[];
    error: Error | undefined;
    isLoading: boolean;
    isValidating: boolean;
    revokingId: string | null;
    isRevokingOthers: boolean;
    confirmAction: ConfirmAction | null;
    setConfirmAction: (action: ConfirmAction | null) => void;
    refresh: () => Promise<SessionsResponse | undefined>;
    handleConfirmAction: () => Promise<void>;
}

export function useSessionManagement({
    onSignOutCurrent,
}: UseSessionManagementArgs): UseSessionManagementResult {
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [isRevokingOthers, setIsRevokingOthers] = useState(false);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

    const { data, error, isLoading, isValidating, mutate } = useSWR<SessionsResponse>(
        API_ROUTES.auth.sessions,
        fetchSessions,
    );

    const sessions = data?.sessions ?? [];
    const currentSession = sessions.find((session) => session.isCurrent) ?? null;
    const otherSessions = sessions.filter((session) => !session.isCurrent);

    const handleRevokeSession = async (sessionId: string): Promise<void> => {
        setRevokingId(sessionId);
        try {
            const result = await apiPost<{ success: true }>(
                API_ROUTES.auth.revokeSession,
                { sessionId },
            );
            if (!result.success) {
                throw new Error(result.error);
            }

            toast.success("ยกเลิกเซสชันเรียบร้อย");
            await mutate();
        } catch (revokeError) {
            const message =
                revokeError instanceof Error
                    ? revokeError.message
                    : "ไม่สามารถยกเลิกเซสชันได้";
            toast.error(message);
        } finally {
            setRevokingId(null);
        }
    };

    const handleRevokeOtherSessions = async (): Promise<void> => {
        if (otherSessions.length === 0) {
            toast.info("ไม่มีเซสชันอื่นที่กำลังใช้งาน");
            return;
        }

        setIsRevokingOthers(true);
        try {
            const revokeResults = await Promise.all(
                otherSessions.map((session) =>
                    apiPost<{ success: true }>(
                        API_ROUTES.auth.revokeSession,
                        { sessionId: session.id },
                    ),
                ),
            );

            const failedCount = revokeResults.filter((result) => !result.success).length;
            if (failedCount > 0) {
                toast.error(`ยกเลิกเซสชันล้มเหลว ${failedCount} รายการ`);
            } else {
                toast.success("ออกจากระบบอุปกรณ์อื่นทั้งหมดแล้ว");
            }

            await mutate();
        } catch {
            toast.error("ไม่สามารถออกจากระบบอุปกรณ์อื่นได้");
        } finally {
            setIsRevokingOthers(false);
        }
    };

    const handleConfirmAction = async (): Promise<void> => {
        if (!confirmAction) {
            return;
        }

        if (confirmAction.type === "revoke-session") {
            setConfirmAction(null);
            await handleRevokeSession(confirmAction.sessionId);
            return;
        }

        if (confirmAction.type === "signout-current") {
            setConfirmAction(null);
            onSignOutCurrent();
            return;
        }

        setConfirmAction(null);
        await handleRevokeOtherSessions();
    };

    return {
        sessions,
        currentSession,
        otherSessions,
        error,
        isLoading,
        isValidating,
        revokingId,
        isRevokingOthers,
        confirmAction,
        setConfirmAction,
        refresh: mutate,
        handleConfirmAction,
    };
}
