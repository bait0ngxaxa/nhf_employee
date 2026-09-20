// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiRequest: vi.fn(),
}));

vi.mock("@/lib/client/api-client", () => ({
    apiGet: mocks.apiGet,
    apiPost: mocks.apiPost,
    apiPatch: mocks.apiPatch,
    apiRequest: mocks.apiRequest,
}));

import {
    changeUserSystemRole,
    removeTeamGrant,
    removeTeamRoleGrant,
    removeUserGrant,
} from "./api";

const grant = { capabilityKey: "routine.task.read", scope: "OWN" } as const;

describe("Authorization Administration presentation API adapter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.apiRequest.mockResolvedValue({
            success: true,
            data: { grant },
            status: 200,
            requestId: "req-authz-test",
        });
    });

    it("preserves the exact Team grant DELETE body", async () => {
        await removeTeamGrant(11, grant);

        expect(mocks.apiRequest).toHaveBeenCalledWith(
            "/api/authorization/administration/teams/11/grants",
            { method: "DELETE", data: grant },
        );
    });

    it("preserves the exact TeamRole grant DELETE body", async () => {
        await removeTeamRoleGrant(11, 21, grant);

        expect(mocks.apiRequest).toHaveBeenCalledWith(
            "/api/authorization/administration/teams/11/roles/21/grants",
            { method: "DELETE", data: grant },
        );
    });

    it("preserves the exact direct User grant DELETE body", async () => {
        await removeUserGrant(7, grant);

        expect(mocks.apiRequest).toHaveBeenCalledWith(
            "/api/authorization/administration/users/7/grants",
            { method: "DELETE", data: grant },
        );
    });

    it("uses the dedicated system-role route", async () => {
        mocks.apiPatch.mockResolvedValue({
            success: true,
            data: { result: { userId: 7, before: "USER", after: "ADMIN" } },
            status: 200,
            requestId: "req-role-test",
        });

        await expect(changeUserSystemRole(7, { systemRole: "ADMIN" })).resolves.toEqual({
            userId: 7,
            before: "USER",
            after: "ADMIN",
        });
        expect(mocks.apiPatch).toHaveBeenCalledWith(
            "/api/authorization/administration/users/7/system-role",
            { systemRole: "ADMIN" },
        );
    });
});
