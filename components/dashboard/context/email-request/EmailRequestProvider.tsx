"use client";

import {
    useState,
    useCallback,
    useMemo,
    type ChangeEvent,
    type FormEvent,
    type ReactNode,
} from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { isSharedDriveOption } from "@/constants/email-request";
import { apiPost } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { emailRequestSchema } from "@/lib/validations/email-request";
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
    needsDocumentSystem: false,
    sharedDriveAccess: [],
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

function getSubmitErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง";
}

function getValidationErrors(
    formData: EmailRequestFormData,
): {
    data: EmailRequestFormData | null;
    errors: Partial<Record<keyof EmailRequestFormData, string>>;
    firstErrorField: keyof EmailRequestFormData | null;
} {
    const validation = emailRequestSchema.safeParse(formData);
    if (validation.success) {
        return { data: validation.data, errors: {}, firstErrorField: null };
    }

    const errors: Partial<Record<keyof EmailRequestFormData, string>> = {};
    let firstErrorField: keyof EmailRequestFormData | null = null;

    validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof EmailRequestFormData;
        errors[field] ??= issue.message;
        firstErrorField ??= field;
    });

    return { data: null, errors, firstErrorField };
}

function getScrollBehavior(): ScrollBehavior {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return "auto";
    }

    return "smooth";
}

function focusInvalidField(field: keyof EmailRequestFormData): void {
    const element = document.getElementById(field);
    if (!(element instanceof HTMLElement)) {
        return;
    }

    element.scrollIntoView({
        behavior: getScrollBehavior(),
        block: "center",
    });
    element.focus({ preventScroll: true });
}

export function EmailRequestProvider({ children }: EmailRequestProviderProps) {
    // List state
    const [currentPage, setCurrentPage] = useState(1);

    // Form state
    const [formData, setFormData] =
        useState<EmailRequestFormData>(initialFormData);
    const [isFormLoading, setIsFormLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<
        Partial<Record<keyof EmailRequestFormData, string>>
    >({});

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
    }>(`${API_ROUTES.emailRequest.list}?page=${currentPage}&limit=10`);

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
        (e: ChangeEvent<HTMLInputElement>) => {
            const { name, type, checked, value } = e.target;
            const field = name as keyof EmailRequestFormData;
            setFormData((prev) => {
                if (field === "needsDocumentSystem") {
                    return { ...prev, needsDocumentSystem: checked };
                }

                if (field === "sharedDriveAccess") {
                    if (type !== "checkbox" || !isSharedDriveOption(value)) {
                        return prev;
                    }

                    const selected = new Set(prev.sharedDriveAccess);

                    if (checked) {
                        selected.add(value);
                    } else {
                        selected.delete(value);
                    }

                    return {
                        ...prev,
                        sharedDriveAccess: Array.from(selected),
                    };
                }

                return {
                    ...prev,
                    [field]: value,
                };
            });
            setFormError(null);
            setFieldErrors((current) => {
                if (!current[field]) {
                    return current;
                }

                const next = { ...current };
                delete next[field];
                return next;
            });
        },
        [],
    );

    const handleSubmit = useCallback(
        async (e: FormEvent): Promise<boolean> => {
            e.preventDefault();
            if (isFormLoading) {
                return false;
            }

            const validation = getValidationErrors(formData);
            if (!validation.data) {
                setFieldErrors(validation.errors);
                setFormError("กรุณาตรวจสอบข้อมูลที่กรอก");

                if (validation.firstErrorField) {
                    focusInvalidField(validation.firstErrorField);
                }

                return false;
            }

            setIsFormLoading(true);
            setFormError(null);
            setFieldErrors({});

            try {
                const response = await apiPost<{ success: boolean; error?: string }>(
                    API_ROUTES.emailRequest.list,
                    validation.data,
                );

                if (response.success) {
                    setFormData(initialFormData);
                    toast.success("ส่งคำร้องพนักงานใหม่สำเร็จ", {
                        description: "คำร้องถูกส่งไปยังทีมไอทีแล้ว",
                    });
                    mutate(); // Refresh the list
                    return true;
                } else {
                    setFormError(response.error || "เกิดข้อผิดพลาด");
                    return false;
                }
            } catch (err) {
                setFormError(getSubmitErrorMessage(err));
                return false;
            } finally {
                setIsFormLoading(false);
            }
        },
        [formData, isFormLoading, mutate],
    );

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
            fieldErrors,
            handleInputChange,
            handleSubmit,
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
            fieldErrors,
            handleInputChange,
            handleSubmit,
        ],
    );

    return (
        <EmailRequestContext.Provider value={value}>
            {children}
        </EmailRequestContext.Provider>
    );
}
