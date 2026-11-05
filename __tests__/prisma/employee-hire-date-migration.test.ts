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

    it("fails closed and records the whole cutover without individual review", () => {
        expect(remediation).toMatch(/COALESCE\(@apply_employee_hire_date_remediation, 0\)/);
        expect(remediation).toMatch(/INSERT INTO employee_hire_date_cutover/);
        expect(remediation).toMatch(/FOR UPDATE/);
        expect(remediation).toMatch(/INSERT INTO audit_logs/);
        expect(remediation).toMatch(/SET e\.hireDate = NULL, e\.updatedAt = changed_at/);
        expect(remediation).toMatch(/ROLLBACK;[\s\S]*RESIGNAL SQLSTATE '45000';/);
        expect(remediation).toMatch(/audit_count <> clear_count OR update_count <> clear_count/);
        expect(remediation).not.toMatch(/hireDate\s*=\s*createdAt|approved_employee/);
    });
});
