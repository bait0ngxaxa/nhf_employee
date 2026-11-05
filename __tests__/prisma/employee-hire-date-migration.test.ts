import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
    resolve(
        process.cwd(),
        "prisma/migrations/20261105090000_employee_hire_date_nullable/migration.sql",
    ),
    "utf8",
);
const remediation = readFileSync(
    resolve(process.cwd(), "scripts/employee-hire-date-legacy-remediation.sql"),
    "utf8",
);

describe("Employee hire date migration contract", () => {
    it("defines a nullable date-only field without an automatic default", () => {
        const employeeModel = schema.match(/model Employee \{([\s\S]*?)^\}/m)?.[1];

        expect(employeeModel).toMatch(/hireDate\s+DateTime\?\s+@db\.Date/);
        expect(employeeModel).not.toMatch(/hireDate\s+DateTime\?\s+@db\.Date\s+@default/);
    });

    it("makes the existing column nullable and date-only without clearing legacy rows", () => {
        expect(migration).toMatch(/ALTER TABLE employees\s+MODIFY hireDate DATE NULL/i);
        expect(migration).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE)\s+(?:FROM\s+)?employees\b/i);
    });

    it("gates remediation and restricts clears to explicitly reviewed, unchanged rows", () => {
        expect(remediation).toMatch(/SET @apply_employee_hire_date_remediation = 0/);
        expect(remediation).toMatch(/CREATE TEMPORARY TABLE approved_employee_hire_date_clears/);
        expect(remediation).toMatch(/r\.expected_hire_date = e\.hireDate/);
        expect(remediation).toMatch(/INSERT INTO audit_logs/);
        expect(remediation).toMatch(/SET e\.hireDate = NULL/);
    });
});
