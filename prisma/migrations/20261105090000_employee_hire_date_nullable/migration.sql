-- Preserve every existing calendar date while dropping the creation-time default.
-- Legacy values must be reviewed and remediated through the documented
-- operator procedure before the new UI exposes them as confirmed hire dates.
ALTER TABLE employees
    MODIFY hireDate DATE NULL;
