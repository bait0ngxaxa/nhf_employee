interface LeaveStatusBadgeProps {
    status: string;
}

export function LeaveStatusBadge({ status }: LeaveStatusBadgeProps) {
    switch (status) {
        case "APPROVED":
            return (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    อนุมัติแล้ว
                </span>
            );
        case "REJECTED":
            return (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    ไม่อนุมัติ
                </span>
            );
        case "CANCELLED":
            return (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    ยกเลิก
                </span>
            );
        default:
            return (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    รอดำเนินการ
                </span>
            );
    }
}
