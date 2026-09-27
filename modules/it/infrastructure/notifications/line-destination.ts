import { LineIdentityVerificationError } from "@/lib/line/errors";

/** Configuration failures while building an action URL make this channel inapplicable. */
export function isUnavailableITLineDestination(error: unknown): boolean {
    return (error instanceof LineIdentityVerificationError
            && error.code === "MISCONFIGURED")
        || (error instanceof Error
            && error.message === "PUBLIC_APPROVE_URL is required in production.");
}
