import {
    AUTHORIZATION_CHANNELS,
    AUTHORIZATION_DOMAINS,
    AUTHORIZATION_SCOPES,
    type AuthorizationChannel,
    type AuthorizationDomain,
    type AuthorizationScope,
} from "../../contracts";
import {
    CAPABILITY_KEYS,
    isRegisteredCapabilityKey,
    type RegisteredCapabilityKey,
} from "../../registry";

export interface AuthorizationDomainPresentation {
    readonly label: string;
    readonly description: string;
}

export interface AuthorizationScopePresentation {
    readonly label: string;
    readonly description: string;
}

export interface AuthorizationChannelPresentation {
    readonly label: string;
    readonly description: string;
}

export interface CapabilityPresentationMetadata {
    readonly actionLabel: string;
    readonly description: string;
    readonly searchTerms: readonly string[];
    readonly scopeDescriptions?: Readonly<Partial<Record<AuthorizationScope, string>>>;
}

export const authorizationDomainPresentation: Readonly<
    Record<AuthorizationDomain, AuthorizationDomainPresentation>
> = Object.freeze({
    employee: {
        label: "บุคลากร",
        description: "ข้อมูลและการดำเนินงานเกี่ยวกับพนักงาน",
    },
    department: {
        label: "หน่วยงาน",
        description: "ข้อมูลอ้างอิงของหน่วยงาน",
    },
    routine: {
        label: "งานประจำ",
        description: "การสร้างและติดตามงานประจำ",
    },
    stock: {
        label: "คลัง",
        description: "สินค้า สต็อก และคำขอเบิก",
    },
    leave: {
        label: "การลา",
        description: "คำขอลาและงานอนุมัติ",
    },
    audit: {
        label: "การตรวจสอบ",
        description: "บันทึกการใช้งานระบบ",
    },
    email: {
        label: "อีเมล",
        description: "คำขอที่เกี่ยวข้องกับอีเมล",
    },
    notification: {
        label: "การแจ้งเตือน",
        description: "การแจ้งเตือนภายในระบบ",
    },
});

export const authorizationScopePresentation: Readonly<
    Record<AuthorizationScope, AuthorizationScopePresentation>
> = Object.freeze({
    OWN: {
        label: "เฉพาะของตัวเอง",
        description: "ข้อมูลหรือรายการของผู้ใช้นี้เอง",
    },
    CREATED: {
        label: "รายการที่สร้าง",
        description: "รายการที่ผู้ใช้นี้เป็นผู้สร้าง",
    },
    ASSIGNED: {
        label: "รายการที่รับผิดชอบ",
        description: "รายการที่ผู้ใช้นี้ได้รับมอบหมายหรือรับผิดชอบ",
    },
    TEAM: {
        label: "ภายในกลุ่มนี้",
        description: "รายการภายในกลุ่มผู้ใช้งานที่เกี่ยวข้อง",
    },
    ALL: {
        label: "ทั้งหมด",
        description: "รายการทั้งหมดที่ความสามารถนี้อนุญาต",
    },
});

export const authorizationChannelPresentation: Readonly<
    Record<AuthorizationChannel, AuthorizationChannelPresentation>
> = Object.freeze({
    DASHBOARD: {
        label: "เว็บระบบ",
        description: "การใช้งานผ่านเว็บแดชบอร์ด",
    },
    LIFF_SELF_SERVICE: {
        label: "LINE / บริการตนเอง",
        description: "การใช้งานผ่าน LINE ในบริบทบริการตนเอง",
    },
    SYSTEM: {
        label: "ระบบ",
        description: "การทำงานภายในระบบ",
    },
});

function capability(
    actionLabel: string,
    description: string,
    searchTerms: readonly string[],
    scopeDescriptions?: Readonly<Partial<Record<AuthorizationScope, string>>>,
): CapabilityPresentationMetadata {
    return Object.freeze({
        actionLabel,
        description,
        searchTerms: Object.freeze([...searchTerms]),
        ...(scopeDescriptions === undefined ? {} : { scopeDescriptions }),
    });
}

