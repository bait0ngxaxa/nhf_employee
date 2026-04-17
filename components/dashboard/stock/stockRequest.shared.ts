export const REQUEST_STATUS_OPTIONS = [
    { value: "all", label: "ทั้งหมด" },
    { value: "PENDING_ISSUE", label: "รอจ่าย" },
    { value: "ISSUED", label: "จ่ายแล้ว" },
    { value: "CANCELLED", label: "ยกเลิก" },
] as const;

export function formatStockRequestDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
    });
}
