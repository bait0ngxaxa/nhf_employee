import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { lineRetryKeySchema } from "@/lib/validations/line";
import type { LineFlexMessage } from "@/types/api";
import { sendLineAppMessage } from "./messaging";

const appLineRecipientSelect = {
    isActive: true,
    deletedAt: true,
    employeeId: true,
    employee: {
        select: {
            status: true,
            deletedAt: true,
        },
    },
    lineAccountLink: {
        select: {
            lineUserId: true,
        },
    },
} as const satisfies Prisma.UserSelect;

type AppLineNotificationClient = Pick<Prisma.TransactionClient, "user">;

export type AppLineNotificationResult =
    | { status: "SENT" }
    | { status: "SKIPPED"; reason: "UNLINKED" | "INELIGIBLE" };

export type SendAppLineNotificationInput = {
    userId: number;
    message: LineFlexMessage;
    retryKey: string;
};

function isEligibleUser(recipient: {
    isActive: boolean;
    deletedAt: Date | null;
    employeeId: number | null;
    employee: { status: string; deletedAt: Date | null } | null;
}): boolean {
    if (!recipient.isActive || recipient.deletedAt !== null) {
        return false;
    }

    if (recipient.employeeId !== null && recipient.employee === null) {
        return false;
    }

    return recipient.employee === null
        || (
            recipient.employee.status === "ACTIVE"
            && recipient.employee.deletedAt === null
        );
}

function getLineUserId(
    recipient: {
        lineAccountLink: { lineUserId: string } | null;
    },
): string | null {
    const lineUserId = recipient.lineAccountLink?.lineUserId.trim();
    return lineUserId || null;
}

export async function sendAppLineNotification(
    input: SendAppLineNotificationInput,
    client: AppLineNotificationClient = prisma,
): Promise<AppLineNotificationResult> {
    if (!Number.isInteger(input.userId) || input.userId <= 0) {
        throw new Error("Invalid application user for LINE notification");
    }
    lineRetryKeySchema.parse(input.retryKey);

    const recipient = await client.user.findUnique({
        where: { id: input.userId },
        select: appLineRecipientSelect,
    });
    if (!recipient || !isEligibleUser(recipient)) {
        return { status: "SKIPPED", reason: "INELIGIBLE" };
    }

    const lineUserId = getLineUserId(recipient);
    if (!lineUserId) {
        return { status: "SKIPPED", reason: "UNLINKED" };
    }

    const sent = await sendLineAppMessage(
        lineUserId,
        input.message,
        input.retryKey,
    );
    if (!sent) {
        throw new Error("NHFapp LINE notification failed");
    }

    return { status: "SENT" };
}

