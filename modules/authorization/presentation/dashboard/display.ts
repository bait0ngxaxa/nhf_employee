import { AuthorizationAdministrationApiError } from "./api";
import type {
    AuthorizationAdministrationGrantProjectionData,
    AuthorizationAdministrationOverviewData,
} from "./types";
import {
    getAuthorizationChannelPresentation,
    getAuthorizationDomainPresentation,
    getAuthorizationScopePresentation,
} from "./permission-presentation";

export function getAuthorizationChannelLabel(
    channel: "DASHBOARD" | "LIFF_SELF_SERVICE" | "SYSTEM",
): string {
    return getAuthorizationChannelPresentation(channel).label;
}

export function getAuthorizationChannelDescription(
    channel: "DASHBOARD" | "LIFF_SELF_SERVICE" | "SYSTEM",
): string {
    return getAuthorizationChannelPresentation(channel).description;
}

export function getAuthorizationDomainLabel(domain: string): string {
    return getAuthorizationDomainPresentation(domain).label;
}

export function getAuthorizationScopeLabel(
    scope: string,
    capabilityKey?: string,
): string {
    return getAuthorizationScopePresentation(scope, capabilityKey).label;
}

export function getAuthorizationScopeDescription(
    scope: string,
    capabilityKey?: string,
): string {
    return getAuthorizationScopePresentation(scope, capabilityKey).description;
}

export function getEffectiveAccessStateLabel(
    state: "AVAILABLE" | "UNAVAILABLE" | "UNSUPPORTED" | "DEFERRED",
): string {
    switch (state) {
        case "AVAILABLE":
            return "ใช้งานได้";
        case "UNAVAILABLE":
            return "ยังไม่มีสิทธิ์";
        case "UNSUPPORTED":
            return "ช่องทางนี้ไม่รองรับ";
        case "DEFERRED":
            return "ยังไม่เปิดให้จัดการ";
    }
}

export const authorizationTabLabels = {
    teams: "ทีม",
    users: "ผู้ใช้งาน",
} as const;

export const teamDetailTabLabels = {
    details: "รายละเอียด",
    members: "สมาชิก",
    roles: "หน้าที่ในทีม",
    teamGrants: "สิทธิ์ของทีม",
    roleGrants: "สิทธิ์ของหน้าที่ในทีม",
} as const;

export function getReadinessLabel(
    status: AuthorizationAdministrationOverviewData["capabilities"][number]["administrativeStatus"],
): string {
    switch (status) {
        case "GRANTABLE":
            return "พร้อมเพิ่มให้ผู้ใช้ ทีม หรือหน้าที่ในทีม";
        case "POLICY_ACTIVATION_REQUIRED":
            return "ยังไม่พร้อมให้จัดการ";
        case "DEFERRED":
            return "ยังไม่เปิดให้จัดการ";
    }
}

export function getGrantStatusLabel(
    grant: AuthorizationAdministrationGrantProjectionData,
): string {
    if (grant.validation.status === "VALID") {
        return grant.capability?.administrativeStatus === "GRANTABLE"
            ? "ใช้งานได้"
            : grant.capability?.administrativeStatus === "DEFERRED"
                ? "ยังไม่เปิดให้จัดการ"
                : "ต้องตรวจสอบ";
    }
    return "ต้องตรวจสอบข้อมูลสิทธิ์";
}

