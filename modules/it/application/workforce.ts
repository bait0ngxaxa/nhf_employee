import type { Prisma } from "@prisma/client";

import {
    findCurrentEmployeeProjection,
    getCurrentWorkforceDepartmentSnapshotInTransaction,
    type CurrentWorkforceDepartmentSnapshot,
} from "@/modules/employee";

import type { ITAuthorizationChannel, ITAuthorizationContext } from "./authorization";
import { buildITAuthorizationContext } from "./authorization";
import { ITWorkforceDeniedError } from "./ticket-errors";

/** Builds IT identity from a trusted authenticated account and current Employee link. */
export async function buildCurrentITAuthorizationContext(
    user: { readonly id: number; readonly role: string },
    channel: ITAuthorizationChannel = "DASHBOARD",
): Promise<ITAuthorizationContext> {
    const employee = await findCurrentEmployeeProjection(user.id);
    if (employee === null) throw new ITWorkforceDeniedError();

    return buildITAuthorizationContext(user, employee.id, channel);
}

/** Revalidates that the trusted actor still has the same active workforce identity. */
export async function assertITActorCurrentWorkforce(
    tx: Prisma.TransactionClient,
    context: ITAuthorizationContext,
): Promise<CurrentWorkforceDepartmentSnapshot> {
    const actor = context.authorizationActor;
    const workforce = await getCurrentWorkforceDepartmentSnapshotInTransaction(
        tx,
        actor.userId,
    );
    if (
        workforce === null
        || actor.employeeId === null
        || workforce.employeeId !== actor.employeeId
    ) {
        throw new ITWorkforceDeniedError();
    }
    return workforce;
}
