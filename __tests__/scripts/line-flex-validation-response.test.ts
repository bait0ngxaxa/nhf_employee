import { describe, expect, it } from "vitest";

import {
    assessLineValidationResponse,
    type LineValidationBoundary,
} from "@/scripts/line-flex-validation-response";

const labelBoundary: LineValidationBoundary = { property: "action.label", maxCharacters: 40 };
const uriBoundary: LineValidationBoundary = { property: "action.uri", maxCharacters: 10_000 };

function lineError(property: string, message: string): string {
    return JSON.stringify({
        message: "The request body has 1 error(s)",
        details: [{ message, property }],
    });
}

describe("LINE validation endpoint response assessment", () => {
    it("accepts HTTP 200 as a valid validation result", () => {
        expect(assessLineValidationResponse(200, "{}", { kind: "accept" })).toMatchObject({
            passed: true,
            summary: "HTTP 200 accepted the payload.",
        });
    });

    it("accepts a structured HTTP 400 that identifies the tested label boundary", () => {
        const response = lineError(
            "messages[0].contents.footer.contents[0].action.label",
            "Length must be between 1 and 40",
        );

        expect(assessLineValidationResponse(400, response, {
            kind: "reject",
            boundary: labelBoundary,
        })).toMatchObject({ passed: true });
    });

    it("records an observed Unicode boundary only when the response is 200 or its expected 400", () => {
        expect(assessLineValidationResponse(200, "{}", {
            kind: "observe",
            boundary: labelBoundary,
        })).toMatchObject({ passed: true, summary: expect.stringContaining("accepted") });

        expect(assessLineValidationResponse(400, lineError(
            "messages[0].contents.footer.contents[0].action.label",
            "Length must be between 1 and 40",
        ), {
            kind: "observe",
            boundary: labelBoundary,
        })).toMatchObject({ passed: true, summary: expect.stringContaining("observed as rejected") });
    });

    it.each([429, 500, 502, 503])("fails HTTP %i instead of treating it as a negative validation result", (status) => {
        const result = assessLineValidationResponse(status, JSON.stringify({ message: "Service unavailable" }), {
            kind: "reject",
            boundary: labelBoundary,
        });

        expect(result.passed).toBe(false);
        expect(result.summary).toContain(`HTTP ${status}`);
        expect(result.summary).toContain("not a validation result");
    });

    it("rejects HTTP 400 when LINE reports a different invalid field", () => {
        const response = lineError("messages[0].altText", "Length must be between 1 and 1500");
        const result = assessLineValidationResponse(400, response, {
            kind: "reject",
            boundary: labelBoundary,
        });

        expect(result.passed).toBe(false);
        expect(result.summary).toContain("did not identify the action.label 40-character boundary");
    });

    it("rejects HTTP 400 when the property matches but its detail is unrelated to the boundary", () => {
        const response = lineError(
            "messages[0].contents.footer.contents[0].action.uri",
            "Must be a valid URI",
        );
        const result = assessLineValidationResponse(400, response, {
            kind: "reject",
            boundary: uriBoundary,
        });

        expect(result.passed).toBe(false);
        expect(result.summary).toContain("did not identify the action.uri 10000-character boundary");
    });

    it("rejects HTTP 400 when LINE reports a different maximum length", () => {
        const response = lineError(
            "messages[0].contents.footer.contents[0].action.label",
            "Length must be between 1 and 140",
        );
        const result = assessLineValidationResponse(400, response, {
            kind: "reject",
            boundary: labelBoundary,
        });

        expect(result.passed).toBe(false);
        expect(result.summary).toContain("did not identify the action.label 40-character boundary");
    });

    it("fails an observed Unicode probe when HTTP 400 identifies an unrelated field", () => {
        const response = lineError("messages[0].altText", "Length must be between 1 and 1500");
        const result = assessLineValidationResponse(400, response, {
            kind: "observe",
            boundary: labelBoundary,
        });

        expect(result.passed).toBe(false);
        expect(result.summary).toContain("did not identify the action.label 40-character boundary");
    });

    it("fails an expected-valid probe rejected with HTTP 400", () => {
        const result = assessLineValidationResponse(
            400,
            lineError("messages[0].contents.footer.contents[0].action.label", "Invalid label"),
            { kind: "accept" },
        );

        expect(result.passed).toBe(false);
        expect(result.summary).toContain("expected-valid payload");
    });

    it("fails HTTP 400 responses that lack structured details", () => {
        const result = assessLineValidationResponse(400, "<html>bad request</html>", {
            kind: "observe",
            boundary: labelBoundary,
        });

        expect(result.passed).toBe(false);
        expect(result.summary).toContain("lacked structured LINE error details");
        expect(result.summary).not.toContain("<html>");
    });

    it("limits provider response text and strips control characters from diagnostics", () => {
        const unsafeMessage = `Bad\n${"x".repeat(500)}`;
        const response = lineError("messages[0].body.text", unsafeMessage);
        const result = assessLineValidationResponse(503, response, {
            kind: "observe",
            boundary: labelBoundary,
        });

        expect(result.passed).toBe(false);
        expect(result.summary).not.toContain("\n");
        expect(result.summary.length).toBeLessThan(700);
    });
});
