import {
    createLeaveActionInAppNotification,
    sendLeaveActionNotifications,
} from "@/modules/leave/application/notifications/notifications";
import { type LeaveActionPayload } from "@/modules/leave/application/notifications/notification-payloads";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { lockLeaveRequestRow } from "@/modules/leave/infrastructure/persistence/transaction";
import { resolveCurrentLeaveAction } from "@/modules/leave/application/approvals/current-action-validation";
import { enqueueLeaveLineNotification } from "@/modules/leave/infrastructure/notifications/line";

export { resolveCurrentLeaveAction } from "@/modules/leave/application/approvals/current-action-validation";

export async function dispatchCurrentLeaveAction(
    notificationId: number,
    payload: LeaveActionPayload,
): Promise<"SENT" | "SUPERSEDED"> {
    const currentPayload = await runSerializableTransaction(async (tx) => {
        const claimed = await tx.notificationOutbox.findFirst({
            where: { id: notificationId, status: "PROCESSING" },
            select: { id: true },
        });
        if (!claimed) return null;

        await lockLeaveRequestRow(tx, payload.leaveId);
        const resolved = await resolveCurrentLeaveAction(tx, payload);
        if (resolved) {
            await createLeaveActionInAppNotification(tx, resolved);
            await enqueueLeaveLineNotification(
                { type: "LEAVE_ACTION_LINE", payload: resolved },
                tx,
            );
            return resolved;
        }

        await tx.notificationOutbox.updateMany({
            where: { id: notificationId, status: "PROCESSING" },
            data: {
                status: "SUPERSEDED",
                lastError: "Superseded by stale leave-action delivery",
            },
        });
        return null;
    });

    if (!currentPayload) return "SUPERSEDED";

    await sendLeaveActionNotifications(currentPayload, { createInApp: false });
    return "SENT";
}
