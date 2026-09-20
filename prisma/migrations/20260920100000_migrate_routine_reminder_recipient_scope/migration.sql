-- Expand the MySQL enum before remapping existing rows so no stored value is
-- temporarily coerced to an invalid enum member.
ALTER TABLE `routine_reminder_rules`
    MODIFY `recipientScope` ENUM(
        'ASSIGNEES',
        'ADMINS',
        'ASSIGNEES_AND_ADMINS',
        'ALL_READERS',
        'ASSIGNEES_AND_ALL_READERS'
    ) NOT NULL;

UPDATE `routine_reminder_rules`
SET `recipientScope` = CASE `recipientScope`
    WHEN 'ADMINS' THEN 'ALL_READERS'
    WHEN 'ASSIGNEES_AND_ADMINS' THEN 'ASSIGNEES_AND_ALL_READERS'
    ELSE `recipientScope`
END
WHERE `recipientScope` IN ('ADMINS', 'ASSIGNEES_AND_ADMINS');

-- Contract the enum after all historical values have been migrated.
ALTER TABLE `routine_reminder_rules`
    MODIFY `recipientScope` ENUM(
        'ASSIGNEES',
        'ALL_READERS',
        'ASSIGNEES_AND_ALL_READERS'
    ) NOT NULL;
