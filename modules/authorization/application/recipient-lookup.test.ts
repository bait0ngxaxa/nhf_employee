import { describe, expect, it, vi } from "vitest";

import {
    AuthorizationConfigurationError,
    createAuthorizationRecipientLookup,
} from "@/modules/authorization";
import type {
    AuthorizationRecipientCandidate,
    AuthorizationRecipientRepository,
} from "./types";

function directGrantCandidate(
    userId: number,
    scopes: readonly string[],
): AuthorizationRecipientCandidate {
    return {
        userId,
        resolutionData: {
            userGrants: scopes.map((scope) => ({
                userId,
                capabilityKey: "routine.task.read",
                scope,
            })),
            memberships: [],
            teamRoleGrants: [],
        },
    };
}

describe("authorization recipient lookup", () => {
    it("evaluates configured authority with the canonical evaluator", async () => {
        const loadActiveUsersWithConfiguredCapability = vi
            .fn<AuthorizationRecipientRepository["loadActiveUsersWithConfiguredCapability"]>()
            .mockResolvedValue([
                directGrantCandidate(11, ["ALL"]),
                directGrantCandidate(7, ["ALL"]),
                directGrantCandidate(13, ["OWN"]),
            ]);
        const lookup = createAuthorizationRecipientLookup({
            repository: { loadActiveUsersWithConfiguredCapability },
        });

        await expect(lookup.findActiveUsersWithConfiguredCapabilityScope({
            capability: "routine.task.read",
            scope: "ALL",
        })).resolves.toEqual([7, 11]);
        expect(loadActiveUsersWithConfiguredCapability).toHaveBeenCalledWith({
            capability: "routine.task.read",
            scope: "ALL",
        });
    });

    it("excludes a user whose capability has both valid and malformed persisted scopes", async () => {
        const loadActiveUsersWithConfiguredCapability = vi.fn<
            AuthorizationRecipientRepository["loadActiveUsersWithConfiguredCapability"]
        >().mockResolvedValue([
            directGrantCandidate(7, ["ALL", "OWN"]),
            directGrantCandidate(11, ["ALL"]),
        ]);
        const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const lookup = createAuthorizationRecipientLookup({
            repository: { loadActiveUsersWithConfiguredCapability },
        });

        await expect(lookup.findActiveUsersWithConfiguredCapabilityScope({
            capability: "routine.task.read",
            scope: "ALL",
        })).resolves.toEqual([11]);
        expect(warning).toHaveBeenCalledWith(
            "Excluded notification recipient with invalid authorization configuration",
            expect.objectContaining({
                userId: 7,
                errorCode: "UNSUPPORTED_PERSISTED_SCOPE",
            }),
        );
        warning.mockRestore();
    });

    it.each([
        ["unknown capability", "routine.task.unknown", "ALL"],
        ["unsupported scope", "routine.task.read", "OWN"],
    ] as const)("rejects %s before persistence lookup", async (_label, capability, scope) => {
        const loadActiveUsersWithConfiguredCapability = vi.fn();
        const lookup = createAuthorizationRecipientLookup({
            repository: { loadActiveUsersWithConfiguredCapability },
        });

        await expect(lookup.findActiveUsersWithConfiguredCapabilityScope({
            capability,
            scope,
        })).rejects.toBeInstanceOf(AuthorizationConfigurationError);
        expect(loadActiveUsersWithConfiguredCapability).not.toHaveBeenCalled();
    });
});
