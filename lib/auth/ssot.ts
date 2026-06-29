import { Prisma } from "@prisma/client";
import type { JWTPayload } from "jose";

interface SessionUserLike {
    id?: string | null;
    role?: string | null;
}

export interface RequiredAccessClaims extends JWTPayload {
    sub: string;
    role: string;
    sid: string;
    ver: number;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

export function isValidSessionUser(user: SessionUserLike | null | undefined): user is {
    id: string;
    role: string;
} {
    if (!user) {
        return false;
    }
    return isNonEmptyString(user.id) && isNonEmptyString(user.role);
}

export function hasRequiredAccessClaims(payload: JWTPayload): payload is RequiredAccessClaims {
    if (!isNonEmptyString(payload.sub)) {
        return false;
    }
    if (!isNonEmptyString(payload.role)) {
        return false;
    }
    if (!isNonEmptyString(payload.sid)) {
        return false;
    }
    if (typeof payload.ver !== "number" || !Number.isInteger(payload.ver) || payload.ver < 0) {
        return false;
    }
    return true;
}

export const authSessionUserSelect = Prisma.validator<Prisma.UserSelect>()({
    id: true,
    role: true,
    isActive: true,
    tokenVersion: true,
});

export const authRefreshUserSelect = Prisma.validator<Prisma.UserSelect>()({
    id: true,
    email: true,
    role: true,
    isActive: true,
    tokenVersion: true,
});

export const authLoginUserSelect = Prisma.validator<Prisma.UserSelect>()({
    ...authRefreshUserSelect,
    name: true,
    password: true,
    deletedAt: true,
});

export const AUTH_ERROR_MESSAGES = {
    forbidden: "Forbidden",
    unauthorized: "Unauthorized",
    internalServerError: "Internal server error",
    invalidCredentialsPayload: "Invalid credentials payload",
    invalidEmailOrPassword: "Invalid email or password",
    invalidRequestPayloadThai: "ข้อมูลไม่ถูกต้อง",
    invalidResetLinkThai: "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง",
    usedResetLinkThai: "ลิงก์รีเซ็ตรหัสผ่านนี้ถูกใช้งานแล้ว",
    expiredResetLinkThai: "ลิงก์รีเซ็ตรหัสผ่านหมดอายุแล้ว กรุณาขอลิงก์ใหม่",
    userNotFoundThai: "ไม่พบผู้ใช้งานในระบบ",
    resetPasswordSuccessThai: "รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่",
} as const;

export const AUTH_SIGNUP_MESSAGES = {
    requiredFieldsThai: "กรุณากรอกข้อมูลให้ครบถ้วน",
    passwordMismatchThai: "รหัสผ่านไม่ตรงกัน",
    passwordMinLengthThai: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
    emailDomainOnlyThai: "กรุณาใช้อีเมลองค์กร (@thainhf.org) เท่านั้น",
    emailAlreadyUsedThai: "อีเมลนี้ถูกใช้งานแล้ว",
    employeeNotFoundThai: "ไม่พบข้อมูลพนักงานที่ตรงกับอีเมลนี้ กรุณาติดต่อผู้ดูแล",
    rateLimitedThai: "ลองใหม่อีกครั้งภายหลัง",
    signupSuccessThai: "สมัครสมาชิกสำเร็จ",
    signupFailedThai: "เกิดข้อผิดพลาดในการสมัครสมาชิก",
} as const;

export const AUTH_FORGOT_PASSWORD_MESSAGES = {
    requestAcceptedThai: "หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล",
    resetSubjectThai: "[NHF IT] รีเซ็ตรหัสผ่าน",
    resetMailTextThai: (name: string, resetUrl: string): string =>
        `สวัสดีคุณ ${name},\n\nกรุณาคลิกลิงก์ด้านล่างเพื่อรีเซ็ตรหัสผ่าน:\n${resetUrl}\n\nลิงก์จะหมดอายุภายใน 1 ชั่วโมง\n\nหากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้`,
    requestFailedThai: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
} as const;
