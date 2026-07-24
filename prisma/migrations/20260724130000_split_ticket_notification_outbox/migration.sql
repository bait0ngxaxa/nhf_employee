ALTER TABLE `notification_outbox`
    ADD COLUMN `eventKey` VARCHAR(191) NULL;

UPDATE `notification_outbox`
SET `eventKey` = CONCAT('legacy:', `id`);

ALTER TABLE `notification_outbox`
    ADD UNIQUE INDEX `notification_outbox_eventKey_key` (`eventKey`);

ALTER TABLE `notification_outbox`
    MODIFY `type` ENUM(
        'TICKET_CREATED',
        'TICKET_UPDATED',
        'TICKET_CREATED_IN_APP',
        'TICKET_CREATED_LINE',
        'TICKET_CREATED_EMAIL_REPORTER',
        'TICKET_CREATED_EMAIL_IT',
        'TICKET_UPDATED_IN_APP_REPORTER',
        'TICKET_UPDATED_EMAIL_REPORTER',
        'TICKET_UPDATED_LINE',
        'TICKET_COMMENT_IN_APP',
        'EMAIL_REQUEST',
        'LEAVE_ACTION',
        'LEAVE_RESULT',
        'LEAVE_CANCELLED',
        'LEAVE_NOT_TAKEN_REQUESTED',
        'LEAVE_NOT_TAKEN_CONFIRMED',
        'STOCK_REQUEST_LINE',
        'STOCK_LOW_LINE'
    ) NOT NULL;

INSERT IGNORE INTO `notification_outbox`
    (`type`, `eventKey`, `payload`, `status`, `attempts`, `nextAttemptAt`, `error`, `createdAt`, `updatedAt`)
SELECT
    split_event.`type`,
    split_event.`eventKey`,
    split_event.`payload`,
    'PENDING',
    0,
    NOW(),
    NULL,
    split_event.`createdAt`,
    NOW()
FROM (
    SELECT
        'TICKET_CREATED_IN_APP' AS `type`,
        CONCAT('ticket:', JSON_UNQUOTE(JSON_EXTRACT(`payload`, '$.ticketId')), ':created:in-app:admins') AS `eventKey`,
        `payload`,
        `createdAt`
    FROM `notification_outbox`
    WHERE `type` = 'TICKET_CREATED' AND `status` IN ('PENDING', 'FAILED')

    UNION ALL

    SELECT
        'TICKET_CREATED_LINE',
        CONCAT('ticket:', JSON_UNQUOTE(JSON_EXTRACT(`payload`, '$.ticketId')), ':created:line:it'),
        `payload`,
        `createdAt`
    FROM `notification_outbox`
    WHERE `type` = 'TICKET_CREATED' AND `status` IN ('PENDING', 'FAILED')

    UNION ALL

    SELECT
        'TICKET_CREATED_EMAIL_REPORTER',
        CONCAT(
            'ticket:',
            JSON_UNQUOTE(JSON_EXTRACT(outbox.`payload`, '$.ticketId')),
            ':created:email:reporter:',
            ticket.`reportedById`
        ),
        outbox.`payload`,
        outbox.`createdAt`
    FROM `notification_outbox` AS outbox
    INNER JOIN `tickets` AS ticket
        ON ticket.`id` = CAST(JSON_UNQUOTE(JSON_EXTRACT(outbox.`payload`, '$.ticketId')) AS UNSIGNED)
    WHERE outbox.`type` = 'TICKET_CREATED' AND outbox.`status` IN ('PENDING', 'FAILED')

    UNION ALL

    SELECT
        'TICKET_CREATED_EMAIL_IT',
        CONCAT('ticket:', JSON_UNQUOTE(JSON_EXTRACT(outbox.`payload`, '$.ticketId')), ':created:email:it'),
        outbox.`payload`,
        outbox.`createdAt`
    FROM `notification_outbox` AS outbox
    INNER JOIN `tickets` AS ticket
        ON ticket.`id` = CAST(JSON_UNQUOTE(JSON_EXTRACT(outbox.`payload`, '$.ticketId')) AS UNSIGNED)
    WHERE outbox.`type` = 'TICKET_CREATED'
        AND outbox.`status` IN ('PENDING', 'FAILED')
        AND ticket.`priority` IN ('HIGH', 'URGENT')

    UNION ALL

    SELECT
        'TICKET_UPDATED_IN_APP_REPORTER',
        CONCAT(
            'ticket:',
            ticket.`id`,
            ':status:',
            DATE_FORMAT(ticket.`updatedAt`, '%Y%m%d%H%i%s%f'),
            ':in-app:reporter:',
            ticket.`reportedById`
        ),
        outbox.`payload`,
        outbox.`createdAt`
    FROM `notification_outbox` AS outbox
    INNER JOIN `tickets` AS ticket
        ON ticket.`id` = CAST(JSON_UNQUOTE(JSON_EXTRACT(outbox.`payload`, '$.ticketId')) AS UNSIGNED)
    WHERE outbox.`type` = 'TICKET_UPDATED' AND outbox.`status` IN ('PENDING', 'FAILED')

    UNION ALL

    SELECT
        'TICKET_UPDATED_EMAIL_REPORTER',
        CONCAT(
            'ticket:',
            ticket.`id`,
            ':status:',
            DATE_FORMAT(ticket.`updatedAt`, '%Y%m%d%H%i%s%f'),
            ':email:reporter:',
            ticket.`reportedById`
        ),
        outbox.`payload`,
        outbox.`createdAt`
    FROM `notification_outbox` AS outbox
    INNER JOIN `tickets` AS ticket
        ON ticket.`id` = CAST(JSON_UNQUOTE(JSON_EXTRACT(outbox.`payload`, '$.ticketId')) AS UNSIGNED)
    WHERE outbox.`type` = 'TICKET_UPDATED' AND outbox.`status` IN ('PENDING', 'FAILED')

    UNION ALL

    SELECT
        'TICKET_UPDATED_LINE',
        CONCAT(
            'ticket:',
            ticket.`id`,
            ':status:',
            DATE_FORMAT(ticket.`updatedAt`, '%Y%m%d%H%i%s%f'),
            ':line:it'
        ),
        outbox.`payload`,
        outbox.`createdAt`
    FROM `notification_outbox` AS outbox
    INNER JOIN `tickets` AS ticket
        ON ticket.`id` = CAST(JSON_UNQUOTE(JSON_EXTRACT(outbox.`payload`, '$.ticketId')) AS UNSIGNED)
    WHERE outbox.`type` = 'TICKET_UPDATED' AND outbox.`status` IN ('PENDING', 'FAILED')
) AS split_event;

UPDATE `notification_outbox`
SET `status` = 'SUPERSEDED'
WHERE `type` IN ('TICKET_CREATED', 'TICKET_UPDATED')
    AND `status` IN ('PENDING', 'FAILED');
