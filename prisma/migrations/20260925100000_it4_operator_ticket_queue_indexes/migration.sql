-- IT4 serves the unfiltered operator queue and assignment-state filters in
-- stable createdAt/id order. Other IT4 filters use existing IT2 indexes.
CREATE INDEX `it_tickets_createdAt_id_idx`
    ON `it_tickets` (`createdAt`, `id`);

CREATE INDEX `it_tickets_assignedToUserId_createdAt_id_idx`
    ON `it_tickets` (`assignedToUserId`, `createdAt`, `id`);
