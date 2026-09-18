import { describe, expect, it } from "vitest";

import {
    AUTHORIZATION_CHANNELS,
    AUTHORIZATION_SCOPES,
    CAPABILITY_REGISTRY,
} from "../../";
import {
    authorizationCapabilityPresentation,
    authorizationChannelPresentation,
    authorizationScopePresentation,
    getAuthorizationChannelPresentation,
    getAuthorizationScopePresentation,
    getCapabilityPresentation,
} from "./permission-presentation";

describe("Authorization Administration presentation vocabulary", () => {
    it("covers every registered capability with administrator-readable metadata", () => {
        const registryKeys = CAPABILITY_REGISTRY.definitions.map(({ key }) => key);
        const presentationKeys = Object.keys(authorizationCapabilityPresentation);

        expect(presentationKeys.sort()).toEqual([...registryKeys].sort());
        for (const definition of CAPABILITY_REGISTRY.definitions) {
            const presentation = getCapabilityPresentation(definition.key);
            expect(presentation).toBeDefined();
            expect(presentation?.actionLabel).toBeTruthy();
            expect(presentation?.description).toBeTruthy();
        }
    });

    it("covers every supported scope with ordinary labels and explanations", () => {
        for (const scope of AUTHORIZATION_SCOPES) {
            expect(authorizationScopePresentation[scope].label).toBeTruthy();
            expect(authorizationScopePresentation[scope].description).toBeTruthy();
            expect(getAuthorizationScopePresentation(scope).label).not.toBe(scope);
        }
    });

    it("covers every administration channel with ordinary labels", () => {
        for (const channel of AUTHORIZATION_CHANNELS) {
            expect(authorizationChannelPresentation[channel].label).toBeTruthy();
            expect(authorizationChannelPresentation[channel].description).toBeTruthy();
            expect(getAuthorizationChannelPresentation(channel).label).not.toBe(channel);
        }
    });

    it("keeps contextual scope copy in the same presentation catalog", () => {
        expect(getAuthorizationScopePresentation("ASSIGNED", "routine.task.read")).toEqual({
            label: "รายการที่รับผิดชอบ",
            description: "งานประจำที่ผู้ใช้นี้ได้รับมอบหมายให้รับผิดชอบ",
        });
    });
});
