export function getEmailRequestNotificationContent(accessVersion?: number): { readonly title: string; readonly summary: string } {
    return accessVersion === undefined
        ? { title: "มีคำขออีเมลพนักงานใหม่", summary: "มีคำขออีเมลพนักงานใหม่รอตรวจสอบ" }
        : { title: "มีการอัปเดตสิทธิ์พนักงานใหม่", summary: "มีการระบุหรือแก้ไขสิทธิ์การใช้งานเพิ่มเติม" };
}
