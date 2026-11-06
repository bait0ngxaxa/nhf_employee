import { describe, expect, it } from "vitest";

import {
    getInitialITTicketPriority,
    isITTicketPriorityEscalation,
    isITTicketPriorityEscalationAlertableStatus,
    resolveITTicketPriorityEscalationAudience,
    selectITTicketPriorityEscalationRecipients,
} from "./ticket-priority";

describe("IT Ticket priority policy", () => {
    it("assigns the approved initial priority by Ticket type", () => {
        expect(getInitialITTicketPriority("INCIDENT")).toBe("P2");
        expect(getInitialITTicketPriority("SERVICE_REQUEST")).toBe("P3");
        expect(getInitialITTicketPriority("SUGGESTION")).toBe("P3");
    });

    it("recognizes only escalations into P0 or P1", () => {
        expect(isITTicketPriorityEscalation("P1", "P0")).toBe(true);
        expect(isITTicketPriorityEscalation("P2", "P0")).toBe(true);
        expect(isITTicketPriorityEscalation("P3", "P0")).toBe(true);
        expect(isITTicketPriorityEscalation("P2", "P1")).toBe(true);
        expect(isITTicketPriorityEscalation("P3", "P1")).toBe(true);
        expect(isITTicketPriorityEscalation("P0", "P1")).toBe(false);
        expect(isITTicketPriorityEscalation("P1", "P2")).toBe(false);
        expect(isITTicketPriorityEscalation("P3", "P3")).toBe(false);
        expect(isITTicketPriorityEscalation("P0", "P0")).toBe(false);
        expect(isITTicketPriorityEscalation("P1", "P1")).toBe(false);
        expect(isITTicketPriorityEscalation("P1", "P3")).toBe(false);
        expect(isITTicketPriorityEscalation("P0", "P2")).toBe(false);
        expect(isITTicketPriorityEscalation("P0", "P3")).toBe(false);
    });

    it("alerts escalations only for active work", () => {
        expect(isITTicketPriorityEscalationAlertableStatus("OPEN")).toBe(true);
        expect(isITTicketPriorityEscalationAlertableStatus("IN_PROGRESS")).toBe(true);
        expect(isITTicketPriorityEscalationAlertableStatus("WAITING_REQUESTER")).toBe(true);
        expect(isITTicketPriorityEscalationAlertableStatus("RESOLVED")).toBe(false);
        expect(isITTicketPriorityEscalationAlertableStatus("CLOSED")).toBe(false);
        expect(isITTicketPriorityEscalationAlertableStatus("CANCELLED")).toBe(false);
    });
});

describe("IT Ticket priority escalation recipients", () => {
    const eligible = [51, 52, 53];

    it("notifies an eligible P1 assignee only", () => {
        expect(selectITTicketPriorityEscalationRecipients({
            priority: "P1",
            assignedToUserId: 52,
            actorUserId: 51,
            eligibleOperatorUserIds: eligible,
        })).toEqual({ audience: "ASSIGNEE", recipientUserIds: [52] });
    });

    it("notifies the eligible queue for an unassigned P1", () => {
        expect(selectITTicketPriorityEscalationRecipients({
            priority: "P1",
            assignedToUserId: null,
            actorUserId: 51,
            eligibleOperatorUserIds: eligible,
        })).toEqual({ audience: "OPERATOR_QUEUE", recipientUserIds: [52, 53] });
    });

    it("falls back to the eligible queue when the P1 assignee is no longer eligible", () => {
        // 77 models an inactive, deleted, or grant-revoked assignee.
        expect(selectITTicketPriorityEscalationRecipients({
            priority: "P1",
            assignedToUserId: 77,
            actorUserId: 51,
            eligibleOperatorUserIds: eligible,
        })).toEqual({ audience: "OPERATOR_QUEUE", recipientUserIds: [52, 53] });
    });

    it("notifies every eligible operator for P0 regardless of assignment", () => {
        expect(selectITTicketPriorityEscalationRecipients({
            priority: "P0",
            assignedToUserId: 52,
            actorUserId: 51,
            eligibleOperatorUserIds: eligible,
        })).toEqual({ audience: "OPERATOR_QUEUE", recipientUserIds: [52, 53] });
    });

    it("excludes the actor, including an actor who is the P1 assignee", () => {
        expect(selectITTicketPriorityEscalationRecipients({
            priority: "P1",
            assignedToUserId: 51,
            actorUserId: 51,
            eligibleOperatorUserIds: eligible,
        })).toEqual({ audience: "ASSIGNEE", recipientUserIds: [] });
    });

    it("returns no recipient rather than manufacturing one", () => {
        expect(selectITTicketPriorityEscalationRecipients({
            priority: "P0",
            assignedToUserId: null,
            actorUserId: 51,
            eligibleOperatorUserIds: [51],
        }).recipientUserIds).toEqual([]);
        expect(selectITTicketPriorityEscalationRecipients({
            priority: "P1",
            assignedToUserId: 77,
            actorUserId: 51,
            eligibleOperatorUserIds: [],
        }).recipientUserIds).toEqual([]);
    });

    it("removes duplicate recipients from the eligible audience", () => {
        expect(selectITTicketPriorityEscalationRecipients({
            priority: "P0",
            assignedToUserId: null,
            actorUserId: 51,
            eligibleOperatorUserIds: [52, 52, 53, 53],
        }).recipientUserIds).toEqual([52, 53]);
    });

    it("re-resolves the current audience from assignment and eligibility", () => {
        const operators = new Set([52]);
        expect(resolveITTicketPriorityEscalationAudience({
            priority: "P1", assignedToUserId: 52, eligibleOperatorUserIds: operators,
        })).toBe("ASSIGNEE");
        expect(resolveITTicketPriorityEscalationAudience({
            priority: "P1", assignedToUserId: 77, eligibleOperatorUserIds: operators,
        })).toBe("OPERATOR_QUEUE");
        expect(resolveITTicketPriorityEscalationAudience({
            priority: "P0", assignedToUserId: 52, eligibleOperatorUserIds: operators,
        })).toBe("OPERATOR_QUEUE");
    });
});
