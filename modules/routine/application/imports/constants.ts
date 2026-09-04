import type { RoutineBusinessDayPolicy } from "../../domain/schedule";

export const ROUTINE_IMPORT_MANIFEST_VERSION = 1 as const;

export const ROUTINE_IMPORT_CATEGORY_ALIASES: Readonly<Record<string, string>> = {
    "สาธารณูปโภค": "สาธารณูปโภค",
    "อาคาร สถานที่": "อาคาร / สถานที่",
    "อาคาร/สถานที่": "อาคาร / สถานที่",
    "อาคาร / สถานที่": "อาคาร / สถานที่",
    "ระบบคอมพิวเตอร์": "ระบบคอมพิวเตอร์",
    "บุคลากร": "บุคลากร",
    "ยานพาหนะ": "ยานพาหนะ",
    "การเงิน/บัญชี": "การเงิน / บัญชี",
    "การเงิน / บัญชี": "การเงิน / บัญชี",
    "อื่นๆ": "อื่น ๆ",
    "อื่น ๆ": "อื่น ๆ",
};

export const ROUTINE_IMPORT_CATEGORY_SORT_ORDER: Readonly<Record<string, number>> = {
    "สาธารณูปโภค": 0,
    "อาคาร / สถานที่": 1,
    "ระบบคอมพิวเตอร์": 2,
    "บุคลากร": 3,
    "ยานพาหนะ": 4,
    "การเงิน / บัญชี": 5,
    "อื่น ๆ": 6,
};

export const ROUTINE_IMPORT_PLACEHOLDER_TITLES = new Set([
    "ไม่มี",
]);

export const ROUTINE_IMPORT_FOOTER_PREFIXES = [
    "* จ่ายจากเงินสดย่อย",
] as const;

export const ROUTINE_IMPORT_DEFAULT_BUSINESS_DAY_POLICY: RoutineBusinessDayPolicy =
    "NONE";

export const ROUTINE_IMPORT_REVIEW_REASONS = {
    DUPLICATE_OWNER: "DUPLICATE_OWNER",
    INACTIVE_CATEGORY: "INACTIVE_CATEGORY",
    INACTIVE_UNIT: "INACTIVE_UNIT",
    INVALID_CONTRACT_DATE_RANGE: "INVALID_CONTRACT_DATE_RANGE",
    INVALID_OWNER_ROLE: "INVALID_OWNER_ROLE",
    MISSING_CATEGORY: "MISSING_CATEGORY",
    MISSING_OWNER: "MISSING_OWNER",
    MISSING_TITLE: "MISSING_TITLE",
    MISSING_UNIT: "MISSING_UNIT",
    OWNER_MAPPING_EMPLOYEE_INACTIVE: "OWNER_MAPPING_EMPLOYEE_INACTIVE",
    OWNER_MAPPING_EMPLOYEE_NOT_FOUND: "OWNER_MAPPING_EMPLOYEE_NOT_FOUND",
    PLACEHOLDER_ROW: "PLACEHOLDER_ROW",
} as const;
