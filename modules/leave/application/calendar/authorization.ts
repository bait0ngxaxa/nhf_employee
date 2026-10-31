import type { Prisma } from "@prisma/client";
import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";
import { HolidayCalendarError } from "../../domain/holiday-calendar";

/** Only a server-session adapter may construct this context. LIFF has no calendar control plane. */
export interface CalendarAdminContext {
    userId: number;
    channel: "DASHBOARD";
}

export async function assertCalendarAdmin(
    tx: Prisma.TransactionClient,
    context: CalendarAdminContext,
): Promise<{ id: number; email: string }> {
    if (context.channel !== "DASHBOARD") throw new HolidayCalendarError("ไม่มีสิทธิ์จัดการปฏิทิน", 403);
    const hint = await tx.user.findUnique({ where: { id: context.userId }, select: { employeeId: true } });
    await lockEmployeeRows(tx, !hint || hint.employeeId === null ? [] : [hint.employeeId]);
    await lockUserRows(tx, [context.userId]);
    const user = await tx.user.findFirst({
        where: {
            id: context.userId, role: "ADMIN", isActive: true, deletedAt: null,
            employeeId: hint?.employeeId ?? null,
            employee: { is: { status: "ACTIVE", deletedAt: null } },
        },
        select: { id: true, email: true },
    });
    if (!user) throw new HolidayCalendarError("ต้องเป็นผู้ดูแลระบบที่มีบัญชีและสถานะพนักงานพร้อมใช้งาน", 403);
    return user;
}
