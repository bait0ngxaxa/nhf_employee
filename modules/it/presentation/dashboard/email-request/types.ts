import type { ChangeEvent, FormEvent } from "react";
import type {
    EmailRequest,
    EmailRequestFormData,
    Pagination,
} from "../../../domain/email-request/contracts";

export type { EmailRequest, EmailRequestFormData, Pagination };

export interface EmailRequestContextValue {
    // List data
    emailRequests: EmailRequest[];
    pagination: Pagination;
    isListLoading: boolean;
    listError: string | null;
    currentPage: number;
    setCurrentPage: (page: number) => void;
    refreshList: () => void;

    // Form data
    formData: EmailRequestFormData;
    isFormLoading: boolean;
    formError: string | null;
    fieldErrors: Partial<Record<keyof EmailRequestFormData, string>>;
    handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: FormEvent) => Promise<boolean>;
}
