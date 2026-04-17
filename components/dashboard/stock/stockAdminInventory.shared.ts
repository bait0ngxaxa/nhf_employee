import type { ApiResponse } from "@/lib/api-client";
import type { StockItem } from "../context/stock/types";

export type VariantDraftAttribute = {
    name: string;
    value: string;
};

export type VariantDraft = {
    sku: string;
    unit: string;
    quantity: string;
    minStock: string;
    imageUrl: string;
    attributes: VariantDraftAttribute[];
};

export const STOCK_ADMIN_TEXT = {
    addItem: "เพิ่มวัสดุ",
    addCategory: "เพิ่มหมวดหมู่",
    loading: "กำลังโหลด...",
    image: "รูป",
    sku: "รหัส (SKU)",
    itemName: "ชื่อวัสดุ",
    category: "หมวดหมู่",
    quantity: "คงเหลือ",
    minStock: "จุดสั่งซื้อ",
    noVariant: "ยังไม่มีรายการ",
    childSku: "SKU ย่อย",
    deleteConfirm: 'ลบ "{name}" ออกจากรายการหรือไม่?',
    deleteSuccess: "ลบ {name} เรียบร้อยแล้ว",
    genericError: "เกิดข้อผิดพลาด",
    save: "บันทึกข้อมูล",
    saving: "กำลังบันทึก...",
    cancel: "ยกเลิก",
    addNewItem: "เพิ่มวัสดุใหม่",
    itemDescription: "รายละเอียด",
    itemDescriptionPlaceholder: "เช่น กระดาษ post-it สำหรับจดข้อความสั้น",
    imageUrl: "ลิงก์รูปภาพ",
    unit: "หน่วย",
    unitPlaceholder: "เช่น ชิ้น, เล่ม, รีม",
    initialQuantity: "จำนวน",
    categoryPlaceholder: "เลือกหมวดหมู่",
    itemAdded: "เพิ่มวัสดุเรียบร้อยแล้ว",
    variantsTitle: "รายการ",
    variantsHint:
        "เพิ่มสี ขนาด ชนิด หรือคุณสมบัติที่ทำให้วัสดุนี้ต้องแยก stock เป็นหลายรายการ",
    addVariant: "เพิ่มรายการ",
    autoVariantHint:
        "หากไม่เพิ่มรายการ ระบบจะสร้างรายการเริ่มต้นให้อัตโนมัติ",
    variantLabel: "รายการ",
    remove: "ลบ",
    attributes: "คุณสมบัติ",
    addAttribute: "เพิ่มคุณสมบัติ",
    attributeNamePlaceholder: "เช่น สี",
    attributeValuePlaceholder: "เช่น ชมพู",
    adjustStockTitle: "ปรับยอดสต็อก",
    currentStock: "คงเหลือปัจจุบัน",
    inboundQuantity: "จำนวนรับเข้า",
    adjustSuccess: "ปรับยอด {name} เรียบร้อยแล้ว",
    saveAdjust: "บันทึกการปรับ",
    addCategoryTitle: "เพิ่มหมวดหมู่",
    categoryName: "ชื่อหมวดหมู่",
    categoryDescription: "คำอธิบาย (ถ้ามี)",
    categoryAdded: "เพิ่มหมวดหมู่เรียบร้อยแล้ว",
} as const;

export function createDeleteConfirmMessage(name: string): string {
    return STOCK_ADMIN_TEXT.deleteConfirm.replace("{name}", name);
}

export function createDeleteSuccessMessage(name: string): string {
    return STOCK_ADMIN_TEXT.deleteSuccess.replace("{name}", name);
}

export function createAdjustSuccessMessage(name: string): string {
    return STOCK_ADMIN_TEXT.adjustSuccess.replace("{name}", name);
}

function findFirstErrorMessage(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) {
        return value;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const message = findFirstErrorMessage(item);
            if (message) {
                return message;
            }
        }
        return null;
    }

    if (value && typeof value === "object") {
        for (const nestedValue of Object.values(value)) {
            const message = findFirstErrorMessage(nestedValue);
            if (message) {
                return message;
            }
        }
    }

    return null;
}

export function resolveStockApiErrorMessage(
    payload: unknown,
    fallback: string,
): string {
    if (!payload || typeof payload !== "object") {
        return fallback;
    }

    const detailsMessage = findFirstErrorMessage(
        "details" in payload ? payload.details : undefined,
    );
    if (detailsMessage) {
        return detailsMessage;
    }

    const errorMessage =
        "error" in payload && typeof payload.error === "string"
            ? payload.error.trim()
            : "";

    return errorMessage || fallback;
}

export function ensureStockApiSuccess<T>(
    response: ApiResponse<T>,
    fallback: string,
): T {
    if (response.success) {
        return response.data;
    }

    const message =
        response.details !== undefined
            ? resolveStockApiErrorMessage(
                  response.details,
                  response.errorThai || response.error || fallback,
              )
            : response.errorThai || response.error || fallback;

    throw new Error(message);
}

export function createVariantSummary(item: StockItem): string {
    const defaultVariant = item.variants?.[0];
    if (!defaultVariant) {
        return STOCK_ADMIN_TEXT.noVariant;
    }

    const attributeLabels = defaultVariant.attributeValues?.map(
        (attributeValue) =>
            `${attributeValue.attributeValue.attribute.name}: ${attributeValue.attributeValue.value}`,
    );

    if (!attributeLabels || attributeLabels.length === 0) {
        return `${STOCK_ADMIN_TEXT.childSku}: ${defaultVariant.sku}`;
    }

    return attributeLabels.join(" • ");
}

export function createEmptyVariantAttribute(): VariantDraftAttribute {
    return { name: "", value: "" };
}

export function createEmptyVariant(): VariantDraft {
    return {
        sku: "",
        unit: "",
        quantity: "1",
        minStock: "1",
        imageUrl: "",
        attributes: [createEmptyVariantAttribute()],
    };
}
