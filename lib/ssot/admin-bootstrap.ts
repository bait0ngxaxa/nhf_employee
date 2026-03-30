const DEFAULT_BOOTSTRAP_ADMIN_EMAIL = "admin@thainhf.org";

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function getBootstrapAdminEmails(): string[] {
    const raw = process.env.BOOTSTRAP_ADMIN_EMAILS;
    if (!raw) {
        return [DEFAULT_BOOTSTRAP_ADMIN_EMAIL];
    }

    const emails = raw
        .split(",")
        .map((value) => normalizeEmail(value))
        .filter((value) => value.length > 0);

    if (emails.length === 0) {
        return [DEFAULT_BOOTSTRAP_ADMIN_EMAIL];
    }

    return Array.from(new Set(emails));
}

export function isBootstrapAdminEmail(email: string): boolean {
    const normalized = normalizeEmail(email);
    return getBootstrapAdminEmails().includes(normalized);
}
