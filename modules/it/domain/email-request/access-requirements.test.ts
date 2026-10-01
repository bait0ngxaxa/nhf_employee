import { describe, expect, it } from "vitest";
import { accessRequirementsSchema, readStoredAccessRequirements, updateAccessRequirementsSchema } from "./access-requirements";
import { emailRequestSchema } from "./validation";

describe("Employee Access Requirements", () => {
    it.each([
        ["UNDECIDED", [], true], ["NOT_REQUIRED", [], true], ["REQUIRED", ["it", "support"], true],
        ["REQUIRED", [], false], ["UNDECIDED", ["it"], false], ["NOT_REQUIRED", ["it"], false],
        ["REQUIRED", ["it", "it"], false], ["REQUIRED", ["unknown"], false],
    ])("validates shared decision %s with %j", (sharedDriveDecision, sharedDriveAccess, valid) => {
        expect(accessRequirementsSchema.safeParse({ documentSystemDecision: "UNDECIDED", sharedDriveDecision, sharedDriveAccess }).success).toBe(valid);
    });
    it("allows new requests to default both decisions to UNDECIDED", () => {
        expect(emailRequestSchema.parse({ thaiName: "สมชาย", englishName: "Somchai", phone: "0812345678", nickname: "ชาย",
            position: "เจ้าหน้าที่", department: "มสช.", replyEmail: "reply@example.com" })).toMatchObject({
            documentSystemDecision: "UNDECIDED", sharedDriveDecision: "UNDECIDED", sharedDriveAccess: [],
        });
    });
    it.each([true, false])("maps historical document %s without reinterpreting it as unknown", (needsDocumentSystem) => {
        expect(readStoredAccessRequirements({ documentSystemDecision: null, sharedDriveDecision: null, needsDocumentSystem, sharedDriveAccess: null }))
            .toMatchObject({ documentSystemDecision: needsDocumentSystem ? "REQUIRED" : "NOT_REQUIRED", sharedDriveDecision: "NOT_REQUIRED", sharedDriveAccess: [] });
    });
    it.each([null, [], ["it", "support"]])("maps legacy Shared Drive %j including pre-reload NULL decisions", (sharedDriveAccess) => {
        expect(readStoredAccessRequirements({ documentSystemDecision: null, sharedDriveDecision: null, needsDocumentSystem: false, sharedDriveAccess }))
            .toMatchObject({ sharedDriveDecision: sharedDriveAccess?.length ? "REQUIRED" : "NOT_REQUIRED", sharedDriveAccess: sharedDriveAccess ?? [] });
    });
    it("explicit new decisions win over compatibility mirrors", () => {
        expect(readStoredAccessRequirements({ documentSystemDecision: "UNDECIDED", sharedDriveDecision: "UNDECIDED", needsDocumentSystem: false, sharedDriveAccess: [] }))
            .toMatchObject({ documentSystemDecision: "UNDECIDED", sharedDriveDecision: "UNDECIDED" });
    });
    it("normalizes drive order and rejects arbitrary employee mutation", () => {
        const input = { documentSystemDecision: "REQUIRED", sharedDriveDecision: "REQUIRED", sharedDriveAccess: ["support", "it"] };
        expect(accessRequirementsSchema.parse(input).sharedDriveAccess).toEqual(["it", "support"]);
        expect(updateAccessRequirementsSchema.safeParse({ ...input, expectedAccessVersion: 1, phone: "999" }).success).toBe(false);
    });
});
