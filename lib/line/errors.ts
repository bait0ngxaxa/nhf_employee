export type LineIdentityVerificationErrorCode =
    | "INVALID_TOKEN"
    | "UPSTREAM_ERROR"
    | "MISCONFIGURED";

const LINE_ERROR_STATUS_CODES: Record<LineIdentityVerificationErrorCode, number> = {
    INVALID_TOKEN: 401,
    UPSTREAM_ERROR: 502,
    MISCONFIGURED: 500,
};

export class LineIdentityVerificationError extends Error {
    readonly code: LineIdentityVerificationErrorCode;
    readonly statusCode: number;

    constructor(
        code: LineIdentityVerificationErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "LineIdentityVerificationError";
        this.code = code;
        this.statusCode = LINE_ERROR_STATUS_CODES[code];
    }
}
