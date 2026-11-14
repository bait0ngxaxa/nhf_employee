# Malformed JSON API contract

Inventory baseline: `6b54d26ec61e01e73349f5ac20362d3c341a64eb` (main). Paths below are relative to `/api`; module/source paths are relative to the repository. This is an intentional malformed/unreadable JSON contract change only. Valid parsed values, including `null`, still follow the existing validation/business paths.

`M` below is the byte-identical string `รูปแบบข้อมูลไม่ถูกต้อง`, defined once as `REQUEST_BODY_INVALID_JSON_MESSAGE` in `lib/ssot/request-limits.ts`. `E(message)` means the exact JSON object `{"error":message}`; `F(message)` means `{"error":message,"success":false}`. Envelope property order is unchanged for the two protected already-400 contracts.

## Existing readRouteJsonBody callers

| Route / reader | Previous malformed status/body | New malformed status/body |
| --- | --- | --- |
| POST `/auth/hybrid-login` | 500 E(`Internal server error`) | 400 E(M) |
| POST `/auth/signup` | 500 E(`เกิดข้อผิดพลาดในการสมัครสมาชิก`) | 400 E(M) |
| POST `/auth/forgot-password` | 500 E(`เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง`) | 400 E(M) |
| POST `/auth/reset-password` | 500 E(`Internal server error`) | 400 E(M) |
| POST `/auth/sessions/revoke` | 500 E(`Internal server error`) | 400 E(M) |
| POST `/employees` | 500 E(`Operation failed`) | 400 E(M) |
| PATCH `/employees/[id]` | 500 E(`Failed to update employee`) | 400 E(M) |
| POST `/employees/import` | 500 E(`Operation failed`) | 400 E(M) |
| POST `/email-request` | 500 F(`Operation failed`) | 400 F(M) |
| PUT `/leave/approvers` | 500 E(`Failed to update approvers`) | 400 E(M) |
| POST `/stock/items` | 500 E(`Internal server error`) | 400 E(M) |
| PATCH `/stock/items/[id]` | 500 E(`Internal server error`) | 400 E(M) |
| POST `/stock/items/[id]/adjust` | 500 E(`Internal server error`) | 400 E(M) |
| POST `/stock/categories` | 500 E(`Internal server error`) | 400 E(M) |
| `app/api/it/operator/_lib/mutation.ts`: PATCH `/it/operator/tickets/[ticketId]/{status,priority,assignee,category}` | 400 F(M) | Identical 400 F(M) |
| `app/api/authorization/administration/_lib/mutation-route.ts`: administration JSON mutations listed below | 400 `{"error":"Bad request","code":"INVALID_INPUT"}` | Byte-identical; explicit message override |

Administration consumers (13 handlers): POST `/authorization/administration`; PATCH `/authorization/administration/teams/[id]`; POST `teams/[id]/members`; PATCH `teams/[id]/members/[userId]`; POST `teams/[id]/roles`; PATCH `teams/[id]/roles/[roleId]`; POST and PATCH `teams/[id]/grants`; POST and PATCH `teams/[id]/roles/[roleId]/grants`; POST and PATCH `users/[id]/grants`; PATCH `users/[id]/system-role`. All abbreviated paths share `/authorization/administration/`.

## Other JSON readers and their route consumers

| Reader / routes | Previous malformed status/body | New malformed status/body |
| --- | --- | --- |
| POST `/announcements/manage` (direct bounded reader) | 400 E(`Bad request`) | 400 E(M) |
| PATCH `/email-request/[id]/access-requirements` (direct bounded reader) | 400 E(`ข้อมูลคำร้องไม่ถูกต้อง`) | 400 E(M) |
| `modules/routine/server/http.ts`: POST `/routines/tasks`, PATCH `/routines/tasks/[id]`, PATCH `/routines/occurrences/[id]`, PATCH `/routines/occurrences/[id]/assignees`, PATCH `/routines/occurrences/[id]/due-date`, POST `/line/routine/tasks`, PATCH `/line/routine/tasks/[id]` | 400 E(`ข้อมูล NHF Routine ไม่ถูกต้อง`) | 400 E(M) |
| `modules/leave/server/http.ts`: POST and PUT `/leave/cancel`, POST `/leave/decision`, POST and PUT `/line/leave/cancel`, POST `/line/leave/decision` | 400 E(`ข้อมูลไม่ถูกต้อง`) | 400 E(M) |
| `modules/leave/application/requests/request-input.ts`: POST `/leave/request`, POST `/line/leave/request` (JSON / legacy text body) | 400 E(`Invalid input`) | 400 E(M) |
| `modules/stock/presentation/stock-api.ts`: POST `/stock/requests`, `/stock/requests/[id]/review`, `/stock/requests/[id]/issue`, `/stock/requests/[id]/cancel`, `/line/stock/requests`, `/line/stock/requests/[id]/issue`, `/line/stock/requests/[id]/cancel` | 400 E(`ข้อมูลไม่ถูกต้อง`) | 400 E(M) |
| `modules/it/presentation/http/ticket-create-request.ts`: POST `/it/tickets`, `/line/it/tickets` (JSON branch) | 400 F(M) | Identical 400 F(M) |
| `modules/it/presentation/http/comment-request.ts`: POST `/it/tickets/[ticketId]/comments`, `/it/operator/tickets/[ticketId]/comments`, `/line/it/tickets/[ticketId]/comments` (JSON branch) | 400 F(M) | Identical 400 F(M) |
| `modules/line/presentation/http.ts`: POST `/line/account-link`, `/line/liff/session` (previous custom bounded stream + JSON.parse) | 400 E(`Bad request`) | 400 E(M) |

