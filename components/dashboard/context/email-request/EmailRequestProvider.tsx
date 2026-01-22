"use client";

import { useState, useCallback, useMemo, type ReactNode } from "react";
import useSWR from "swr";
import { EmailRequestContext } from "./EmailRequestContext";
import {
    type EmailRequest,
    type EmailRequestFormData,
    type Pagination,
    type EmailRequestContextValue,
} from "./types";

const initialFormData: EmailRequestFormData = {
    thaiName: "",
    englishName: "",
    phone: "",
    nickname: "",
    position: "",
    department: "",
    replyEmail: "",
};

interface EmailRequestProviderProps {
    children: ReactNode;
}

const defaultPagination: Pagination = {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
};

export function EmailRequestProvider({ children }: EmailRequestProviderProps) {
    // List state
    const [currentPage, setCurrentPage] = useState(1);

    // Form state
    const [formData, setFormData] =
        useState<EmailRequestFormData>(initialFormData);
    const [isFormLoading, setIsFormLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // SWR for List
    const {
        data,
        mutate,
        isLoading,
        error: swrError,
    } = useSWR<{
        success: boolean;
        emailRequests: EmailRequest[];
        pagination: Pagination;
        error?: string;
    }>(`/api/email-request?page=${currentPage}&limit=10`);

    const { emailRequests, pagination, listError } = useMemo(() => {
        return {
            emailRequests: data?.success ? data.emailRequests : [],
            pagination: data?.success ? data.pagination : defaultPagination,
            listError:
                swrError || (data?.success === false ? data?.error : null),
        };
    }, [data, swrError]);

    const refreshList = useCallback(() => {
        mutate();
    }, [mutate]);

    // Form handlers
    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, value } = e.target;
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        },
        [],
    );

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            setIsFormLoading(true);
            setFormError(null);

            try {
                const response = await fetch("/api/email-request", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(formData),
                });

                const result = await response.json();

                if (result.success) {
                    setFormData(initialFormData);
                    setShowSuccessModal(true);
                    mutate(); // Refresh the list
                } else {
                    setFormError(result.error || "เกิดข้อผิดพลาด");
                }
            } catch (err) {
                console.error("Error submitting email request:", err);
                setFormError(
                    "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง",
                );
            } finally {
                setIsFormLoading(false);
            }
        },
        [formData, mutate],
    );

    const closeSuccessModal = useCallback(() => {
        setShowSuccessModal(false);
    }, []);

    const value = useMemo<EmailRequestContextValue>(
        () => ({
            emailRequests,
            pagination,
            isListLoading: isLoading,
            listError: listError as string | null,
            currentPage,
            setCurrentPage,
            refreshList,
            formData,
            isFormLoading,
            formError,
            showSuccessModal,
            handleInputChange,
            handleSubmit,
            closeSuccessModal,
        }),
        [
            emailRequests,
            pagination,
            isLoading,
            listError,
            currentPage,
            setCurrentPage,
            refreshList,
            formData,
            isFormLoading,
            formError,
            showSuccessModal,
            handleInputChange,
            handleSubmit,
            closeSuccessModal,
        ],
    );

    return (
        <EmailRequestContext.Provider value={value}>
            {children}
        </EmailRequestContext.Provider>
    );
}
