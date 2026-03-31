import {
    Boxes,
    AlertTriangle,
    Mail,
    Users,
    UserPlus,
    Upload,
    CalendarRange,
    FileText,
    AppWindow,
    ShieldCheck,
} from "lucide-react";
import { type MenuItem, type MenuGroup } from "@/types/dashboard";

/** Flat lookup used by handleMenuClick for role validation */
export const DASHBOARD_MENU_ITEMS: MenuItem[] = [
    {
        id: "leave-management",
        label: "NHF Leave",
        icon: CalendarRange,
        description: "ยื่นใบลาและตรวจสอบโควต้าวันลา",
    },
    {
        id: "stock",
        label: "NHF Stock",
        icon: Boxes,
        description: "เบิกวัสดุจากคลัง",
    },
    {
        id: "it-support",
        label: "NHF IT-Support",
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
        description: "ดูข้อมูลพนักงานในองค์กร",
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

export const DASHBOARD_MENU_GROUPS: MenuGroup[] = [
    {
        id: "employee-apps",
        label: "แอปพลิเคชัน",
        icon: AppWindow,
        items: [
            DASHBOARD_MENU_ITEMS[0], // ระบบลางาน
            DASHBOARD_MENU_ITEMS[1], // ระบบคลังวัสดุ
            DASHBOARD_MENU_ITEMS[2], // IT Support
        ],
    },
    {
        id: "management",
        label: "การจัดการระบบ",
        icon: ShieldCheck,
        items: [
            DASHBOARD_MENU_ITEMS[3], // ขออีเมล (ADMIN)
            DASHBOARD_MENU_ITEMS[4], // ข้อมูลพนักงาน
            DASHBOARD_MENU_ITEMS[5], // เพิ่มพนักงาน (ADMIN)
            DASHBOARD_MENU_ITEMS[6], // นำเข้า CSV (ADMIN)
            DASHBOARD_MENU_ITEMS[7], // บันทึกการใช้งาน (ADMIN)
        ],
    },
];

/** Filter groups by role — removes ADMIN-only items for non-admins, drops empty groups */
export function getAvailableMenuGroups(isAdmin: boolean): MenuGroup[] {
    return DASHBOARD_MENU_GROUPS.map((group) => {
        const filteredItems = group.items.filter(
            (item) =>
                !item.requiredRole ||
                (item.requiredRole === "ADMIN" && isAdmin),
        );
        if (filteredItems.length === 0) return null;
        return { ...group, items: filteredItems };
    }).filter((g): g is MenuGroup => g !== null);
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
                gradient: "from-sky-600 to-blue-700",
                lightBg: "bg-sky-50",
                text: "text-sky-700",
                border: "border-sky-700",
                hover: "hover:bg-sky-50",
                activeBg: "bg-sky-50/80",
                glow: "from-sky-400 via-blue-400 to-cyan-400",
            };
        case "email-request":
            return {
                gradient: "from-indigo-600 to-violet-700",
                lightBg: "bg-indigo-50",
                text: "text-indigo-700",
                border: "border-indigo-700",
                hover: "hover:bg-indigo-50",
                activeBg: "bg-indigo-50/80",
                glow: "from-indigo-400 via-violet-400 to-purple-400",
            };
        case "stock":
            return {
                gradient: "from-orange-500 to-red-600",
                lightBg: "bg-orange-50",
                text: "text-orange-600",
                border: "border-orange-600",
                hover: "hover:bg-orange-50",
                activeBg: "bg-orange-50/80",
                glow: "from-orange-400 via-red-400 to-amber-400",
            };
        case "leave-management":
            return {
                gradient: "from-indigo-500 to-sky-500",
                lightBg: "bg-indigo-50",
                text: "text-indigo-600",
                border: "border-indigo-600",
                hover: "hover:bg-indigo-50",
                activeBg: "bg-indigo-50/80",
                glow: "from-indigo-400 via-sky-400 to-cyan-400",
            };
        case "add-employee":
            return {
                gradient: "from-pink-500 to-rose-600",
                lightBg: "bg-pink-50",
                text: "text-pink-600",
                border: "border-pink-600",
                hover: "hover:bg-pink-50",
                activeBg: "bg-pink-50/80",
                glow: "from-pink-400 via-rose-400 to-red-400",
            };
        case "import-employee":
            return {
                gradient: "from-teal-500 to-cyan-600",
                lightBg: "bg-teal-50",
                text: "text-teal-600",
                border: "border-teal-600",
                hover: "hover:bg-teal-50",
                activeBg: "bg-teal-50/80",
                glow: "from-teal-400 via-cyan-400 to-sky-400",
            };
        case "audit-logs":
            return {
                gradient: "from-yellow-500 to-amber-600",
                lightBg: "bg-yellow-50",
                text: "text-amber-600",
                border: "border-amber-600",
                hover: "hover:bg-yellow-50",
                activeBg: "bg-yellow-50/80",
                glow: "from-yellow-400 via-amber-400 to-orange-400",
            };
        case "sessions":
            return {
                gradient: "from-cyan-600 to-teal-700",
                lightBg: "bg-cyan-50",
                text: "text-cyan-700",
                border: "border-cyan-700",
                hover: "hover:bg-cyan-50",
                activeBg: "bg-cyan-50/80",
                glow: "from-cyan-400 via-teal-400 to-emerald-400",
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
