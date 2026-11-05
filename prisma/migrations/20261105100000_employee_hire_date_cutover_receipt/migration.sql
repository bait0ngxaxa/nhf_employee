-- Durable one-time receipt, outside the audit log's 90-day retention.
-- No employee data is changed by this migration.
CREATE TABLE employee_hire_date_cutover (
    id INTEGER NOT NULL,
    completedAt DATETIME(3) NOT NULL,
    operatorEmail VARCHAR(191) NOT NULL,
    backupReference VARCHAR(255) NOT NULL,
    employeeCount INTEGER NOT NULL,
    clearedCount INTEGER NOT NULL,
    originalValues JSON NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT employee_hire_date_cutover_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
