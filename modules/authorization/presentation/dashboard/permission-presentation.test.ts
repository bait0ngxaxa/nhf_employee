import { describe, expect, it } from "vitest";

import {
    AUTHORIZATION_CHANNELS,
    AUTHORIZATION_SCOPES,
    CAPABILITY_REGISTRY,
} from "../../";
import {
    authorizationCapabilityPresentation,
    authorizationChannelPresentation,
    authorizationContextPresentation,
    authorizationLimitationPresentation,
    authorizationScopePresentation,
    getAuthorizationChannelPresentation,
    getAuthorizationContextPresentation,
    getAuthorizationLimitationPresentation,
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

    it("covers trusted contexts and safely falls back for an unknown context", () => {
        for (const [key, presentation] of Object.entries(authorizationContextPresentation)) {
            expect(presentation.label).toBeTruthy();
            expect(presentation.description).toBeTruthy();
            expect(getAuthorizationContextPresentation(key)).toEqual(presentation);
        }

        expect(getAuthorizationContextPresentation("future.context")).toEqual({
            label: "บริบทการใช้งาน",
            description: "การใช้งานในบริบทนี้ยังมีรายละเอียดเพิ่มเติมในข้อมูลทางเทคนิค",
        });
    });

    it("covers every current effective-access limitation code with ordinary copy", () => {
        const currentCodes = [
            "employee.lifecycle_and_resource",
            "department.resource_scope",
            "notification.actor_owned",
            "routine.resource_relationship",
            "routine.occurrence_assignment_workflow",
            "routine.summary_scope",
            "routine.reference_scope",
            "routine.export_resource",
            "stock.catalog.resource",
            "stock.inventory.integrity",
            "stock.request.relationship",
            "stock.request.create_invariants",
            "stock.request.cancel_workflow",
            "stock.request.process_workflow",
            "stock.report.resource",
            "leave.request.relationship",
            "leave.effective_approver",
            "leave.request.lifecycle",
            "leave.cancellation.workflow",
            "leave.approval.workflow",
            "leave.not_taken.relationship",
            "leave.approver.workflow",
            "audit.server_resource",
            "email.deferred_migration",
        ];

        for (const code of currentCodes) {
            const presentation = authorizationLimitationPresentation[code];
            expect(presentation).toBeDefined();
            expect(presentation?.label).toBeTruthy();
            expect(presentation?.description).toBeTruthy();
            expect(getAuthorizationLimitationPresentation(code).label).not.toBe(code);
        }

        expect(getAuthorizationLimitationPresentation("future.limitation").label).toBe("มีเงื่อนไขการใช้งานเพิ่มเติม");
    });
});
