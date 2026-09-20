export interface UserTeamPresentation {
    readonly id: number;
    readonly name: string;
}

export const NO_TEAM_PRESENTATION = "ยังไม่กำหนดทีม";

function formatTeamName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length === 0) return NO_TEAM_PRESENTATION;
    if (trimmed.startsWith("ทีม")) return trimmed;
    return /^[A-Za-z0-9]/u.test(trimmed)
        ? `ทีม ${trimmed}`
        : `ทีม${trimmed}`;
}

export function formatTeamSummary(
    teams: readonly UserTeamPresentation[] | null | undefined,
): string {
    const visibleTeams = teams
        ?.map((team) => ({ ...team, name: team.name.trim() }))
        .filter((team) => team.name.length > 0) ?? [];

    if (visibleTeams.length === 0) return NO_TEAM_PRESENTATION;

    const [firstTeam] = visibleTeams;
    if (visibleTeams.length === 1) return formatTeamName(firstTeam.name);

    return `${formatTeamName(firstTeam.name)} +${visibleTeams.length - 1} ทีม`;
}
