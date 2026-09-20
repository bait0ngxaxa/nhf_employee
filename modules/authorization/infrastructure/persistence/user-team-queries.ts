import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { UserTeamPresentation } from "@/shared/identity/team-presentation";

const ACTIVE_USER_TEAM_SELECT = {
    team: {
        select: {
            id: true,
            name: true,
        },
    },
} as const satisfies Prisma.TeamMembershipSelect;

type ActiveUserTeamRow = Prisma.TeamMembershipGetPayload<{
    select: typeof ACTIVE_USER_TEAM_SELECT;
}>;

/**
 * Descriptive identity context only. This query intentionally does not read
 * TeamRole or any grant/capability data and must not be used for authorization.
 */
export async function findActiveUserTeams(
    userId: number,
): Promise<readonly UserTeamPresentation[]> {
    const memberships = await prisma.teamMembership.findMany({
        where: {
            userId,
            team: { isActive: true },
        },
        orderBy: [
            { team: { name: "asc" } },
            { teamId: "asc" },
        ],
        select: ACTIVE_USER_TEAM_SELECT,
    });

    const teams = new Map<number, string>();
    for (const membership of memberships as readonly ActiveUserTeamRow[]) {
        if (!teams.has(membership.team.id)) {
            teams.set(membership.team.id, membership.team.name);
        }
    }

    return Object.freeze(
        [...teams.entries()].map(([id, name]) => Object.freeze({ id, name })),
    );
}
