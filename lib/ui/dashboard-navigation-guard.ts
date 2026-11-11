/** Presentation guard only. Forms retain ownership of mutation and retry state. */
export function allowDashboardNavigation(): boolean {
    if (typeof document === "undefined") return true;
    if (document.querySelector('[data-navigation-submitting="true"]')) {
        window.alert("กำลังบันทึกข้อมูล กรุณารอให้ดำเนินการเสร็จก่อนเปลี่ยนหน้า");
        return false;
    }
    const unresolved = document.querySelector('[data-navigation-unresolved="true"]');
    if (unresolved) {
        window.alert(unresolved.getAttribute("data-navigation-recovery")
            || "ยังยืนยันผลการบันทึกไม่ได้ กรุณาตรวจสอบผลหรือลองส่งรายการเดิมอีกครั้งก่อนเปลี่ยนหน้า");
        return false;
    }
    return !document.querySelector('[data-navigation-dirty="true"]')
        || window.confirm("มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?");
}
