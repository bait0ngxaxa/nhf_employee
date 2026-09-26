export const SHARED_DRIVE_OPTIONS = [
    "account",
    "aging",
    "edu_reform",
    "freedrive",
    "it",
    "learning_reform",
    "plc",
    "pr",
    "project_research",
    "support",
    "tax",
    "vip",
    "www",
    "reform_thailand",
    "relearning",
    "tgri",
    "ssf",
] as const;

export type SharedDriveOption = (typeof SHARED_DRIVE_OPTIONS)[number];

const SHARED_DRIVE_OPTION_SET = new Set<string>(SHARED_DRIVE_OPTIONS);

export function isSharedDriveOption(
    value: string,
): value is SharedDriveOption {
    return SHARED_DRIVE_OPTION_SET.has(value);
}
