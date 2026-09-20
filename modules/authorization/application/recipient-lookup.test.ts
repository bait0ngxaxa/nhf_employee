import { describe, expect, it, vi } from "vitest";

import {
    AuthorizationConfigurationError,
    createAuthorizationRecipientLookup,
} from "@/modules/authorization";
import type { AuthorizationRecipientRepository } from "./types";

describe("authorization recipient lookup", () => {
    it("validates registered capability/scope and delegates configured lookup", async () => {
        const findActiveUsersWithConfiguredCapabilityScope = vi
            .fn<AuthorizationRecipientRepository["findActiveUsersWithConfiguredCapabilityScope"]>()
            .mockResolvedValue([11, 7, 11]);
        const lookup = createAuthorizationRecipientLookup({
            repository: { findActiveUsersWithConfiguredCapabilityScope },
        });

        await expect(lookup.findActiveUsersWithConfiguredCapabilityScope({
            capability: "routine.task.read",
            scope: "ALL",
        })).resolves.toEqual([7, 11]);
        expect(findActiveUsersWithConfiguredCapabilityScope).toHaveBeenCalledWith({
            capability: "routine.task.read",
            scope: "ALL",
        });
    });

    it.each([
        ["unknown capability", "routine.task.unknown", "ALL"],
        ["unsupported scope", "routine.task.read", "OWN"],
    ] as const)("rejects %s before persistence lookup", async (_label, capability, scope) => {
        const findActiveUsersWithConfiguredCapabilityScope = vi.fn();
        const lookup = createAuthorizationRecipientLookup({
            repository: { findActiveUsersWithConfiguredCapabilityScope },
        });

        await expect(lookup.findActiveUsersWithConfiguredCapabilityScope({
            capability,
            scope,
        })).rejects.toBeInstanceOf(AuthorizationConfigurationError);
        expect(findActiveUsersWithConfiguredCapabilityScope).not.toHaveBeenCalled();
    });
});
