ALTER TABLE `stock_transactions`
    MODIFY `type` ENUM('IN', 'OUT', 'ADJUST', 'OPENING_BALANCE') NOT NULL;
