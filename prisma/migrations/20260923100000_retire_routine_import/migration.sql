-- H2A: Routine Import is retired. Remove persisted grants for its capability
-- before the application stops recognizing that capability.
DELETE FROM `team_capability_grants`
WHERE `capabilityKey` = 'routine.import.manage';

DELETE FROM `team_role_capability_grants`
WHERE `capabilityKey` = 'routine.import.manage';

DELETE FROM `user_capability_grants`
WHERE `capabilityKey` = 'routine.import.manage';

-- Rows reference both batches and RoutineTask; the ledger references RoutineTask
-- and users. Drop rows first, then the ledger and batch, without touching
-- Routine domain rows.
DROP TABLE `routine_import_rows`;
DROP TABLE `routine_import_ledger`;
DROP TABLE `routine_import_batches`;

ALTER TABLE `routine_tasks`
    DROP COLUMN `sourceFileName`,
    DROP COLUMN `sourceSheet`,
    DROP COLUMN `sourceRow`;
