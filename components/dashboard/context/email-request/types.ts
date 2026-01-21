export interface EmailRequest {
    id: number;
    thaiName: string;
    englishName: string;
    phone: string;
    nickname: string;
    position: string;
    department: string;
    replyEmail: string;
    createdAt: string;
    updatedAt: string;
    requestedBy: number;
    user?: {
        id: number;
        name: string;
        email: string;
    };
}

export interface EmailRequestFormData {
    thaiName: string;
    englishName: string;
    phone: string;
    nickname: string;
    position: string;
    department: string;
    replyEmail: string;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

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
    showSuccessModal: boolean;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    closeSuccessModal: () => void;
}