/**
 * Operator-facing copy only. This catalog deliberately does not contain
 * grantability, supported scopes, supported channels, or runtime decisions.
 */
export const authorizationCapabilityPresentation: Readonly<
    Record<RegisteredCapabilityKey, CapabilityPresentationMetadata>
> = Object.freeze({
    "employee.read": capability("ดูข้อมูลพนักงาน", "ดูข้อมูลพนักงานตามขอบเขตที่ระบบอนุญาต", ["พนักงาน", "บุคลากร", "ดู", "อ่าน"]),
    "employee.stats.read": capability("ดูสถิติพนักงาน", "ดูสรุปและสถิติของพนักงานตามขอบเขตที่ระบบอนุญาต", ["พนักงาน", "บุคลากร", "สถิติ", "สรุป"]),
    "employee.create": capability("เพิ่มพนักงาน", "เพิ่มข้อมูลพนักงานเข้าสู่ระบบ", ["พนักงาน", "บุคลากร", "เพิ่ม", "สร้าง"]),
    "employee.update": capability("แก้ไขข้อมูลพนักงาน", "แก้ไขข้อมูลพนักงานตามขอบเขตที่ระบบอนุญาต", ["พนักงาน", "บุคลากร", "แก้ไข", "ปรับปรุง"]),
    "employee.delete": capability("ลบข้อมูลพนักงาน", "ลบข้อมูลพนักงานตามขั้นตอนที่ระบบอนุญาต", ["พนักงาน", "บุคลากร", "ลบ"]),
    "employee.import": capability("นำเข้าข้อมูลพนักงาน", "นำเข้าข้อมูลพนักงานจากไฟล์หรือข้อมูลที่ระบบรองรับ", ["พนักงาน", "บุคลากร", "นำเข้า", "import"]),
    "employee.export": capability("ส่งออกข้อมูลพนักงาน", "ส่งออกข้อมูลพนักงานตามขอบเขตที่ระบบอนุญาต", ["พนักงาน", "บุคลากร", "ส่งออก", "export"]),

    "department.read": capability("ดูข้อมูลหน่วยงาน", "ดูข้อมูลอ้างอิงของหน่วยงาน", ["หน่วยงาน", "แผนก", "ดู", "อ่าน"]),

    "routine.task.read": capability("ดูงานประจำ", "ดูงานประจำตามขอบเขตที่ระบบอนุญาต", ["งานประจำ", "งาน", "ดู", "อ่าน"], {
        CREATED: "งานประจำที่ผู้ใช้นี้สร้าง",
        ASSIGNED: "งานประจำที่ผู้ใช้นี้ได้รับมอบหมายให้รับผิดชอบ",
        ALL: "งานประจำทั้งหมดที่ความสามารถนี้อนุญาต",
    }),
    "routine.task.create": capability("สร้างงานประจำ", "สร้างงานประจำตามขอบเขตที่ระบบอนุญาต", ["งานประจำ", "งาน", "สร้าง", "เพิ่ม"], {
        OWN: "งานประจำที่ผู้ใช้นี้สร้างและเป็นเจ้าของ",
        ALL: "สร้างงานประจำได้ในขอบเขตที่ระบบอนุญาต",
    }),
    "routine.task.update": capability("แก้ไขงานประจำ", "แก้ไขงานประจำตามขอบเขตที่ระบบอนุญาต", ["งานประจำ", "งาน", "แก้ไข"], {
        CREATED: "งานประจำที่ผู้ใช้นี้สร้าง",
        ASSIGNED: "งานประจำที่ผู้ใช้นี้รับผิดชอบ",
        ALL: "งานประจำทั้งหมดที่ความสามารถนี้อนุญาต",
    }),
    "routine.task.delete": capability("ลบงานประจำ", "ลบงานประจำตามขอบเขตที่ระบบอนุญาต", ["งานประจำ", "งาน", "ลบ"], {
        CREATED: "งานประจำที่ผู้ใช้นี้สร้าง",
        ALL: "งานประจำทั้งหมดที่ความสามารถนี้อนุญาต",
    }),
    "routine.occurrence.read": capability("ดูรายการงานที่เกิดขึ้น", "ดูรายการงานประจำที่เกิดขึ้นตามกำหนด", ["งานประจำ", "งาน", "รายการงาน", "ดู"], {
        ASSIGNED: "รายการงานที่ผู้ใช้นี้รับผิดชอบ",
        ALL: "รายการงานทั้งหมดที่ความสามารถนี้อนุญาต",
    }),
    "routine.occurrence.override": capability("แก้ไขรายละเอียดงานที่เกิดขึ้น", "แก้ไขรายละเอียดของรายการงานที่เกิดขึ้น", ["งานประจำ", "งาน", "แก้ไข", "รายละเอียด"]),
    "routine.occurrence.reassign": capability("เปลี่ยนผู้รับผิดชอบงาน", "เปลี่ยนผู้รับผิดชอบของรายการงานที่เกิดขึ้น", ["งานประจำ", "งาน", "มอบหมาย", "ผู้รับผิดชอบ"]),
    "routine.occurrence.change_due_date": capability("เปลี่ยนกำหนดส่งงาน", "เปลี่ยนวันที่ครบกำหนดของรายการงานที่เกิดขึ้น", ["งานประจำ", "งาน", "กำหนดส่ง", "วันครบกำหนด"]),
    "routine.import.manage": capability("จัดการการนำเข้างานประจำ", "จัดการการนำเข้าข้อมูลงานประจำตามขั้นตอนที่ระบบรองรับ", ["งานประจำ", "งาน", "นำเข้า", "จัดการ"]),
    "routine.task.export": capability("ส่งออกข้อมูลงานประจำ", "ส่งออกข้อมูลงานประจำตามขอบเขตที่ระบบอนุญาต", ["งานประจำ", "งาน", "ส่งออก"]),
    "routine.summary.read": capability("ดูสรุปงานประจำ", "ดูข้อมูลสรุปของงานประจำตามขอบเขตที่ระบบอนุญาต", ["งานประจำ", "งาน", "สรุป", "ดู"]),
    "routine.reference.read": capability("ดูข้อมูลอ้างอิงงานประจำ", "ดูข้อมูลอ้างอิงที่ใช้กับงานประจำ", ["งานประจำ", "งาน", "อ้างอิง", "ดู"]),

    "stock.catalog.read": capability("ดูรายการสินค้า", "ดูรายการสินค้าและข้อมูลสินค้า", ["คลัง", "สินค้า", "ดู", "รายการสินค้า"]),
    "stock.inventory.manage": capability("จัดการสต็อก", "จัดการข้อมูลและยอดคงเหลือของสต็อก", ["คลัง", "สต็อก", "สินค้า", "จัดการ"]),
    "stock.request.read": capability("ดูคำขอเบิก", "ดูคำขอเบิกตามขอบเขตที่ระบบอนุญาต", ["คลัง", "เบิก", "คำขอ", "ดู"], {
        OWN: "คำขอเบิกของผู้ใช้นี้เอง",
        ALL: "คำขอเบิกทั้งหมดที่ความสามารถนี้อนุญาต",
    }),
    "stock.request.create": capability("ส่งคำขอเบิก", "สร้างและส่งคำขอเบิกวัสดุ", ["คลัง", "เบิก", "คำขอ", "สร้าง", "ส่ง"]),
    "stock.request.cancel": capability("ยกเลิกคำขอเบิก", "ยกเลิกคำขอเบิกตามขอบเขตที่ระบบอนุญาต", ["คลัง", "เบิก", "คำขอ", "ยกเลิก"], {
        OWN: "คำขอเบิกของผู้ใช้นี้เอง",
        ALL: "คำขอเบิกทั้งหมดที่ความสามารถนี้อนุญาต",
    }),
    "stock.request.process": capability("ดำเนินการคำขอเบิก", "ตรวจสอบและดำเนินการคำขอเบิกตามขั้นตอนของคลัง", ["คลัง", "เบิก", "คำขอ", "ดำเนินการ", "อนุมัติ"]),
    "stock.report.export": capability("ส่งออกรายงานสต็อก", "ส่งออกรายงานข้อมูลสต็อกตามขอบเขตที่ระบบอนุญาต", ["คลัง", "สต็อก", "รายงาน", "ส่งออก"]),

    "leave.request.read": capability("ดูคำขอลา", "ดูคำขอลาของผู้ใช้นี้ตามขอบเขตที่ระบบอนุญาต", ["การลา", "ลา", "คำขอลา", "ดู"]),
    "leave.approval.read": capability("ดูงานอนุมัติการลา", "ดูคำขอลาที่อยู่ในงานอนุมัติของผู้ใช้นี้", ["การลา", "ลา", "อนุมัติ", "ดู"]),
    "leave.request.create": capability("ส่งคำขอลา", "สร้างและส่งคำขอลา", ["การลา", "ลา", "ส่ง", "สร้าง"]),
    "leave.request.cancel": capability("ยกเลิกคำขอลา", "ยกเลิกคำขอลาตามขอบเขตที่ระบบอนุญาต", ["การลา", "ลา", "ยกเลิก"]),
    "leave.request.approve": capability("อนุมัติคำขอลา", "อนุมัติคำขอลาตามงานที่ได้รับมอบหมาย", ["การลา", "ลา", "อนุมัติ"]),
    "leave.cancellation.decide": capability("พิจารณาการยกเลิกคำขอลา", "พิจารณาและตัดสินใจต่อคำขอยกเลิกการลา", ["การลา", "ลา", "ยกเลิก", "พิจารณา"]),
    "leave.request.not_taken": capability("บันทึกว่าไม่ได้ใช้วันลา", "บันทึกผลว่าคำขอลาที่อนุมัติแล้วไม่ได้ถูกใช้", ["การลา", "ลา", "ไม่ได้ใช้", "บันทึก"]),
    "leave.approver.manage": capability("จัดการผู้อนุมัติการลา", "จัดการการกำหนดผู้อนุมัติคำขอลา", ["การลา", "ลา", "ผู้อนุมัติ", "จัดการ"]),

    "audit.read": capability("ดูบันทึกการใช้งานระบบ", "ดูบันทึกเหตุการณ์และการใช้งานระบบตามขอบเขตที่ระบบอนุญาต", ["การตรวจสอบ", "audit", "บันทึก", "ดู"]),

    "email.request.read": capability("ดูคำขออีเมล", "ดูคำขอที่เกี่ยวข้องกับอีเมล", ["อีเมล", "email", "คำขอ", "ดู"]),
    "email.request.create": capability("สร้างคำขออีเมล", "สร้างคำขอที่เกี่ยวข้องกับอีเมล", ["อีเมล", "email", "คำขอ", "สร้าง"]),

    "notification.inbox.read": capability("ดูการแจ้งเตือน", "ดูการแจ้งเตือนของผู้ใช้นี้", ["การแจ้งเตือน", "แจ้งเตือน", "ดู"]),
    "notification.inbox.update": capability("จัดการการแจ้งเตือน", "จัดการสถานะการแจ้งเตือนของผู้ใช้นี้", ["การแจ้งเตือน", "แจ้งเตือน", "จัดการ", "อ่านแล้ว"]),
});

