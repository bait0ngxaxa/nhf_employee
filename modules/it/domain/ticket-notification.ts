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
    ]),
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
            || payload.event === "RESOLVED";
        const audienceIsValid = payload.event === "CREATED"
            ? payload.audience === "OPERATOR_QUEUE"
            : payload.event === "ASSIGNED"
                ? payload.audience === "ASSIGNEE"
                : payload.event === "OPERATOR_COMMENTED"
                    || payload.event === "WAITING_REQUESTER"
                    || payload.event === "RESOLVED"
                    ? payload.audience === "REQUESTER"
                    : payload.audience === "ASSIGNEE"
                        || payload.audience === "OPERATOR_QUEUE";

        if ((payload.source.kind === "EVENT") !== eventUsesEventSource) {
            context.addIssue({
                code: "custom",
                path: ["source", "kind"],
                message: "IT Ticket notification source does not match event",
            });
        }
        if (!audienceIsValid) {
            context.addIssue({
                code: "custom",
                path: ["audience"],
                message: "IT Ticket notification audience does not match event",
            });
        }
    });

export type ITTicketNotificationPayloadV1 = z.infer<
    typeof itTicketNotificationPayloadSchema
>;

export type ITTicketRequesterLineNotificationPayload =
    ITTicketNotificationPayloadV1 & {
        readonly audience: "REQUESTER";
        readonly event: "OPERATOR_COMMENTED" | "WAITING_REQUESTER" | "RESOLVED";
    };

export function isITTicketRequesterLineNotification(
    payload: ITTicketNotificationPayloadV1,
): payload is ITTicketRequesterLineNotificationPayload {
    return payload.audience === "REQUESTER"
        && (payload.event === "OPERATOR_COMMENTED"
            || payload.event === "WAITING_REQUESTER"
            || payload.event === "RESOLVED");
}

export function parseITTicketNotificationPayload(
    payload: unknown,
): ITTicketNotificationPayloadV1 {
    const parsed = itTicketNotificationPayloadSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error("Invalid IT_TICKET_IN_APP payload");
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
