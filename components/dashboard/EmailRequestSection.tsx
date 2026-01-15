import { EmailRequestForm, EmailRequestHistory } from "@/components/email";

interface EmailRequestSectionProps {
    onCancel: () => void;
    onSuccess: () => void;
}

export function EmailRequestSection({
    onCancel,
    onSuccess,
}: EmailRequestSectionProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">
                    ขออีเมลพนักงานใหม่
                </h2>
                <p className="text-gray-600">
                    ส่งคำขออีเมลสำหรับพนักงานใหม่ให้ทีมไอที
                </p>
            </div>
            <div className="space-y-6">
                <EmailRequestForm onCancel={onCancel} onSuccess={onSuccess} />
            </div>

            {/* Email Request History */}
            <EmailRequestHistory />
        </div>
    );
}
