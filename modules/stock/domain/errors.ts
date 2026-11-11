export class StockInvariantViolationError extends Error {
    constructor(
        message = "ข้อมูลวัสดุไม่สอดคล้อง: ไม่พบรายการย่อยของวัสดุ",
    ) {
        super(message);
        this.name = "StockInvariantViolationError";
    }
}

export class StockVariantSkuConflictError extends Error {
    constructor() {
        super("รหัสวัสดุ (SKU) นี้มีอยู่แล้ว");
        this.name = "StockVariantSkuConflictError";
    }
}
