import {
    Computer,
    AlertTriangle,
    Mail,
    Users,
    UserPlus,
    Upload,
    FileText,
} from "lucide-react";
import { type MenuItem } from "@/types/dashboard";

export const DASHBOARD_MENU_ITEMS: MenuItem[] = [
    {
        id: "it-equipment",
        label: "IT-Equipments",
        icon: Computer,
        description: "จัดการครุภัณฑ์ไอทีขององค์กร",
    },
    {
        id: "it-support",
        label: "IT Support",
        icon: AlertTriangle,
        description: "แจ้งปัญหาไอทีและติดตามสถานะ",
    },
    {
        id: "email-request",
        label: "ขออีเมลพนักงานใหม่",
        icon: Mail,
        description: "ขออีเมลสำหรับพนักงานใหม่จากทีมไอที",
        requiredRole: "ADMIN",
    },
    {
        id: "employee-management",
        label: "ข้อมูลพนักงาน",
        icon: Users,
        description: "จัดการข้อมูลพนักงานและสิทธิ์",
        requiredRole: "ADMIN",
    },
    {
        id: "add-employee",
        label: "เพิ่มพนักงาน",
        icon: UserPlus,
        description: "เพิ่มข้อมูลพนักงานใหม่",
        requiredRole: "ADMIN",
    },
    {
        id: "import-employee",
        label: "นำเข้าจาก CSV",
        icon: Upload,
        description: "นำเข้าข้อมูลพนักงานจากไฟล์ CSV",
        requiredRole: "ADMIN",
    },
    {
        id: "audit-logs",
        label: "บันทึกการใช้งาน",
        icon: FileText,
        description: "ดูประวัติการใช้งานระบบ",
        requiredRole: "ADMIN",
    },
];

export function getAvailableMenuItems(isAdmin: boolean): MenuItem[] {
    return DASHBOARD_MENU_ITEMS.filter(
        (item) =>
            !item.requiredRole || (item.requiredRole === "ADMIN" && isAdmin)
    );
}
