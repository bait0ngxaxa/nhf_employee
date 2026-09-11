import { describe, expect, it } from "vitest";

import {
    AUTHORIZATION_SCOPES,
    CAPABILITY_REGISTRY,
    CapabilityGrantValidationError,
    validateCapabilityGrant,
} from "@/modules/authorization";

describe("authorization grant persistence validation", () => {
    it("accepts a registered capability with one of its supported scopes", () => {
        expect(validateCapabilityGrant({
            capabilityKey: "routine.task.read",
            scope: "ASSIGNED",
        })).toEqual({
            capabilityKey: "routine.task.read",
            scope: "ASSIGNED",
        });
    });

    it("rejects an unknown capability key", () => {
        expect(() => validateCapabilityGrant({
            capabilityKey: "routine.task.archive",
            scope: "ALL",
        })).toThrowError(CapabilityGrantValidationError);

        try {
            validateCapabilityGrant({
                capabilityKey: "routine.task.archive",
                scope: "ALL",
            });
        } catch (error) {
            expect(error).toMatchObject({ code: "UNKNOWN_CAPABILITY" });
        }
    });

    it("rejects a known capability with an unsupported scope", () => {
        expect(() => validateCapabilityGrant({
            capabilityKey: "stock.request.create",
            scope: "ALL",
        })).toThrowError(CapabilityGrantValidationError);

        try {
            validateCapabilityGrant({
                capabilityKey: "stock.request.create",
                scope: "ALL",
            });
        } catch (error) {
            expect(error).toMatchObject({ code: "UNSUPPORTED_SCOPE" });
        }
    });

    it("reads supported scopes from the Phase 1 registry rather than a second list", () => {
        const definition = CAPABILITY_REGISTRY.get("stock.request.create");

        expect(definition?.scopes).toEqual(["OWN"]);
        expect(AUTHORIZATION_SCOPES as readonly string[]).not.toContain("Department");
        expect(() => validateCapabilityGrant({
            capabilityKey: "stock.request.create",
            scope: "Department",
        })).toThrowError(CapabilityGrantValidationError);
    });

    it("does not trim or fall back for unsupported scope values", () => {
        expect(() => validateCapabilityGrant({
            capabilityKey: "stock.request.create",
            scope: " OWN ",
        })).toThrow("Unsupported authorization scope");
    });
});
