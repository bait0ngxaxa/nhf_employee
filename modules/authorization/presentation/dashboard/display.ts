import { AuthorizationAdministrationApiError } from "./api";
import type {
    AuthorizationAdministrationGrantProjectionData,
    AuthorizationAdministrationOverviewData,
    ClientDate,
} from "./types";

export function getAuthorizationChannelLabel(
    channel: "DASHBOARD" | "LIFF_SELF_SERVICE" | "SYSTEM",
): string {
    switch (channel) {
        case "DASHBOARD":
            return "DASHBOARD";
        case "LIFF_SELF_SERVICE":
            return "LIFF_SELF_SERVICE";
        case "SYSTEM":
            return "SYSTEM";
    }
}

export function getEffectiveAccessStateLabel(
    state: "AVAILABLE" | "UNAVAILABLE" | "UNSUPPORTED" | "DEFERRED",
): string {
    switch (state) {
        case "AVAILABLE":
            return "AVAILABLE · มี authority";
        case "UNAVAILABLE":
            return "UNAVAILABLE · ไม่มี authority";
        case "UNSUPPORTED":
            return "UNSUPPORTED · ไม่รองรับ context นี้";
        case "DEFERRED":
            return "DEFERRED · ยังไม่ migrate";
    }
}

export const authorizationTabLabels = {
    overview: "ภาพรวมและ Teams",
    users: "ผู้ใช้และสิทธิ์",
    capabilities: "Capability Registry",
} as const;

export const teamDetailTabLabels = {
    details: "รายละเอียด",
    members: "สมาชิก",
    roles: "TeamRoles",
    teamGrants: "Team Permissions",
    roleGrants: "TeamRole Permissions",
} as const;

export function formatAuthorizationDate(value: ClientDate): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "ไม่ทราบวันที่";
    return date.toLocaleString("th-TH");
}

export function getReadinessLabel(
    status: AuthorizationAdministrationOverviewData["capabilities"][number]["administrativeStatus"],
): string {
    switch (status) {
        case "GRANTABLE":
            return "พร้อมกำหนดสิทธิ์";
        case "POLICY_ACTIVATION_REQUIRED":
            return "ต้องเปิดใช้งาน Policy ก่อน";
        case "DEFERRED":
            return "เลื่อนการรองรับไว้ก่อน";
    }
}

export function getRuntimeModeLabel(
    mode: AuthorizationAdministrationOverviewData["capabilities"][number]["runtimeAuthorizationMode"],
): string {
    switch (mode) {
        case "CENTRAL_ONLY":
            return "Central only";
        case "CENTRAL_WITH_DEFAULT_POLICY":
            return "Central + default policy";
        case "CENTRAL_WITH_COMPATIBILITY":
            return "Central + compatibility";
        case "DEFERRED":
            return "Deferred";
    }
}

export function getGrantStatusLabel(
    grant: AuthorizationAdministrationGrantProjectionData,
): string {
    if (grant.validation.status === "VALID") {
        return grant.capability?.administrativeStatus === "GRANTABLE"
            ? "Valid"
            : grant.capability?.administrativeStatus ?? "ตรวจสอบ readiness";
    }
    return `Invalid: ${grant.validation.code}`;
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
                title: "สมาชิกอยู่ใน Team นี้แล้ว",
                description: "ตรวจสอบรายชื่อสมาชิกปัจจุบันก่อนเพิ่มอีกครั้ง",
            };
        case "DUPLICATE_GRANT":
            return {
                title: "มี grant นี้อยู่แล้ว",
                description: "ข้อมูลอาจเปลี่ยนโดยผู้ดูแลระบบคนอื่น กรุณาโหลดข้อมูลใหม่",
            };
        case "TEAM_ROLE_TEAM_MISMATCH":
            return {
                title: "TeamRole ไม่ได้อยู่ใน Team นี้",
                description: "ระบบไม่อนุญาตให้กำหนดบทบาทข้าม Team",
            };
        case "UNKNOWN_CAPABILITY":
            return {
                title: "ไม่พบ Capability นี้ใน registry",
                description: "โหลด Capability Registry ล่าสุด แล้วตรวจสอบรายการที่เลือกอีกครั้ง",
            };
        case "UNSUPPORTED_SCOPE":
            return {
                title: "Scope นี้ไม่รองรับ",
                description: "Capability ที่เลือกไม่รองรับ Scope นี้ตาม catalog จาก server",
            };
        case "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN":
            return {
                title: "Direct User grant ใช้ Team scope ไม่ได้",
                description: "สิทธิ์เฉพาะผู้ใช้ต้องไม่มี Team origin และควรใช้เฉพาะกรณียกเว้น",
            };
        case "UNSUPPORTED_ADMIN_TEAM_SCOPE":
            return {
                title: "Team scope นี้ยังไม่รองรับ",
                description: "ตรวจสอบ Team origin และ capability catalog จาก server ก่อนดำเนินการต่อ",
            };
        case "CAPABILITY_POLICY_ACTIVATION_REQUIRED":
            return {
                title: "Capability นี้ยังไม่พร้อมให้กำหนด",
                description: "ต้องมีการเปิดใช้งาน Policy อย่างชัดเจนก่อนจึงจะเพิ่มหรือลบ grant ได้",
            };
        case "CAPABILITY_DEFERRED":
            return {
                title: "Capability นี้อยู่ระหว่างการเลื่อนการรองรับ",
                description: "ยังไม่สามารถจัดการ grant ของ Capability นี้ได้",
            };
        case "INVALID_AUTHORIZATION_CONFIGURATION":
            return {
                title: "พบ configuration สิทธิ์ที่ไม่ถูกต้อง",
                description: "ระบบปฏิเสธการเปลี่ยนแปลงเพื่อรักษาความปลอดภัย กรุณาตรวจสอบรายการที่แจ้งไว้",
            };
        case "NO_STATE_CHANGE":
            return {
                title: "ไม่มีการเปลี่ยนแปลง",
                description: "ค่าที่ส่งมาเหมือนกับ configuration ปัจจุบัน",
            };
        case "NOT_FOUND":
            return {
                title: "ไม่พบข้อมูลเป้าหมาย",
                description: "ข้อมูลอาจถูกเปลี่ยนหรือลบโดยผู้ดูแลระบบคนอื่น กรุณาโหลดข้อมูลใหม่",
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
                description: "สิทธิ์ ADMIN ต้องได้รับการตรวจสอบจาก server ทุกครั้ง",
            };
        default:
            return {
                title: "ดำเนินการไม่สำเร็จ",
                description: error instanceof Error
                    ? error.message
                    : "ตรวจสอบการเชื่อมต่อ แล้วลองใหม่อีกครั้ง",
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
            return "ไม่พบ Capability ใน registry ปัจจุบัน";
        case "UNSUPPORTED_PERSISTED_SCOPE":
            return "Scope นี้ไม่รองรับโดย Capability";
        case "DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN":
            return "Direct User grant ไม่มี Team origin ที่ถูกต้อง";
        case "TEAM_GRANT_ORIGIN_MISMATCH":
        case "TEAM_ROLE_GRANT_ORIGIN_MISMATCH":
            return "แหล่งที่มาของ grant ไม่ตรงกับ entity";
        case "TEAM_ROLE_MEMBERSHIP_MISMATCH":
            return "ความสัมพันธ์ TeamRole ไม่ถูกต้อง";
        default:
            return code;
    }
}
