import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

import { isBootstrapAdminEmail } from "@/lib/ssot/admin-bootstrap";
import {
    findSignupEmployee,
    getEmployeeDisplayName,
    getEmployeeFullName,
    hasEligibleEmployeeLifecycle,
    lockAndRecheckSignupEmployee,
} from "@/modules/employee";
import { runSerializableTransaction } from "@/lib/db/transaction";
import {
    createAuthAccount,
    findAccountByEmail,
} from "../infrastructure/persistence/account-repository";
import { toSignupResult } from "./authentication";
import type { SignupResult } from "./types";

export class SignupEligibilityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SignupEligibilityError";
    }
}

export async function signupAccount(input: {
    email: string;
    password: string;
    employeeNotFoundMessage: string;
    emailAlreadyUsedMessage: string;
}): Promise<SignupResult> {
    const existingUser = await findAccountByEmail(input.email);
    if (existingUser) {
        throw new SignupEligibilityError(input.emailAlreadyUsedMessage);
    }

    const matchedEmployee = await findSignupEmployee(input.email);
    if (!matchedEmployee || !hasEligibleEmployeeLifecycle(matchedEmployee)) {
        throw new SignupEligibilityError(input.employeeNotFoundMessage);
    }
    if (matchedEmployee.user) {
        throw new SignupEligibilityError(input.emailAlreadyUsedMessage);
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);
    const result = await runSerializableTransaction(async (tx) => {
        const lockedEmployee = await lockAndRecheckSignupEmployee(
            tx,
            matchedEmployee.id,
            input.email,
        );
        if (!lockedEmployee) {
            throw new SignupEligibilityError(input.employeeNotFoundMessage);
        }
        if (lockedEmployee.user) {
            throw new SignupEligibilityError(input.emailAlreadyUsedMessage);
        }

        const lockedEmployeeName = getEmployeeFullName(
            lockedEmployee.firstName,
            lockedEmployee.lastName,
        );
        const lockedEmployeeRole = isBootstrapAdminEmail(lockedEmployee.email)
            ? Role.ADMIN
            : Role.USER;
        const user = await createAuthAccount(tx, {
            name: lockedEmployeeName,
            email: lockedEmployee.email,
            password: hashedPassword,
            role: lockedEmployeeRole,
            employeeId: lockedEmployee.id,
        });

        return {
            user,
            assignedRole: lockedEmployeeRole,
            employeeDisplayName: getEmployeeDisplayName(lockedEmployee),
        };
    });

    return toSignupResult(result.user, result.employeeDisplayName);
}
