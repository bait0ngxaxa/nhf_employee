-- Preserve historical audit rows while removing lifecycle-only action values.
UPDATE `audit_logs`
SET `action` = 'ROUTINE_TASK_UPDATE'
WHERE `action` IN (
    'ROUTINE_OCCURRENCE_START',
    'ROUTINE_OCCURRENCE_COMPLETE',
    'ROUTINE_OCCURRENCE_SKIP',
    'ROUTINE_OCCURRENCE_CANCEL',
    'ROUTINE_OCCURRENCE_REOPEN'
);

ALTER TABLE `audit_logs`
    MODIFY `action` ENUM(
        'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE', 'PASSWORD_RESET',
        'EMPLOYEE_CREATE', 'EMPLOYEE_UPDATE', 'EMPLOYEE_DELETE', 'EMPLOYEE_STATUS_CHANGE', 'EMPLOYEE_IMPORT',
        'TICKET_CREATE', 'TICKET_UPDATE', 'TICKET_STATUS_CHANGE', 'TICKET_ASSIGN', 'TICKET_COMMENT', 'TICKET_DELETE',
        'LEAVE_REQUEST_CREATE', 'LEAVE_REQUEST_APPROVE', 'LEAVE_REQUEST_REJECT', 'LEAVE_REQUEST_CANCEL',
        'LEAVE_REQUEST_CANCELLATION_REQUEST', 'LEAVE_REQUEST_CANCELLATION_CONFIRM',
        'LEAVE_REQUEST_NOT_TAKEN_REQUEST', 'LEAVE_REQUEST_NOT_TAKEN_CONFIRM',
        'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_ROLE_CHANGE',
        'STOCK_ITEM_CREATE', 'STOCK_ITEM_UPDATE', 'STOCK_ITEM_DELETE', 'STOCK_ADJUST',
        'STOCK_REQUEST_CREATE', 'STOCK_REQUEST_APPROVE', 'STOCK_REQUEST_REJECT',
        'STOCK_CATEGORY_CREATE', 'STOCK_CATEGORY_DELETE', 'SETTINGS_UPDATE', 'DATA_EXPORT', 'EMAIL_REQUEST',
        'ROUTINE_TASK_CREATE', 'ROUTINE_TASK_UPDATE', 'ROUTINE_TASK_DEACTIVATE',
        'ROUTINE_OCCURRENCE_REASSIGN', 'ROUTINE_OCCURRENCE_DUE_DATE_CHANGE',
        'ROUTINE_IMPORT_UPLOAD', 'ROUTINE_IMPORT_ROW_UPDATE', 'ROUTINE_IMPORT_APPLY', 'ROUTINE_IMPORT_CANCEL'
    ) NOT NULL;

-- Imported rows are active by default; the old activation selector is no longer a decision point.
UPDATE `routine_import_rows`
SET `proposedActivation` = 'ACTIVE';

ALTER TABLE `routine_import_rows`
    MODIFY `proposedActivation` ENUM('ACTIVE') NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE `routine_import_batches`
    DROP COLUMN `activeRows`,
    DROP COLUMN `inactiveRows`,
    DROP COLUMN `expiredRows`;

ALTER TABLE `routine_occurrences`
    DROP FOREIGN KEY `routine_occurrences_completedById_fkey`,
    DROP FOREIGN KEY `routine_occurrences_skippedById_fkey`,
    DROP FOREIGN KEY `routine_occurrences_cancelledById_fkey`;

ALTER TABLE `routine_occurrences`
    DROP INDEX `routine_occurrences_status_dueDate_idx`,
    DROP INDEX `routine_occurrences_taskId_status_idx`,
    DROP INDEX `routine_occurrences_completedAt_idx`,
    DROP COLUMN `status`,
    DROP COLUMN `startedAt`,
    DROP COLUMN `completedAt`,
    DROP COLUMN `completedById`,
    DROP COLUMN `completionNote`,
    DROP COLUMN `referenceNo`,
    DROP COLUMN `skippedAt`,
    DROP COLUMN `skippedById`,
    DROP COLUMN `skipReason`,
    DROP COLUMN `cancelledAt`,
    DROP COLUMN `cancelledById`,
    DROP COLUMN `cancellationReason`;
