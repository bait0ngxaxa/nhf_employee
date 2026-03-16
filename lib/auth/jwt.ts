import { SignJWT, jwtVerify } from "jose";

const getSecretKey = () => {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
        throw new Error("NEXTAUTH_SECRET environment variable is required");
    }
    return new TextEncoder().encode(secret);
};

export type LeaveAction = "approve" | "reject";

export interface LeaveTokenPayload {
    leaveId: string;
    approverId: number;
    action: LeaveAction;
}

/**
 * สร้าง JWT Token ใหม่อายุ 7 วัน สำหรับรับรองการอนุมัติลางาน
 */
export async function signLeaveToken(payload: LeaveTokenPayload): Promise<string> {
    const token = await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d") // มีอายุ 7 วัน
        .sign(getSecretKey());

    return token;
}

/**
 * ถอดรหัสและตรวจสอบ JWT Token 
 * คืนค่า Payload หาก Token ถูกต้องและยังไม่หมดอายุ
 */
export async function verifyLeaveToken(token: string): Promise<LeaveTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getSecretKey());
        return payload as unknown as LeaveTokenPayload;
    } catch (error) {
        console.error("❌ [JWT] Token verification failed:", error);
        return null;
    }
}
