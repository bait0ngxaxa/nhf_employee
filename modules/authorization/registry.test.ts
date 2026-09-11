import { describe, expect, it } from "vitest";

import {
    AUTHORIZATION_CHANNELS,
    AUTHORIZATION_SCOPES,
    CAPABILITY_DEFINITIONS,
    CAPABILITY_KEYS,
    CAPABILITY_REGISTRY,
    createCapabilityRegistry,
    getCapabilityDefinition,
    isCapabilityKey,
    isRegisteredCapabilityKey,
} from "@/modules/authorization";
import type {
    AuthorizationActor,
    CapabilityDefinition,
} from "@/modules/authorization";

describe("authorization contracts", () => {
    it("defines the approved scope and execution-channel vocabularies", () => {
        expect(AUTHORIZATION_SCOPES).toEqual([
            "OWN",
            "CREATED",
            "ASSIGNED",
            "TEAM",
            "ALL",
        ]);
        expect(AUTHORIZATION_CHANNELS).toEqual([
            "DASHBOARD",
            "LIFF_SELF_SERVICE",
            "SYSTEM",
        ]);
        expect(AUTHORIZATION_CHANNELS as readonly string[]).not.toContain("API");
        expect(AUTHORIZATION_SCOPES as readonly string[]).not.toContain("Department");
        expect(Object.isFrozen(AUTHORIZATION_SCOPES)).toBe(true);
        expect(Object.isFrozen(AUTHORIZATION_CHANNELS)).toBe(true);
    });

    it("represents an actor without domain-specific authorization state", () => {
        const actor: AuthorizationActor = {
            userId: 17,
            employeeId: null,
            systemRole: "ADMIN",
            channel: "DASHBOARD",
        };

        expect(actor).toEqual({
            userId: 17,
            employeeId: null,
            systemRole: "ADMIN",
            channel: "DASHBOARD",
        });
    });

    it("contains unique, well-formed, deterministic capability keys", () => {
        const definitions = CAPABILITY_REGISTRY.definitions;
        const keys = definitions.map((definition) => definition.key);

        expect(new Set(keys).size).toBe(keys.length);
        expect(CAPABILITY_KEYS).toEqual(keys);
        expect(CAPABILITY_DEFINITIONS.map((definition) => definition.key)).toEqual(keys);
        expect(keys.every((key) => isCapabilityKey(key))).toBe(true);
        expect(isCapabilityKey("employee.read")).toBe(true);
        expect(isCapabilityKey("routine.task.read.extra")).toBe(false);
        expect(isCapabilityKey("Employee.read")).toBe(false);
    });

    it("declares supported scopes and channels for every capability", () => {
        for (const definition of CAPABILITY_REGISTRY.definitions) {
            expect(definition.description).toBe(definition.description.trim());
            expect(definition.description.length).toBeGreaterThan(0);
            expect(definition.scopes.length).toBeGreaterThan(0);
            expect(definition.channels.length).toBeGreaterThan(0);
            expect(
                definition.scopes.every((scope) =>
                    (AUTHORIZATION_SCOPES as readonly string[]).includes(scope),
                ),
            ).toBe(true);
            expect(
                definition.channels.every((channel) =>
                    (AUTHORIZATION_CHANNELS as readonly string[]).includes(channel),
                ),
            ).toBe(true);
            expect(definition.key.split(".")[0]).toBe(definition.domain);
        }
    });

    it("looks up registered keys and rejects unknown keys", () => {
        expect(getCapabilityDefinition("routine.task.read")).toMatchObject({
            key: "routine.task.read",
            domain: "routine",
            description: "Read Routine tasks within an authorized resource scope.",
        });
        expect(isRegisteredCapabilityKey("routine.task.read")).toBe(true);
        expect(getCapabilityDefinition("routine.task.archive")).toBeUndefined();
        expect(isRegisteredCapabilityKey("routine.task.archive")).toBe(false);
        expect(CAPABILITY_REGISTRY.has("routine.task.archive")).toBe(false);
    });

    it("fails early for invalid registry definitions", () => {
        const definition: CapabilityDefinition = {
            key: "employee.read",
            domain: "employee",
            description: "Read Employee records within an authorized resource scope.",
            scopes: ["ALL"],
            channels: ["DASHBOARD"],
        };

        expect(() => createCapabilityRegistry([definition, definition])).toThrow(
            "duplicate key employee.read",
        );
        expect(() =>
            createCapabilityRegistry([
                {
                    ...definition,
                    key: "employee" as CapabilityDefinition["key"],
                },
            ]),
        ).toThrow("invalid key");
        expect(() =>
            createCapabilityRegistry([
                {
                    ...definition,
                    scopes: ["DEPARTMENT"] as unknown as CapabilityDefinition["scopes"],
                },
            ]),
        ).toThrow("invalid scopes");
        expect(() =>
            createCapabilityRegistry([
                {
                    ...definition,
                    channels: ["API"] as unknown as CapabilityDefinition["channels"],
                },
            ]),
        ).toThrow("invalid channels");
        expect(() =>
            createCapabilityRegistry([
                {
                    ...definition,
                    description: "",
                },
            ]),
        ).toThrow("invalid description");
        expect(() =>
            createCapabilityRegistry([
                {
                    ...definition,
                    description: "   ",
                },
            ]),
        ).toThrow("invalid description");
    });

    it("keeps the registry and its definitions immutable", () => {
        const [definition] = CAPABILITY_REGISTRY.definitions;

        expect(Object.isFrozen(CAPABILITY_REGISTRY)).toBe(true);
        expect(Object.isFrozen(CAPABILITY_REGISTRY.definitions)).toBe(true);
        expect(definition).toBeDefined();
        if (!definition) return;
        expect(Object.isFrozen(definition)).toBe(true);
        expect(Object.isFrozen(definition.scopes)).toBe(true);
        expect(Object.isFrozen(definition.channels)).toBe(true);
    });
});
