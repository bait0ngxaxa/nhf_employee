INSERT INTO `it_ticket_categories` (`key`, `name`, `isActive`, `createdAt`, `updatedAt`)
VALUES
    ('HARDWARE', 'อุปกรณ์คอมพิวเตอร์', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('SOFTWARE', 'โปรแกรม / ระบบงาน', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('NETWORK', 'เครือข่าย / อินเทอร์เน็ต', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('ACCOUNT_ACCESS', 'บัญชีผู้ใช้ / สิทธิ์การเข้าถึง', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('EMAIL', 'อีเมล / Microsoft 365', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('PRINTER_PERIPHERAL', 'เครื่องพิมพ์ / อุปกรณ์ต่อพ่วง', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('OTHER', 'อื่น ๆ', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
    `key` = VALUES(`key`),
    `name` = VALUES(`name`),
    `isActive` = TRUE,
    `updatedAt` = CURRENT_TIMESTAMP(3);
