import { useState, useCallback } from "react";

interface EmailRequestData {
    thaiName: string;
    englishName: string;
    phone: string;
    nickname: string;
    position: string;
    department: string;
    replyEmail: string;
}

const initialFormData: EmailRequestData = {
    thaiName: "",
    englishName: "",
    phone: "",
    nickname: "",
    position: "",
    department: "",
    replyEmail: "",
};

interface UseEmailRequestFormReturn {
    formData: EmailRequestData;
    isLoading: boolean;
    error: string | null;
    showSuccessModal: boolean;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    closeSuccessModal: () => void;
}

export function useEmailRequestForm(): UseEmailRequestFormReturn {
    const [formData, setFormData] = useState<EmailRequestData>(initialFormData);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, value } = e.target;
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        },
        []
    );

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            setIsLoading(true);
            setError(null);

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
                } else {
                    setError(result.error || "เกิดข้อผิดพลาด");
                }
            } catch (err) {
                console.error("Error submitting email request:", err);
                setError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
            } finally {
                setIsLoading(false);
            }
        },
        [formData]
    );

    const closeSuccessModal = useCallback(() => {
        setShowSuccessModal(false);
    }, []);

    return {
        formData,
        isLoading,
        error,
        showSuccessModal,
        handleInputChange,
        handleSubmit,
        closeSuccessModal,
    };
}
