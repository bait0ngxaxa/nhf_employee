import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";
import { HolidayCalendarError } from "../../domain/holiday-calendar";

/** Only a server-session adapter may construct this context. LIFF has no calendar control plane. */
export interface CalendarAdminContext {
    userId: number;
    channel: "DASHBOARD";
}

/** A lock-order hint only; authorization is always revalidated under transaction locks. */
export async function getCalendarAdminEmployeeIdHint(context: CalendarAdminContext): Promise<number | null> {
    if (context.channel !== "DASHBOARD") throw new HolidayCalendarError("ไม่มีสิทธิ์จัดการปฏิทิน", 403);
    // Outside Serializable: a hint SELECT inside it holds User S before Employee X,
    // creating a User/Employee lock-upgrade cycle between overlapping ADMIN reads.
    const hint = await prisma.user.findUnique({ where: { id: context.userId }, select: { employeeId: true } });
    return hint?.employeeId ?? null;
}

export async function assertCalendarAdmin(
    tx: Prisma.TransactionClient,
    context: CalendarAdminContext,
    employeeIdHint: number | null,
): Promise<{ id: number; email: string }> {
    if (context.channel !== "DASHBOARD") throw new HolidayCalendarError("ไม่มีสิทธิ์จัดการปฏิทิน", 403);
    await lockEmployeeRows(tx, employeeIdHint === null ? [] : [employeeIdHint]);
    await lockUserRows(tx, [context.userId]);
    const user = await tx.user.findFirst({
        where: {
            id: context.userId, role: "ADMIN", isActive: true, deletedAt: null,
            employeeId: employeeIdHint,
            employee: { is: { status: "ACTIVE", deletedAt: null } },
        },
        select: { id: true, email: true },
    });
    if (!user) throw new HolidayCalendarError("ต้องเป็นผู้ดูแลระบบที่มีบัญชีและสถานะพนักงานพร้อมใช้งาน", 403);
    return user;
}