export function getAuthorizationDomainPresentation(
    domain: string,
): AuthorizationDomainPresentation {
    if (isAuthorizationDomain(domain)) return authorizationDomainPresentation[domain];
    return {
        label: "หมวดงานที่ต้องตรวจสอบ",
        description: "หมวดงานนี้ยังไม่มีคำอธิบายสำหรับผู้ดูแล",
    };
}

export function getCapabilityPresentation(
    capabilityKey: string,
): CapabilityPresentationMetadata | undefined {
    if (!isRegisteredCapabilityKey(capabilityKey)) return undefined;
    return authorizationCapabilityPresentation[capabilityKey];
}

export function getCapabilitySearchText(
    capabilityKey: string,
    domain: string,
): string {
    const presentation = getCapabilityPresentation(capabilityKey);
    const domainPresentation = getAuthorizationDomainPresentation(domain);
    return [
        domainPresentation.label,
        domainPresentation.description,
        presentation?.actionLabel,
        presentation?.description,
        ...(presentation?.searchTerms ?? []),
    ].join(" ").toLocaleLowerCase();
}

export function getAuthorizationScopePresentation(
    scope: string,
    capabilityKey?: string,
): AuthorizationScopePresentation {
    if (!isAuthorizationScope(scope)) {
        return {
            label: "ขอบเขตที่ต้องตรวจสอบ",
            description: "ขอบเขตนี้ไม่อยู่ในรายการที่ระบบรองรับ",
        };
    }

    const base = authorizationScopePresentation[scope];
    const capabilityPresentation = capabilityKey === undefined
        ? undefined
        : getCapabilityPresentation(capabilityKey);
    const contextualDescription = capabilityPresentation?.scopeDescriptions?.[scope];
    return contextualDescription === undefined
        ? base
        : { ...base, description: contextualDescription };
}

