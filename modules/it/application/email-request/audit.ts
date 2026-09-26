import type { AuditDetails } from "@/modules/audit";
import type { CreateEmailRequestData, UserContext } from "./types";

export interface EmailRequestCreationAuditEvent {
    readonly action: "EMAIL_REQUEST";
    readonly entityType: "EmailRequest";
    readonly entityId: number;
    readonly userId: number;
    readonly userEmail: string;
    readonly details: AuditDetails;
}

export function buildEmailRequestCreationAuditEvent(
    data: CreateEmailRequestData,
    actor: Pick<UserContext, "id" | "email">,
    emailRequestId: number,
): EmailRequestCreationAuditEvent {
    return {
        action: "EMAIL_REQUEST",
        entityType: "EmailRequest",
        entityId: emailRequestId,
        userId: actor.id,
        userEmail: actor.email,
        details: {
            after: {
                thaiName: data.thaiName,
                englishName: data.englishName,
                position: data.position,
                department: data.department,
                needsDocumentSystem: data.needsDocumentSystem,
                sharedDriveAccess: data.sharedDriveAccess,
            },
        },
    };
}
