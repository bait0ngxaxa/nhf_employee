export class StockInvariantViolationError extends Error {
    constructor(
        message = "ข้อมูลวัสดุไม่สอดคล้อง: ไม่พบรายการย่อยของวัสดุ",
    ) {
        super(message);
        this.name = "StockInvariantViolationError";
    }
}