export function getAuthorizationChannelPresentation(
    channel: string,
): AuthorizationChannelPresentation {
    if (isAuthorizationChannel(channel)) return authorizationChannelPresentation[channel];
    return {
        label: "ช่องทางที่ต้องตรวจสอบ",
        description: "ช่องทางนี้ไม่อยู่ในรายการที่ระบบรองรับ",
    };
}

export function getAuthorizationSourceLabel(
    source: "SYSTEM_ROLE" | "TEAM" | "TEAM_ROLE" | "USER",
): string {
    switch (source) {
        case "SYSTEM_ROLE":
            return "สิทธิ์ระดับผู้ดูแลระบบ";
        case "TEAM":
            return "สิทธิ์ของกลุ่มผู้ใช้งาน";
        case "TEAM_ROLE":
            return "สิทธิ์ของบทบาทในกลุ่ม";
        case "USER":
            return "สิทธิ์เฉพาะบุคคล";
    }
}

export function getAuthorizationSourceDescription(
    source: "SYSTEM_ROLE" | "TEAM" | "TEAM_ROLE" | "USER",
): string {
    switch (source) {
        case "SYSTEM_ROLE":
            return "ได้รับจากระดับผู้ดูแลระบบของบัญชีนี้";
        case "TEAM":
            return "สมาชิกทุกคนในกลุ่มที่ใช้งานอยู่สามารถได้รับสิทธิ์นี้";
        case "TEAM_ROLE":
            return "เฉพาะสมาชิกที่มีบทบาทนี้ในกลุ่มจะได้รับสิทธิ์นี้";
        case "USER":
            return "ข้อยกเว้นที่เพิ่มให้ผู้ใช้รายนี้โดยเฉพาะ";
    }
}

function isAuthorizationDomain(value: string): value is AuthorizationDomain {
    return (AUTHORIZATION_DOMAINS as readonly string[]).includes(value);
}

function isAuthorizationScope(value: string): value is AuthorizationScope {
    return (AUTHORIZATION_SCOPES as readonly string[]).includes(value);
}

function isAuthorizationChannel(value: string): value is AuthorizationChannel {
    return (AUTHORIZATION_CHANNELS as readonly string[]).includes(value);
}

export function getRegisteredPresentationKeys(): readonly RegisteredCapabilityKey[] {
    return CAPABILITY_KEYS;
}
