import { Role, type Prisma } from "@prisma/client";
import { z } from "zod";

import {
    type EmployeeDisplayNameSource,
} from "@/modules/employee";
import {
    findLinkedUserIdsByUserIds,
    type LineAccountLinkReadClient,
} from "@/modules/line";
import { getUserDisplayName } from "@/shared/identity/display";

export type RoutineNotificationRecipient = {
    userId: number;
    email: string;
    name: string;
    isAssignee: boolean;
};

export type RoutineNotificationRecipients = {
    activeRecipients: RoutineNotificationRecipient[];
    emailRecipients: RoutineNotificationRecipient[];
};

type RoutineAssigneeUser = {
    id: number;
    name: string;
    email: string;
    isActive: boolean;
    deletedAt: Date | null;
};

type RoutineAssigneeSnapshot = {
    employee: EmployeeDisplayNameSource & {
        status: string;
        deletedAt: Date | null;
        user: RoutineAssigneeUser | null;
    };
};

type RoutineActiveAssigneeSnapshot = {
    employee: {
        status: string;
        deletedAt: Date | null;
        user: {
            id: number;
            isActive: boolean;
            deletedAt: Date | null;
        } | null;
    };
};

const routineNotificationEmailSchema = z.string().trim().email();

export function isActiveRoutineUser(user: {
    isActive: boolean;
    deletedAt: Date | null;
}): boolean {
    return user.isActive && user.deletedAt === null;
}

export function isActiveRoutineEmployee(employee: {
    status: string;
    deletedAt: Date | null;
}): boolean {
    return employee.status === "ACTIVE" && employee.deletedAt === null;
}

export function resolveActiveRoutineAssigneeUserIds(
    assignees: readonly RoutineActiveAssigneeSnapshot[],
): number[] {
    const userIds = new Set<number>();
    assignees.forEach(({ employee }) => {
        if (
            isActiveRoutineEmployee(employee)
            && employee.user
            && isActiveRoutineUser(employee.user)
        ) {
            userIds.add(employee.user.id);
        }
    });
    return [...userIds];
}

export async function resolveRoutineNotificationRecipients(
    tx: Pick<Prisma.TransactionClient, "user">,
    scope: "ASSIGNEES" | "ADMINS" | "ASSIGNEES_AND_ADMINS",
    assignees: readonly RoutineAssigneeSnapshot[],
): Promise<RoutineNotificationRecipients> {
    const recipients = new Map<number, RoutineNotificationRecipient>();
    const addRecipient = (
        user: { id: number; email: string; name: string },
        isAssignee: boolean,
        employee?: EmployeeDisplayNameSource | null,
    ): void => {
        const existing = recipients.get(user.id);
        recipients.set(user.id, {
            userId: user.id,
            email: user.email,
            name: getUserDisplayName(
                { ...user, employee },
                "ผู้รับการแจ้งเตือน",
            ),
            isAssignee: existing?.isAssignee ?? isAssignee,
        });
    };

    if (scope === "ASSIGNEES" || scope === "ASSIGNEES_AND_ADMINS") {
        assignees.forEach(({ employee }) => {
            if (
                !isActiveRoutineEmployee(employee)
                || !employee.user
                || !isActiveRoutineUser(employee.user)
            ) {
                return;
            }
            addRecipient(employee.user, true, employee);
        });
    }
    if (scope === "ADMINS" || scope === "ASSIGNEES_AND_ADMINS") {
        const admins = await tx.user.findMany({
            where: { role: Role.ADMIN, isActive: true, deletedAt: null },
            select: {
                id: true,
                email: true,
                name: true,
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        nickname: true,
                    },
                },
            },
        });
        admins.forEach((admin) => addRecipient(admin, false, admin.employee));
    }

    const activeRecipients = [...recipients.values()];
    const emailRecipients = activeRecipients.flatMap((recipient) => {
        if (/[\r\n]/.test(recipient.email)) {
            console.warn("Routine notification recipient email is unavailable", {
                userId: recipient.userId,
            });
            return [];
        }

        const parsedEmail = routineNotificationEmailSchema.safeParse(
            recipient.email,
        );
        if (!parsedEmail.success) {
            console.warn("Routine notification recipient email is unavailable", {
                userId: recipient.userId,
            });
            return [];
        }

        return [{ ...recipient, email: parsedEmail.data }];
    });

    return { activeRecipients, emailRecipients };
}

export async function resolveLinkedRoutineLineRecipients(
    tx: LineAccountLinkReadClient,
    recipients: readonly RoutineNotificationRecipient[],
): Promise<RoutineNotificationRecipient[]> {
    if (recipients.length === 0) return [];

    const linkedUserIds = new Set(
        await findLinkedUserIdsByUserIds(
            recipients.map((recipient) => recipient.userId),
            tx,
        ),
    );
    return recipients.filter((recipient) => linkedUserIds.has(recipient.userId));
}
