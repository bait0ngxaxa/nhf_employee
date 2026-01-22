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
            !item.requiredRole || (item.requiredRole === "ADMIN" && isAdmin),
    );
}

export const getMenuTheme = (menuId: string) => {
    switch (menuId) {
        case "dashboard":
            return {
                gradient: "from-blue-500 to-cyan-500",
                lightBg: "bg-blue-50",
                text: "text-blue-600",
                border: "border-blue-600",
                hover: "hover:bg-blue-50",
                activeBg: "bg-blue-50/80",
                glow: "from-blue-400 via-cyan-400 to-teal-400",
            };
        case "it-support":
            return {
                gradient: "from-emerald-500 to-green-500",
                lightBg: "bg-emerald-50",
                text: "text-emerald-600",
                border: "border-emerald-600",
                hover: "hover:bg-emerald-50",
                activeBg: "bg-emerald-50/80",
                glow: "from-emerald-400 via-green-400 to-lime-400",
            };
        case "employee-management":
            return {
                gradient: "from-purple-500 to-violet-500",
                lightBg: "bg-purple-50",
                text: "text-purple-600",
                border: "border-purple-600",
                hover: "hover:bg-purple-50",
                activeBg: "bg-purple-50/80",
                glow: "from-purple-400 via-violet-400 to-fuchsia-400",
            };
        case "email-request":
            return {
                gradient: "from-orange-500 to-amber-500",
                lightBg: "bg-orange-50",
                text: "text-orange-600",
                border: "border-orange-600",
                hover: "hover:bg-orange-50",
                activeBg: "bg-orange-50/80",
                glow: "from-orange-400 via-amber-400 to-yellow-400",
            };
        case "it-equipment":
            return {
                gradient: "from-pink-500 to-rose-500",
                lightBg: "bg-pink-50",
                text: "text-pink-600",
                border: "border-pink-600",
                hover: "hover:bg-pink-50",
                activeBg: "bg-pink-50/80",
                glow: "from-pink-400 via-rose-400 to-red-400",
            };
        default:
            return {
                gradient: "from-gray-500 to-slate-500",
                lightBg: "bg-gray-50",
                text: "text-gray-600",
                border: "border-gray-600",
                hover: "hover:bg-gray-50",
                activeBg: "bg-gray-50/80",
                glow: "from-gray-400 via-slate-400 to-zinc-400",
            };
    }
};
