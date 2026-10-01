# Employee Access Requirements

Email Request remains a new-employee request, with no IT processing status. Both access decisions are independently `UNDECIDED`, `NOT_REQUIRED`, or `REQUIRED`. Shared Drive values must be empty unless its decision is `REQUIRED`, which requires one or more distinct valid drive options. Creation defaults both decisions to `UNDECIDED`. The creation schema rejects legacy/unknown fields instead of silently interpreting an old boolean as a new decision; refresh an old browser form after application cutover.

## Deployment and historical interpretation

Apply `20261001090000_email_request_access_requirements` before loading the new application. It expands the schema without dropping or changing existing columns:

- Historical document `true` becomes `REQUIRED`; `false` becomes `NOT_REQUIRED`.
- Historical nonempty drives become `REQUIRED`; SQL NULL and empty arrays become `NOT_REQUIRED`.
- `accessVersion` starts at 1 for all rows.
- Decision columns intentionally remain nullable with a NULL database default. An old application instance can still create a legacy row between migration and reload. The new application always supplies explicit decisions; it never relies on these database defaults for new requests.

`readStoredAccessRequirements` is the only persistence-boundary fallback for NULL decisions. Each NULL decision maps using the historical rules above. Explicit decisions always win. Invalid persisted drive values/contradictory explicit states fail validation rather than silently becoming another business state. Read DTOs expose resolved decisions and normalized drive values, so browser and domain code do not derive meanings from legacy booleans or empty arrays.

`needsDocumentSystem` is temporarily retained as a compatibility mirror (`documentSystemDecision === REQUIRED`). New creation and access updates maintain it. `UNDECIDED` mirrors to false for old application compatibility only; its new business meaning is exclusively the explicit decision. Shared Drive values remain in the existing JSON column, written as an empty array for the two non-required decisions.

Reload/drain all old outbox processors before admitting new access updates. The new `EMAIL_REQUEST_ACCESS_UPDATED` parent event and versioned channel payloads require the new dispatcher; retaining columns alone does not make old workers understand new events. Do not roll the application back while these events are pending without ensuring the compatible dispatcher remains available. The migration contains a backfill UPDATE: assess table size/locking and schedule it with normal production migration controls.

Once every old writer has retired, a future migration can backfill remaining NULL decisions with the same historical rules, make decisions non-nullable, and remove `needsDocumentSystem` and the boundary fallback after all consumers stop using it. Do not change remaining NULLs to `UNDECIDED`. No production migration is executed by this implementation task.

## Authorization and command

The central registry exposes `email.request.update` on Dashboard with `OWN` and `ALL`. No role defaults or automatic grants are introduced. Before enabling the editor, configure `OWN` for approved requesters and `ALL` for approved operators through existing Authorization administration. Existing `read`/`create` grants do not imply the new mutation permission. A caller with no applicable update grant is denied. Recipients remain exactly configured active `email.request.read / ALL` users.

GET projects separate `canUpdateOwnRequests` and `canUpdateAllRequests` capabilities, and `canUpdateAccessRequirements` per row using its original `requestedBy`. The UI uses the row projection; mutation authorization is resolved again inside the database transaction.

`PATCH /api/email-request/:id/access-requirements` accepts only `documentSystemDecision`, `sharedDriveDecision`, `sharedDriveAccess`, and `expectedAccessVersion`. JSON is bounded to 4 KiB, with the existing process-local IP/principal mutation rate limiter. The command validates and normalizes drive ordering. Stale versions return 409, even when the submitted state happens to match the latest state; callers reload rather than overwrite. A current-version semantic no-op returns success/current state with `changed: false`, with no mutation, version bump, history/audit append, or notification event.

## Durable history and notifications

Serializable transactions use the existing bounded transient-conflict retry helper plus an atomic `id + accessVersion` update predicate. One semantic change increments the version exactly once. The same transaction appends:

- an immutable `EmailRequestAccessChange` with request, actor ID, old/new state, new version, and timestamp (unique request/version, request deletion restricted);
- one parent outbox fact with key `email-request:<id>:access:<version>` and no employee PII;
- the existing Audit module's strict transaction-bound append with human-readable event metadata.

Generic Audit retention deletes rows after 90 days and the legacy creation audit is best-effort. Therefore Audit is not the permanent access-change history. The small domain table is independent of Audit retention and has no application update/delete command or generic revision engine. Actor IDs are retained as scalar identity snapshots, without coupling user deletion to history deletion.

The explicit update parent fans out through existing Inbox/Email/LINE infrastructure. Update Inbox dedupe and child event keys include access version; Email Message-ID and LINE retry identity also distinguish versions. Retrying one parent creates no duplicate Inbox/transport rows, while a later version can notify again. All channels use update wording, a concise request reference, and the existing Dashboard destination. No phone, reply address, or access dump is added to update notifications. Provider calls occur only in outbox dispatch, outside the mutation transaction. This guarantees one logical event/intention per version; provider delivery guarantees remain those of the existing transport infrastructure.
