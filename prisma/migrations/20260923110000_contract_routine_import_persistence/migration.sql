-- H2A.2: previous Routine Import application processes have been retired.
-- Drop child staging data first; foreign keys from these tables to Routine
-- business records are removed with their owning tables.
DROP TABLE `routine_import_rows`;
DROP TABLE `routine_import_ledger`;
DROP TABLE `routine_import_batches`;

-- No index or constraint on routine_tasks references these provenance columns.
ALTER TABLE `routine_tasks`
    DROP COLUMN `sourceFileName`,
    DROP COLUMN `sourceSheet`,
    DROP COLUMN `sourceRow`;
