import {
    composeAuthorizationAuthority,
    projectAuthorizationAdministrationEffectiveAccess,
    type AuthorizationActor,
    type AuthorizationAdministrationEffectiveAccessInspection,
    type AuthorizationAdministrationEffectiveAccessLimitation,
    type AuthorizationAdministrationInspectionContext,
    type AuthorizationDecision,
} from "@/modules/authorization";

import {
    defaultStockScopes,
    STOCK_CAPABILITIES,
    type StockAuthorizationActor,
    type StockCapability,
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
    Record<StockCapability, readonly AuthorizationAdministrationEffectiveAccessLimitation[]>
> = Object.freeze({
    "stock.catalog.read": Object.freeze([
        Object.freeze({
            code: "stock.catalog.resource",
            label: "ผลลัพธ์ยังถูกจำกัดด้วยสถานะและ resource ของ catalog",
        }),
    ]),
    "stock.inventory.manage": Object.freeze([
        Object.freeze({
            code: "stock.inventory.integrity",
            label: "ยังต้องผ่าน inventory state, availability และ concurrency rules",
        }),
    ]),
    "stock.request.read": Object.freeze([
        Object.freeze({
            code: "stock.request.relationship",
            label: "OWN ยังต้องเป็นผู้ร้องขอ; query ยังตรวจสถานะคำขอ",
        }),
    ]),
    "stock.request.create": Object.freeze([
        Object.freeze({
            code: "stock.request.create_invariants",
            label: "ผู้ร้องขอถูก derive จาก actor และยังต้องผ่าน availability/idempotency",
        }),
    ]),
    "stock.request.cancel": Object.freeze([
        Object.freeze({
            code: "stock.request.cancel_workflow",
            label: "ยังต้องผ่านสถานะคำขอและกฎการยกเลิกของ Stock",
        }),
    ]),
    "stock.request.process": Object.freeze([
        Object.freeze({
            code: "stock.request.process_workflow",
            label: "ยังต้องผ่าน request state, inventory และ concurrency rules",
        }),
    ]),
    "stock.report.export": Object.freeze([
        Object.freeze({
            code: "stock.report.resource",
            label: "report ยังตรวจช่วงข้อมูลและเงื่อนไขของ Stock แยกต่างหาก",
        }),
    ]),
});

function asStockActor(actor: AuthorizationActor): StockAuthorizationActor {
    const channel = actor.channel;
    if (channel === "SYSTEM") {
        throw new Error("Stock effective-access inspection does not support SYSTEM channel");
    }
    return Object.freeze({ ...actor, channel });
}

function getDecision(
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: StockCapability,
): AuthorizationDecision {
    const decision = decisions.get(capability);
    if (decision === undefined) {
        throw new Error(`Authorization resolver omitted Stock capability: ${capability}`);
    }
    return decision;
}

function inspectStockCapability(
    actor: AuthorizationActor,
    decisions: ReadonlyMap<string, AuthorizationDecision>,
    capability: StockCapability,
    context: AuthorizationAdministrationInspectionContext,
): AuthorizationAdministrationEffectiveAccessInspection {
    const stockActor = asStockActor(actor);
        const authority = composeAuthorizationAuthority(
        stockActor,
        capability,
        defaultStockScopes(stockActor, capability),
        getDecision(decisions, capability),
    );
    return projectAuthorizationAdministrationEffectiveAccess(
        capability,
        context,
        authority,
        LIMITATIONS[capability],
    );
}

export function inspectStockEffectiveAccess(
    actor: AuthorizationActor,
    decisions: ReadonlyMap<string, AuthorizationDecision>,
): readonly AuthorizationAdministrationEffectiveAccessInspection[] {
    const context = actor.channel === "LIFF_SELF_SERVICE"
        ? LIFF_CONTEXT
        : DASHBOARD_CONTEXT;
    const capabilities = actor.channel === "LIFF_SELF_SERVICE"
        ? STOCK_CAPABILITIES.filter((capability) => [
            "stock.catalog.read",
            "stock.request.read",
            "stock.request.create",
            "stock.request.cancel",
            "stock.request.process",
        ].includes(capability))
        : STOCK_CAPABILITIES;

    return Object.freeze(capabilities.map((capability) =>
        inspectStockCapability(actor, decisions, capability, context),
    ));
}
