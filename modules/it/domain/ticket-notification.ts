import { z } from "zod";

const positiveDatabaseIdSchema = z.number().int().positive().max(2_147_483_647);

const itTicketNotificationSourceSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("EVENT"),
        id: positiveDatabaseIdSchema,
    }).strict(),
    z.object({
        kind: z.literal("COMMENT"),
        id: z.string().min(1).max(30),
    }).strict(),
]);

const itTicketNotificationPayloadBaseSchema = z.object({
    version: z.literal(1),
    event: z.enum([
        "CREATED",
        "ASSIGNED",
        "OPERATOR_COMMENTED",
        "REQUESTER_COMMENTED",
        "WAITING_REQUESTER",
        "RESOLVED",
        "PRIORITY_ESCALATED",
    ]),
    priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
    ticketId: positiveDatabaseIdSchema,
    recipientUserId: positiveDatabaseIdSchema,
    audience: z.enum(["REQUESTER", "ASSIGNEE", "OPERATOR_QUEUE"]),
    source: itTicketNotificationSourceSchema,
}).strict();

export const itTicketNotificationPayloadSchema =
    itTicketNotificationPayloadBaseSchema.superRefine((payload, context) => {
        const eventUsesEventSource = payload.event === "CREATED"
            || payload.event === "ASSIGNED"
            || payload.event === "WAITING_REQUESTER"
            || payload.event === "RESOLVED"
            || payload.event === "PRIORITY_ESCALATED";
        const audienceIsValid = payload.event === "CREATED"
            ? payload.audience === "OPERATOR_QUEUE"
            : payload.event === "ASSIGNED"
                ? payload.audience === "ASSIGNEE"
                : payload.event === "OPERATOR_COMMENTED"
                    || payload.event === "WAITING_REQUESTER"
                    || payload.event === "RESOLVED"
                    ? payload.audience === "REQUESTER"
                    : payload.event === "PRIORITY_ESCALATED"
                        ? payload.audience === "ASSIGNEE"
                            || payload.audience === "OPERATOR_QUEUE"
                    : payload.audience === "ASSIGNEE"
                        || payload.audience === "OPERATOR_QUEUE";
        const priorityAudienceIsValid = payload.event !== "PRIORITY_ESCALATED"
            || (payload.priority === "P0" && payload.audience === "OPERATOR_QUEUE")
            || (payload.priority === "P1"
                && (payload.audience === "ASSIGNEE"
                    || payload.audience === "OPERATOR_QUEUE"));

        if ((payload.source.kind === "EVENT") !== eventUsesEventSource) {
            context.addIssue({
                code: "custom",
                path: ["source", "kind"],
                message: "IT Ticket notification source does not match event",
            });
        }
        if (!audienceIsValid || !priorityAudienceIsValid) {
            context.addIssue({
                code: "custom",
                path: ["audience"],
                message: "IT Ticket notification audience does not match event",
            });
        }
        if ((payload.event === "PRIORITY_ESCALATED") !== (payload.priority !== undefined)) {
            context.addIssue({
                code: "custom",
                path: ["priority"],
                message: "Priority is required only for priority escalation events",
            });
        }
    });

export type ITTicketNotificationPayloadV1 = z.infer<
    typeof itTicketNotificationPayloadSchema
>;

export type ITTicketLineNotificationPayload = ITTicketNotificationPayloadV1 & {
    readonly event:
        | "CREATED"
        | "ASSIGNED"
        | "OPERATOR_COMMENTED"
        | "REQUESTER_COMMENTED"
        | "WAITING_REQUESTER"
        | "RESOLVED"
        | "PRIORITY_ESCALATED";
};

/** Explicit channel policy. Keep this aligned with the approved IT event matrix. */
export function isITTicketLineNotification(
    payload: ITTicketNotificationPayloadV1,
): payload is ITTicketLineNotificationPayload {
    switch (payload.event) {
        case "CREATED":
            return payload.audience === "OPERATOR_QUEUE";
        case "ASSIGNED":
            return payload.audience === "ASSIGNEE";
        case "OPERATOR_COMMENTED":
        case "WAITING_REQUESTER":
        case "RESOLVED":
            return payload.audience === "REQUESTER";
        case "PRIORITY_ESCALATED":
            return payload.audience === "ASSIGNEE"
                || payload.audience === "OPERATOR_QUEUE";
        case "REQUESTER_COMMENTED":
            return payload.audience === "ASSIGNEE"
                || payload.audience === "OPERATOR_QUEUE";
    }
}

export function parseITTicketNotificationPayload(
    payload: unknown,
): ITTicketNotificationPayloadV1 {
    const parsed = itTicketNotificationPayloadSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error("Invalid IT Ticket notification payload");
    }
    return parsed.data;
}

export function buildITTicketNotificationEventKey(
    payload: ITTicketNotificationPayloadV1,
): string {
    const sourceKind = payload.source.kind === "EVENT" ? "event" : "comment";
    return `it:ticket:${payload.ticketId}:${sourceKind}:${payload.source.id}:user:${payload.recipientUserId}:in-app`;
}

export function buildITTicketLineEventKey(
    payload: ITTicketNotificationPayloadV1,
): string {
    const sourceKind = payload.source.kind === "EVENT" ? "event" : "comment";
    return `it:ticket:${payload.ticketId}:${sourceKind}:${payload.source.id}:user:${payload.recipientUserId}:line`;
}

export function buildITTicketEmailEventKey(
    payload: ITTicketNotificationPayloadV1,
): string {
    const sourceKind = payload.source.kind === "EVENT" ? "event" : "comment";
    return `it:ticket:${payload.ticketId}:${sourceKind}:${payload.source.id}:user:${payload.recipientUserId}:email`;
}