export function getMutationErrorCopy(error: unknown): {
    readonly title: string;
    readonly description: string;
} {
    const code = error instanceof AuthorizationAdministrationApiError
        ? error.code
        : null;
    switch (code) {
        case "DUPLICATE_MEMBERSHIP":
            return {
                title: "ผู้ใช้อยู่ในทีมนี้แล้ว",
                description: "ตรวจสอบรายชื่อสมาชิกปัจจุบันก่อนเพิ่มอีกครั้ง",
            };
        case "DUPLICATE_GRANT":
            return {
                title: "มีสิทธิ์เพิ่มเติมนี้อยู่แล้ว",
                description: "ข้อมูลอาจเปลี่ยนโดยผู้มีสิทธิ์จัดการสิทธิ์คนอื่น กรุณาโหลดข้อมูลใหม่",
            };
        case "TEAM_ROLE_TEAM_MISMATCH":
            return {
                title: "หน้าที่นี้ไม่อยู่ในทีมที่เลือก",
                description: "ระบบไม่อนุญาตให้กำหนดหน้าที่ข้ามทีม",
            };
        case "UNKNOWN_CAPABILITY":
            return {
                title: "ไม่พบสิทธิ์ในรายการระบบ",
                description: "โหลดข้อมูลล่าสุด แล้วเลือกสิทธิ์ที่มีอยู่ในรายการอีกครั้ง",
            };
        case "UNSUPPORTED_SCOPE":
            return {
                title: "ขอบเขตนี้ใช้กับสิทธิ์ที่เลือกไม่ได้",
                description: "เลือกขอบเขตที่แสดงสำหรับสิทธิ์นี้ แล้วลองอีกครั้ง",
            };
        case "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN":
            return {
                title: "สิทธิ์เฉพาะบุคคลใช้ขอบเขตภายในทีมไม่ได้",
                description: "หากต้องการให้สิทธิ์กับทั้งทีม ให้เพิ่มสิทธิ์ที่ทีมหรือหน้าที่ในทีม",
            };
        case "CAPABILITY_POLICY_ACTIVATION_REQUIRED":
            return {
                title: "สิทธิ์นี้ยังไม่พร้อมให้จัดการ",
                description: "ยังไม่สามารถเพิ่มหรือนำสิทธิ์นี้ออกได้ในขณะนี้",
            };
        case "CAPABILITY_DEFERRED":
            return {
                title: "สิทธิ์นี้ยังไม่เปิดให้จัดการ",
                description: "รายการนี้ยังไม่เปิดให้ดำเนินการ",
            };
        case "INVALID_AUTHORIZATION_CONFIGURATION":
            return {
                title: "พบการตั้งค่าสิทธิ์ที่ต้องตรวจสอบ",
                description: "ระบบไม่บันทึกการเปลี่ยนแปลงเพื่อรักษาความปลอดภัย กรุณาตรวจสอบรายการที่แจ้งไว้",
            };
        case "NO_STATE_CHANGE":
            return {
                title: "ไม่มีการเปลี่ยนแปลง",
                description: "ข้อมูลที่ส่งมาเหมือนกับข้อมูลปัจจุบัน",
            };
        case "LAST_ELIGIBLE_ADMIN":
            return {
                title: "ไม่สามารถยกเลิกการเข้าถึงการจัดการสิทธิ์ของบัญชีสุดท้ายได้",
                description: "ต้องมีบัญชีที่ใช้งานได้และยังเข้าถึงหน้าการจัดการสิทธิ์ได้อย่างน้อยหนึ่งบัญชี",
            };
        case "SELF_DEMOTION":
            return {
                title: "ยังยกเลิกการเข้าถึงของตนเองไม่ได้",
                description: "เพื่อป้องกันการล็อกตัวเองออกจากหน้าการจัดการสิทธิ์ ให้ผู้มีสิทธิ์จัดการสิทธิ์คนอื่นดำเนินการแทน",
            };
        case "TARGET_NOT_ELIGIBLE":
            return {
                title: "บัญชียังไม่พร้อมรับการเข้าถึงการจัดการสิทธิ์",
                description: "บัญชีเป้าหมายต้องใช้งานอยู่ ไม่ถูกลบ และเชื่อมกับข้อมูลพนักงานที่ใช้งานอยู่",
            };
        case "NOT_FOUND":
            return {
                title: "ไม่พบข้อมูลเป้าหมาย",
                description: "ข้อมูลอาจถูกเปลี่ยนหรือลบโดยผู้มีสิทธิ์จัดการสิทธิ์คนอื่น กรุณาโหลดข้อมูลใหม่",
            };
        case "CONFLICT":
            return {
                title: "ข้อมูลชนกับการเปลี่ยนแปลงอื่น",
                description: "กรุณาโหลดข้อมูลล่าสุด แล้วลองดำเนินการอีกครั้ง",
            };
        case "INVALID_INPUT":
        case "INVALID_IDENTIFIER":
            return {
                title: "ข้อมูลที่กรอกไม่ถูกต้อง",
                description: "ตรวจสอบค่าที่กรอก แล้วลองใหม่อีกครั้ง",
            };
        case "FORBIDDEN":
            return {
                title: "ไม่มีสิทธิ์ดำเนินการ",
                description: "ระบบตรวจสอบสิทธิ์การจัดการไม่ผ่าน",
            };
        default:
            return {
                title: "ดำเนินการไม่สำเร็จ",
                description: "ตรวจสอบข้อมูลและการเชื่อมต่อ แล้วลองใหม่อีกครั้ง",
            };
    }
}

export function getRequestId(error: unknown): string | null {
    return error instanceof AuthorizationAdministrationApiError
        ? error.requestId ?? null
        : null;
}

export function getConfigurationIssueLabel(code: string): string {
    switch (code) {
        case "UNKNOWN_PERSISTED_CAPABILITY":
            return "พบสิทธิ์ที่ไม่มีอยู่ในรายการระบบปัจจุบัน";
        case "UNSUPPORTED_PERSISTED_SCOPE":
            return "พบขอบเขตที่ไม่รองรับกับสิทธิ์นี้";
        case "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN":
            return "การกำหนดขอบเขตทีมให้สิทธิ์เฉพาะบุคคลไม่ถูกต้อง";
        case "TEAM_GRANT_ORIGIN_MISMATCH":
        case "TEAM_ROLE_GRANT_ORIGIN_MISMATCH":
            return "แหล่งที่มาของสิทธิ์ไม่ตรงกับรายการ";
        case "TEAM_ROLE_MEMBERSHIP_MISMATCH":
            return "ความสัมพันธ์ระหว่างทีมกับหน้าที่ในทีมไม่ถูกต้อง";
        default:
            return "พบการตั้งค่าสิทธิ์ที่ต้องตรวจสอบ";
    }
}
