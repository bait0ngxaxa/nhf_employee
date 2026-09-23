-- Detect every duplicate after applying the canonical mapping before changing
-- persisted reminder rules. The unique key mirrors the production contract.
DROP TEMPORARY TABLE IF EXISTS _h2b_routine_reminder_collision_guard;

CREATE TEMPORARY TABLE _h2b_routine_reminder_collision_guard (
    taskId INTEGER NOT NULL,
    daysBefore INTEGER NOT NULL,
    channel ENUM('IN_APP') NOT NULL,
    canonicalScope ENUM(
        'ASSIGNEES',
        'ALL_READERS',
        'ASSIGNEES_AND_ALL_READERS'
    ) NOT NULL,
    UNIQUE INDEX h2b_collision_guard_unique (
        taskId,
        daysBefore,
        channel,
        canonicalScope
    )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO _h2b_routine_reminder_collision_guard (
    taskId,
    daysBefore,
    channel,
    canonicalScope
)
SELECT
    taskId,
    daysBefore,
    channel,
    CASE recipientScope
        WHEN 'ADMINS' THEN 'ALL_READERS'
        WHEN 'ASSIGNEES_AND_ADMINS' THEN 'ASSIGNEES_AND_ALL_READERS'
        ELSE recipientScope
    END
FROM routine_reminder_rules;

DROP TEMPORARY TABLE _h2b_routine_reminder_collision_guard;

-- Only recipientScope changes. MySQL DDL runs after all collision checks.
UPDATE routine_reminder_rules
SET recipientScope = 'ALL_READERS'
WHERE recipientScope = 'ADMINS';

UPDATE routine_reminder_rules
SET recipientScope = 'ASSIGNEES_AND_ALL_READERS'
WHERE recipientScope = 'ASSIGNEES_AND_ADMINS';

-- A duplicate primary key makes any remaining legacy row fail the migration.
DROP TEMPORARY TABLE IF EXISTS _h2b_routine_reminder_legacy_assertion;

CREATE TEMPORARY TABLE _h2b_routine_reminder_legacy_assertion (
    guardKey TINYINT NOT NULL PRIMARY KEY
);

INSERT INTO _h2b_routine_reminder_legacy_assertion (guardKey) VALUES (1);

INSERT INTO _h2b_routine_reminder_legacy_assertion (guardKey)
SELECT 1
FROM routine_reminder_rules
WHERE recipientScope IN ('ADMINS', 'ASSIGNEES_AND_ADMINS')
LIMIT 1;

DROP TEMPORARY TABLE _h2b_routine_reminder_legacy_assertion;

ALTER TABLE routine_reminder_rules
    MODIFY recipientScope ENUM(
        'ASSIGNEES',
        'ALL_READERS',
        'ASSIGNEES_AND_ALL_READERS'
    ) NOT NULL;
