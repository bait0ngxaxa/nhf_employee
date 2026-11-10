/**
 * Single source of truth for app-level request body limits.
 *
 * Production has no reverse proxy in the request path (Cloudflare Tunnel →
 * Next.js), so these limits are the only body-size bound besides Cloudflare's
 * plan limit. Every value has a one-line rationale; derived values are proven
 * by __tests__/lib/request-limits.test.ts against the maximal schema-valid
 * payload, so a schema change that outgrows its limit fails CI.
 *
 * Size arithmetic assumes UTF-8 at up to 3 bytes per UTF-16 code unit (Thai is
 * 3 bytes; non-BMP characters are 4 bytes per 2 code units).
 */

/** Shared client-safe message for 413 responses (byte-identical to existing module messages). */
export const REQUEST_BODY_TOO_LARGE_MESSAGE = "คำขอมีขนาดใหญ่เกินไป";

// ── Pre-auth credential payloads ───────────────────────────────────────────

// Login, signup, forgot and reset password: email ≤ 254 chars (RFC 5321), reset
// token is 64 hex chars, and bcrypt only uses the first 72 bytes of a password;
// 4 KiB still leaves > 1,000 Thai characters per password field.
export const AUTH_CREDENTIALS_MAX_REQUEST_BYTES = 4 * 1024;

// ── Shared default for small authenticated JSON mutations ─────────────────

// Schemas whose fields are ids, enums and short text (≤ a few hundred chars):
// employee create/update, session revoke, authorization administration, IT
// operator PATCH, stock category/adjust, email request form. Largest proven
// maximal payload is well under 8 KiB; 16 KiB leaves headroom.
export const DEFAULT_JSON_MUTATION_MAX_BYTES = 16 * 1024;

// ── Module and per-route overrides ────────────────────────────────────────

export const STOCK_JSON_MUTATION_MAX_BYTES = 32 * 1024;
export const LEAVE_JSON_MUTATION_MAX_BYTES = 32 * 1024;
export const ROUTINE_MAX_REQUEST_BYTES = 64 * 1024;
// Technical JSON envelope for bounded IT comment text, including escaped input.
export const IT_TICKET_COMMENT_MAX_REQUEST_BYTES = 64 * 1024;

// Stock item create/update: up to 20 variants × (2,000-char image URL + 5
// attributes × 2 × 100 chars) plus a 2,000-char description; the maximal
// schema-valid payload is ≈ 200 KiB at 3 bytes/char.
export const STOCK_ITEM_JSON_MAX_REQUEST_BYTES = 256 * 1024;

// Employee CSV import (JSON body of parsed rows). Derived from the UI caps:
// the CSV file is at most EMPLOYEE_IMPORT_CSV_MAX_FILE_BYTES and the server
// accepts at most EMPLOYEE_IMPORT_LIMIT_BASIS_ROWS rows. Each JSON value is at
// most 2× its CSV bytes (backslash/newline escaping; Thai bytes are unchanged)
// plus a per-row allowance for the repeated JSON keys and punctuation.
export const EMPLOYEE_IMPORT_CSV_MAX_FILE_BYTES = 5 * 1024 * 1024;
// Must equal EMPLOYEE_IMPORT_MAX_ROWS (modules/employee); a test guards drift.
export const EMPLOYEE_IMPORT_LIMIT_BASIS_ROWS = 1000;
export const EMPLOYEE_IMPORT_ROW_JSON_OVERHEAD_BYTES = 512;
export const EMPLOYEE_IMPORT_JSON_MAX_REQUEST_BYTES =
    2 * EMPLOYEE_IMPORT_CSV_MAX_FILE_BYTES
    + EMPLOYEE_IMPORT_LIMIT_BASIS_ROWS * EMPLOYEE_IMPORT_ROW_JSON_OVERHEAD_BYTES;

// Leave approver assignments: the count cap LEAVE_APPROVER_ASSIGNMENTS_MAX is
// a Leave domain constant (modules/leave/domain/constants.ts). It is not
// imported here because Leave imports this file and this file is reachable
// from client code; the coupling is proven by __tests__/lib/request-limits.test.ts,
// so raising the cap without raising this limit fails CI.
// 5,000 assignments × 49 B (largest: {"employeeId":2147483647,"managerId":2147483647},
// since ids are MySQL INT ≤ 10 digits) + 1 KiB envelope = 246,024 B → 256 KiB.
export const LEAVE_APPROVERS_JSON_MAX_REQUEST_BYTES = 256 * 1024;
