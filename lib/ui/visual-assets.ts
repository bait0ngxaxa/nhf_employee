import {
    Boxes, CalendarRange, ClipboardCheck, FileText, Headset, KeyRound,
    Mail, Megaphone, Upload, UserPlus, Users, type LucideIcon,
} from "lucide-react";
import type { StaticImageData } from "next/image";
import addEmployee from "@/public/assets/menus/add-employee.svg";
import addEmployeeCompact from "@/public/assets/menus/add-employee-compact.svg";
import announcements from "@/public/assets/menus/announcements.svg";
import announcementsCompact from "@/public/assets/menus/announcements-compact.svg";
import auditLogs from "@/public/assets/menus/audit-logs.svg";
import auditLogsCompact from "@/public/assets/menus/audit-logs-compact.svg";
import authorizationAdministration from "@/public/assets/menus/authorization-administration.svg";
import authorizationAdministrationCompact from "@/public/assets/menus/authorization-administration-compact.svg";
import emailRequest from "@/public/assets/menus/email-request.svg";
import emailRequestCompact from "@/public/assets/menus/email-request-compact.svg";
import employeeManagement from "@/public/assets/menus/employee-management.svg";
import employeeManagementCompact from "@/public/assets/menus/employee-management-compact.svg";
import importEmployee from "@/public/assets/menus/import-employee.svg";
import importEmployeeCompact from "@/public/assets/menus/import-employee-compact.svg";
import itTicket from "@/public/assets/modules/it-ticket.svg";
import itTicketCompact from "@/public/assets/modules/it-ticket-compact.svg";
import leave from "@/public/assets/modules/leave.svg";
import leaveCompact from "@/public/assets/modules/leave-compact.svg";
import routine from "@/public/assets/modules/routine.svg";
import routineCompact from "@/public/assets/modules/routine-compact.svg";
import stock from "@/public/assets/modules/stock.svg";
import stockCompact from "@/public/assets/modules/stock-compact.svg";

type VisualAssetSource = string | StaticImageData;

type VisualAssetDefinition = {
    src: string;
    compactSrc: string;
    fallback: LucideIcon;
};

function assetUrl(source: VisualAssetSource): string {
    return typeof source === "string" ? source : source.src;
}

function defineAsset(
    src: VisualAssetSource,
    compactSrc: VisualAssetSource,
    fallback: LucideIcon,
): VisualAssetDefinition {
    return { src: assetUrl(src), compactSrc: assetUrl(compactSrc), fallback };
}

// Static imports use Next.js's public build assets, including on LINE sessions.
export const VISUAL_ASSETS = {
    leave: defineAsset(leave, leaveCompact, CalendarRange),
    stock: defineAsset(stock, stockCompact, Boxes),
    routine: defineAsset(routine, routineCompact, ClipboardCheck),
    "it-ticket": defineAsset(itTicket, itTicketCompact, Headset),
    "add-employee": defineAsset(addEmployee, addEmployeeCompact, UserPlus),
    "announcements": defineAsset(announcements, announcementsCompact, Megaphone),
    "audit-logs": defineAsset(auditLogs, auditLogsCompact, FileText),
    "authorization-administration": defineAsset(authorizationAdministration, authorizationAdministrationCompact, KeyRound),
    "email-request": defineAsset(emailRequest, emailRequestCompact, Mail),
    "employee-management": defineAsset(employeeManagement, employeeManagementCompact, Users),
    "import-employee": defineAsset(importEmployee, importEmployeeCompact, Upload),
} as const;

export type VisualAssetKey = keyof typeof VISUAL_ASSETS;
