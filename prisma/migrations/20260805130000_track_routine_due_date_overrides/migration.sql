-- Track explicit Admin due-date overrides separately from business-day adjustments.
ALTER TABLE `routine_occurrences`
    ADD COLUMN `isDueDateOverridden` BOOLEAN NOT NULL DEFAULT false AFTER `originalDueDate`;

-- Backfill only audit events whose payload confirms that the due date changed.
-- Assignee-only atomic overrides use the same audit action and must remain false.
UPDATE `routine_occurrences` AS `occurrence`
SET `occurrence`.`isDueDateOverridden` = true
WHERE EXISTS (
    SELECT 1
    FROM `audit_logs` AS `audit`
    WHERE `audit`.`action` = 'ROUTINE_OCCURRENCE_DUE_DATE_CHANGE'
      AND `audit`.`entityType` = 'RoutineOccurrence'
      AND `audit`.`entityId` = `occurrence`.`id`
      AND CASE
          WHEN `audit`.`details` IS NULL OR JSON_VALID(`audit`.`details`) = 0
              THEN false
          WHEN JSON_UNQUOTE(JSON_EXTRACT(`audit`.`details`, '$.oldDueDate')) IS NOT NULL
            AND JSON_UNQUOTE(JSON_EXTRACT(`audit`.`details`, '$.newDueDate')) IS NOT NULL
              THEN JSON_UNQUOTE(JSON_EXTRACT(`audit`.`details`, '$.oldDueDate'))
                  <> JSON_UNQUOTE(JSON_EXTRACT(`audit`.`details`, '$.newDueDate'))
          WHEN JSON_UNQUOTE(JSON_EXTRACT(`audit`.`details`, '$.before.dueDate')) IS NOT NULL
            AND JSON_UNQUOTE(JSON_EXTRACT(`audit`.`details`, '$.after.dueDate')) IS NOT NULL
              THEN JSON_UNQUOTE(JSON_EXTRACT(`audit`.`details`, '$.before.dueDate'))
                  <> JSON_UNQUOTE(JSON_EXTRACT(`audit`.`details`, '$.after.dueDate'))
          ELSE false
      END
);
