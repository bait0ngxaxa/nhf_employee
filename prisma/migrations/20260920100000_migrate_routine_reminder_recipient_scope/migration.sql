-- Phase 13A.1 expand step only. Keep both persisted vocabularies readable
-- during the application rollout. Backfill and enum contraction belong to a
-- later release after all old application processes are retired.
ALTER TABLE `routine_reminder_rules`
    MODIFY `recipientScope` ENUM(
        'ASSIGNEES',
        'ADMINS',
        'ASSIGNEES_AND_ADMINS',
        'ALL_READERS',
        'ASSIGNEES_AND_ALL_READERS'
    ) NOT NULL;