All JSON readers above now delegate to `readRouteJsonBody`. The Leave application parser adapts its failure back to the existing typed `LeaveRequestInputError` boundary: INVALID_JSON is constructed as status 400 with M; TOO_LARGE remains 413. Its server adapter forwards that typed error without changing the message. The LINE webhook is excluded and untouched.

## Multipart/form classification (unchanged contracts)

| Reader / routes | Previous invalid-body response | New response |
| --- | --- | --- |
| Leave request parser: POST `/leave/request`, `/line/leave/request`; unreadable/malformed form, missing payload or malformed JSON inside the multipart payload field | 400 E(`Invalid input`); invalid attachment field: 400 E(`ไฟล์แนบไม่ถูกต้อง`) | Unchanged; these are form failures, not readBoundedJsonBody INVALID_JSON |
| IT create/comment parsers: routes above, multipart branch; unreadable form, parser failure, duplicate/unknown fields | 400 F(M) | Unchanged; hard-coded M is replaced by the shared constant |
| POST `/uploads/image`: bounded multipart reader | 400 E(M) | Unchanged; storage failures remain 500 |

No malformed multipart/form branch returns 5xx. Schema/attachment validation errors and unsupported content types are unchanged. IT creation's existing 415 message also uses the constant without changing its bytes.

## Side-effect ordering audit

For every inventory consumer, malformed input returns before business mutation, DB writes, idempotency reservation, audit append, attachment persistence or outbox enqueue/wakeup. Existing authentication, workforce identity and capability checks before body reads only perform reads/validation. Idempotency header parsing before body reads validates a string; it does not reserve a key. Leave submission checks capability, parses input, then saves attachments and calls createLeaveRequest; no attachment is saved on JSON parse failure. Authorization administration, Routine, Stock, IT and employee commands are all after parsing. LINE token verification, linking and session-cookie issuance remain after parsing.

Existing process-local IP/principal rate-limit counters are intentionally consumed at their existing positions, sometimes before parsing. No new rate-limit commit, reservation, release or reordering is introduced.

Auth was inspected individually:

| Route | State on malformed JSON (unchanged) |
| --- | --- |
| hybrid-login | Existing pre-auth IP counter consumed; no reserveAuthAttempt call, auth DB lookup, refresh-token creation or audit append |
| signup | No recordAuthAttempt call, account creation or audit append |
| forgot-password | No reserveAuthAttempt call, password-reset token operation or email scheduling; no identity/account information in response |
| reset-password | No reset-token lookup/claim, password write, session revocation or audit append |
| sessions/revoke | Existing authentication reads only; no revocation write, audit append or cookie clearing |

## Intentional contract changes and browser check

The API client and Auth browser transport map 400 to VALIDATION_ERROR and 5xx to INTERNAL_ERROR; Thai server messages are preserved. Their retry rules apply only to safe reads, so these mutation requests gain no retry. LIFF IT and operator presentation code distinguishes 5xx recovery, but its malformed responses were already 400 and remain identical. No additional browser branch on INTERNAL_ERROR/VALIDATION_ERROR changes an affected mutation flow.

Two visible malformed-input behaviors are intentionally approved, with comments and regression tests; there is no UI logic change:

- Employee creation: 400 leaves the form editable; 500 retains the unresolved outcome and locks it for reconciliation.
- Email request creation: 400 unlocks the form and discards the pending payload/idempotency key (the next attempt gets a new key); 500 retains the original payload/key and locks edits for safe retry. The existing 409 handling stays unchanged.

Both send JSON.stringify output during normal UI use. This approval is safe specifically because malformed JSON is rejected before persistence. It does not redefine every possible 4xx response across unrelated endpoints as proof that nothing was persisted.

## Regression guarantees and limits

The shared helper accepts extra envelope data, never a response/status factory. It hardcodes HTTP 400 for INVALID_JSON. `error?: never` excludes message injection from typed details, and the helper also overwrites an injected error at runtime. The only message override is the literal type `"Bad request"` for the administration contract; it cannot change status. Typecheck covers every caller. Helper tests cover empty/malformed JSON, unreadable streams, invalid UTF-8, message injection, the administration override, valid Thai input and oversized bodies. Route tests cover malformed/413/valid input and retain all non-malformed 500 assertions, including the employee-import parsed `null` case.

Byte-response assertions pin the existing IT operator and administration contracts. Module reader tests cover the remaining HTTP adapters and Leave input parser. Hook tests pin both 400 and 500 behavior. Authentication tests assert the absence of auth reservations/writes/audit where appropriate. Existing 413 messages/envelopes remain intact, including announcement `ข้อความมีขนาดใหญ่เกินไป` and email-access streamed-body `ข้อมูลคำร้องไม่ถูกต้อง`.

This intentionally changes error messages as well as status for clients sending malformed JSON; external clients depending on the old messages/500 classification must adapt. No E2E/UAT or production deployment is implied by these tests. Merge remains owner-only.
