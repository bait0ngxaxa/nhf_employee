import { z } from "zod";

import {
    findActiveUsersWithConfiguredCapabilityScope,
    type AuthorizationPersistenceContext,
} from "@/modules/authorization";
import {
    type EmployeeDisplayNameSource,
} from "@/modules/employee";
import {
    findLinkedUserIdsByUserIds,
    type LineAccountLinkReadClient,
} from "@/modules/line";
import { getUserDisplayName } from "@/shared/identity/display";
import {
    includesRoutineAllReaders,
    includesRoutineAssignees,
    type RoutineReminderRecipientScope,
} from "../domain/reminder-recipients";

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
    tx: AuthorizationPersistenceContext,
    scope: RoutineReminderRecipientScope,
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

    if (includesRoutineAssignees(scope)) {
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
    if (includesRoutineAllReaders(scope)) {
        const allReaderUserIds = await findActiveUsersWithConfiguredCapabilityScope(
            {
                capability: "routine.task.read",
                scope: "ALL",
            },
            tx,
        );
        const allReaders = allReaderUserIds.length === 0
            ? []
            : await tx.user.findMany({
                where: {
                    id: { in: [...allReaderUserIds] },
                    isActive: true,
                    deletedAt: null,
                },
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
                orderBy: { id: "asc" },
            });
        allReaders.forEach((reader) => addRecipient(reader, false, reader.employee));
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
