"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";

interface Comment {
    id: number;
    content: string;
    createdAt: string;
    author: {
        id: number;
        name: string;
        email: string;
        role: string;
        employee?: {
            firstName: string;
            lastName: string;
        };
    };
}

interface TicketDetailData {
    id: number;
    title: string;
    description: string;
    category: string;
    priority: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
    reportedBy: {
        id: number;
        name: string;
        email: string;
        employee?: {
            firstName: string;
            lastName: string;
            dept?: {
                name: string;
            };
        };
    };
    assignedTo?: {
        id: number;
        name: string;
        email: string;
        employee?: {
            firstName: string;
            lastName: string;
        };
    };
    comments: Comment[];
}

interface UseTicketDetailReturn {
    ticket: TicketDetailData | null;
    loading: boolean;
    error: string;
    newComment: string;
    setNewComment: (value: string) => void;
    commentLoading: boolean;
    updateLoading: boolean;
    statusUpdate: string;
    setStatusUpdate: (value: string) => void;
    handleAddComment: () => Promise<void>;
    handleStatusUpdate: () => Promise<void>;
    isAdmin: boolean;
    isOwner: boolean;
    canComment: boolean;
}

export function useTicketDetail(
    ticketId: number,
    onTicketUpdated?: () => void,
): UseTicketDetailReturn {
    const { data: session } = useSession();
    const [newComment, setNewComment] = useState("");
    const [commentLoading, setCommentLoading] = useState(false);
    const [updateLoading, setUpdateLoading] = useState(false);
    const [statusUpdate, setStatusUpdate] = useState("");

    const swrKey = ticketId ? `/api/tickets/${ticketId}` : null;
    const { data, error: swrError, mutate, isLoading } = useSWR(swrKey);

    const ticket = data?.ticket || null;
    const error = swrError ? swrError.message || "เกิดข้อผิดพลาด" : "";

    const handleAddComment = useCallback(async () => {
        if (!newComment.trim()) return;

        try {
            setCommentLoading(true);

            const response = await fetch(`/api/tickets/${ticketId}/comments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ content: newComment }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "เกิดข้อผิดพลาด");
            }

            setNewComment("");
            mutate(); // Refresh data
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "เกิดข้อผิดพลาดในการเพิ่มความคิดเห็น";
            alert(errorMessage);
        } finally {
            setCommentLoading(false);
        }
    }, [ticketId, newComment, mutate]);

    const handleStatusUpdate = useCallback(async () => {
        if (!statusUpdate || statusUpdate === ticket?.status) return;

        try {
            setUpdateLoading(true);

            const response = await fetch(`/api/tickets/${ticketId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status: statusUpdate }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "เกิดข้อผิดพลาด");
            }

            await mutate(); // Refresh data

            if (onTicketUpdated) {
                onTicketUpdated();
            }
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "เกิดข้อผิดพลาดในการอัปเดตสถานะ";
            alert(errorMessage);
        } finally {
            setUpdateLoading(false);
        }
    }, [ticketId, statusUpdate, ticket?.status, onTicketUpdated, mutate]);

    const isAdmin = session?.user?.role === "ADMIN";
    const isOwner =
        ticket && session && ticket.reportedBy.id === parseInt(session.user.id);
    const canComment =
        isAdmin ||
        isOwner ||
        ticket?.assignedTo?.id === parseInt(session?.user?.id || "");

    return {
        ticket,
        loading: isLoading,
        error,
        newComment,
        setNewComment,
        commentLoading,
        updateLoading,
        statusUpdate,
        setStatusUpdate,
        handleAddComment,
        handleStatusUpdate,
        isAdmin,
        isOwner: !!isOwner,
        canComment: !!canComment,
    };
}
