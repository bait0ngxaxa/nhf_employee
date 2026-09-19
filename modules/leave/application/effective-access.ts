import {
    composeLegacyAdminCompatibleAuthorizationAuthority,
    projectAuthorizationAdministrationEffectiveAccess,
    type AuthorizationActor,
    type AuthorizationAdministrationEffectiveAccessInspection,
    type AuthorizationAdministrationInspectionContext,
    type AuthorizationDecision,
} from "@/modules/authorization";

import {
    defaultLeaveScopes,
    LEAVE_CAPABILITIES,
    type LeaveAuthorizationActor,
    type LeaveCapability,
} from "./authorization";

const DASHBOARD_CONTEXT: AuthorizationAdministrationInspectionContext = Object.freeze({
    key: "dashboard",
    label: "Dashboard",
    channel: "DASHBOARD",
});

const LIFF_CONTEXT: AuthorizationAdministrationInspectionContext = Object.freeze({
    key: "liff.self-service",
    label: "LIFF · Self service",
    channel: "LIFF_SELF_SERVICE",
});

const LIMITATIONS: Readonly<
    Record<LeaveCapability, readonly { readonly code: string; readonly label: string }[]>
> = Object.freeze({
    "leave.request.read": Object.freeze([
        Object.freeze({
            code: "leave.request.relationship",
            label: "OWN ยังต้องเป็นเจ้าของคำขอจริงและผ่าน Leave relationship rules",
        }),
    ]),
    "leave.approval.read": Object.freeze([
        Object.freeze({
            code: "leave.effective_approver",
            label: "ASSIGNED ยังต้องเป็น effective approver ตาม workflow ปัจจุบัน",
        }),
    ]),
    "leave.request.create": Object.freeze([
        Object.freeze({
            code: "leave.request.lifecycle",
            label: "ยังต้องผ่าน owner, quota, lifecycle และ workflow invariants",
        }),
    ]),
    "leave.request.cancel": Object.freeze([
        Object.freeze({
            code: "leave.cancellation.workflow",
            label: "ยังต้องผ่านสถานะคำขอและกฎ cancellation ของ Leave",
        }),
    ]),
    "leave.request.approve": Object.freeze([
        Object.freeze({
            code: "leave.approval.workflow",
            label: "ASSIGNED ยังต้องผ่าน effective approver, owner exclusion และ workflow state",
        }),
    ]),
    "leave.cancellation.decide": Object.freeze([
        Object.freeze({
            code: "leave.cancellation.workflow",
            label: "ยังต้องผ่าน effective approver และ cancellation workflow/state",
        }),
    ]),
    "leave.request.not_taken": Object.freeze([
        Object.freeze({
            code: "leave.not_taken.relationship",
            label: "OWN/ASSIGNED ยังต้องผ่าน participant, recovery และ workflow rules",
        }),
    ]),
    "leave.approver.manage": Object.freeze([
        Object.freeze({
            code: "leave.approver.workflow",
            label: "การจัดการ approver ยังผ่าน assignment และ lifecycle checks ของ Leave",
        }),
    ]),
});

function asLeaveActor(actor: AuthorizationActor): LeaveAuthorizationActor {
    const channel = actor.channel;
    if (channel === "SYSTEM") {
        throw new Error("Leave effective-access inspection does not support SYSTEM channel");
    }
    return Object.freeze({ ...actor, channel });
}

function getDecision(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: LeaveCapability,
): AuthorizationDecision {
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(`Authorization resolver omitted Leave capability: ${capability}`);
    }
    return decision;
}

function inspectLeaveCapability(
    actor: AuthorizationActor,
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: LeaveCapability,
    context: AuthorizationAdministrationInspectionContext,
): AuthorizationAdministrationEffectiveAccessInspection {
    const leaveActor = asLeaveActor(actor);
    const authority = composeLegacyAdminCompatibleAuthorizationAuthority(
        leaveActor,
        capability,
        defaultLeaveScopes(leaveActor, capability),
        getDecision(decisions, capability),
    );
    return projectAuthorizationAdministrationEffectiveAccess(
        capability,
        context,
        authority,
        LIMITATIONS[capability],
    );
}

export function inspectLeaveEffectiveAccess(
    actor: AuthorizationActor,
    decisions: ReadonlyMap<string, AuthorizationDecision>,
): readonly AuthorizationAdministrationEffectiveAccessInspection[] {
    const capabilities = actor.channel === "LIFF_SELF_SERVICE"
        ? LEAVE_CAPABILITIES.filter((capability) => [
            "leave.request.read",
            "leave.approval.read",
            "leave.request.create",
            "leave.request.cancel",
            "leave.request.approve",
            "leave.request.not_taken",
        ].includes(capability))
        : LEAVE_CAPABILITIES;
    const context = actor.channel === "LIFF_SELF_SERVICE"
        ? LIFF_CONTEXT
        : DASHBOARD_CONTEXT;

    return Object.freeze(capabilities.map((capability) =>
        inspectLeaveCapability(actor, decisions, capability, context),
    ));
}
