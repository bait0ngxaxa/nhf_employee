import ITIssuesPage from "@/app/it-issues/page";

export function ITSupportSection() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">
                    แจ้งปัญหาไอที
                </h2>
                <p className="text-gray-600">แจ้งปัญหาและขอรับการซ่อมแซม</p>
            </div>
            <ITIssuesPage />
        </div>
    );
}
