export type LineValidationBoundary = {
    readonly property: "action.label" | "action.uri";
    readonly maxCharacters: number;
};

export type LineValidationExpectation =
    | { readonly kind: "accept" }
    | { readonly kind: "reject"; readonly boundary: LineValidationBoundary }
    | { readonly kind: "observe"; readonly boundary: LineValidationBoundary };

export type LineValidationAssessment = {
    readonly passed: boolean;
    readonly summary: string;
};

type ProviderErrorDetail = {
    readonly message: string;
    readonly property: string;
};

type ProviderError = {
    readonly message: string | null;
    readonly details: readonly ProviderErrorDetail[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeLogValue(value: string): string {
    return value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 240);
}

function parseProviderError(body: string): ProviderError | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        return null;
    }

    if (!isRecord(parsed)) return null;

    const message = typeof parsed.message === "string" ? sanitizeLogValue(parsed.message) : null;
    const details = Array.isArray(parsed.details)
        ? parsed.details.flatMap((detail): ProviderErrorDetail[] => {
            if (!isRecord(detail) || typeof detail.message !== "string" || typeof detail.property !== "string") {
                return [];
            }
            return [{
                message: sanitizeLogValue(detail.message),
                property: sanitizeLogValue(detail.property),
            }];
        })
        : [];

    return { message, details };
}

function formatProviderError(error: ProviderError | null): string {
    if (!error) return "unstructured error response omitted";

    const parts: string[] = [];
    if (error.message) parts.push(error.message);
    for (const detail of error.details.slice(0, 3)) {
        parts.push(`${detail.property}: ${detail.message}`);
    }
    return parts.length > 0 ? parts.join("; ") : "structured error response contained no details";
}

function indicatesExpectedLengthBoundary(
    detail: ProviderErrorDetail,
    boundary: LineValidationBoundary,
): boolean {
    const propertyMatches = detail.property === boundary.property
        || detail.property.endsWith(`.${boundary.property}`);
    if (!propertyMatches) return false;

    const normalizedMessage = detail.message.toLocaleLowerCase("en-US");
    const describesLength = /length|character|too long|maximum|max\b/.test(normalizedMessage);
    const maximumVariants = boundary.maxCharacters === 10_000
        ? ["10000", "10,000"]
        : [String(boundary.maxCharacters)];
    const citesExpectedMaximum = maximumVariants.some((maximum) => {
        return new RegExp(`(?:^|\\D)${maximum}(?:\\D|$)`).test(normalizedMessage);
    });
    return describesLength && citesExpectedMaximum;
}

export function assessLineValidationResponse(
    status: number,
    body: string,
    expectation: LineValidationExpectation,
): LineValidationAssessment {
    if (status === 200) {
        if (expectation.kind === "reject") {
            return { passed: false, summary: "HTTP 200 accepted the payload; a boundary rejection was expected." };
        }
        if (expectation.kind === "observe") {
            return { passed: true, summary: "HTTP 200 accepted the Unicode boundary payload." };
        }
        return { passed: true, summary: "HTTP 200 accepted the payload." };
    }

    if (status !== 400) {
        return {
            passed: false,
            summary: `HTTP ${status} is not a validation result (expected HTTP 200 or 400). Provider response: ${formatProviderError(parseProviderError(body))}.`,
        };
    }

    const providerError = parseProviderError(body);
    const diagnostic = formatProviderError(providerError);
    if (expectation.kind === "accept") {
        return { passed: false, summary: `HTTP 400 rejected an expected-valid payload. LINE details: ${diagnostic}.` };
    }

    if (!providerError || providerError.details.length === 0) {
        return { passed: false, summary: `HTTP 400 lacked structured LINE error details. LINE details: ${diagnostic}.` };
    }

    const matchedBoundary = providerError.details.some((detail) =>
        indicatesExpectedLengthBoundary(detail, expectation.boundary));
    if (!matchedBoundary) {
        return {
            passed: false,
            summary: `HTTP 400 did not identify the ${expectation.boundary.property} ${expectation.boundary.maxCharacters}-character boundary. LINE details: ${diagnostic}.`,
        };
    }

    const outcome = expectation.kind === "observe" ? "Unicode boundary observed as rejected" : "expected boundary rejection";
    return {
        passed: true,
        summary: `HTTP 400 ${outcome} for ${expectation.boundary.property} at the ${expectation.boundary.maxCharacters}-character limit. LINE details: ${diagnostic}.`,
    };
}
