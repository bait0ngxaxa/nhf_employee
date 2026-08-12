-- Retire pending IT Support delivery work before removing its source tables.
-- Shared notification and audit history remains intact for historical review.
UPDATE `notification_outbox`
SET
    `status` = 'SUPERSEDED',
    `error` = 'IT Support module removed',
    `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `type` IN (
    'TICKET_CREATED',
    'TICKET_UPDATED',
    'TICKET_CREATED_IN_APP',
    'TICKET_CREATED_LINE',
    'TICKET_CREATED_EMAIL_REPORTER',
    'TICKET_CREATED_EMAIL_IT',
    'TICKET_UPDATED_IN_APP_REPORTER',
    'TICKET_UPDATED_EMAIL_REPORTER',
    'TICKET_UPDATED_LINE',
    'TICKET_COMMENT_IN_APP'
)
AND `status` IN ('PENDING', 'PROCESSING', 'FAILED');

-- Drop only IT Support-owned tables. Shared audit, notification, and outbox
-- tables and their legacy enum values are deliberately preserved.
DROP TABLE IF EXISTS `ticket_mutation_idempotency`;
DROP TABLE IF EXISTS `ticket_comments`;
DROP TABLE IF EXISTS `ticket_views`;
DROP TABLE IF EXISTS `tickets`;
