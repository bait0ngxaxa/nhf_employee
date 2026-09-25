import type { Prisma } from "@prisma/client";

import {
    findCurrentEmployeeDisplayProjections,
} from "@/modules/employee";
import {
    findActiveUsersWithConfiguredCapabilityScope,
} from "@/modules/authorization";

import { evaluateITAssigneeEligibility } from "./assignee-eligibility";

export type ITOperatorAudienceMember = Awaited<
    ReturnType<typeof findCurrentEmployeeDisplayProjections>
>[number];

/** Resolves the explicitly configured, active workforce operator audience. */
export async function findITOperatorAudience(
    tx: Prisma.TransactionClient,
): Promise<readonly ITOperatorAudienceMember[]> {
    const [readUsers, commentUsers, manageUsers] = await Promise.all([
        findActiveUsersWithConfiguredCapabilityScope({
            capability: "it.ticket.read",
            scope: "ALL",
        }, tx),
        findActiveUsersWithConfiguredCapabilityScope({
            capability: "it.ticket.comment",
            scope: "ALL",
        }, tx),
        findActiveUsersWithConfiguredCapabilityScope({
            capability: "it.ticket.manage",
            scope: "ALL",
        }, tx),
    ]);

    const readUserIds = new Set(readUsers);
    const commentUserIds = new Set(commentUsers);
    const manageUserIds = new Set(manageUsers);
    const configuredCandidates = readUsers.filter((userId) =>
        commentUserIds.has(userId) && manageUserIds.has(userId),
    );
    const activeWorkforce = await findCurrentEmployeeDisplayProjections(
        configuredCandidates,
        tx,
    );

    return activeWorkforce.filter((employee) =>
        evaluateITAssigneeEligibility({
            activeWorkforce: true,
            hasConfiguredReadAll: readUserIds.has(employee.userId),
            hasConfiguredCommentAll: commentUserIds.has(employee.userId),
            hasConfiguredManageAll: manageUserIds.has(employee.userId),
        }),
    );
}
