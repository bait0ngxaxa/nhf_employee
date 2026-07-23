-- เพิ่มคอลัมน์จำนวนเต็มก่อน เพื่อให้ migration ล้มเหลวแทนการปัดเศษ
-- หากพบข้อมูลเดิมที่ไม่ได้อยู่บนช่วงทีละครึ่งวัน
ALTER TABLE `leave_quotas`
    ADD COLUMN `totalHalfDays` INTEGER NULL,
    ADD COLUMN `usedHalfDays` INTEGER NULL;

UPDATE `leave_quotas`
SET
    `totalHalfDays` = CASE
        WHEN `totalDays` >= 0
            AND ABS((`totalDays` * 2) - ROUND(`totalDays` * 2)) < 0.000000001
            THEN CAST(ROUND(`totalDays` * 2) AS SIGNED)
        ELSE NULL
    END,
    `usedHalfDays` = CASE
        WHEN `usedDays` >= 0
            AND ABS((`usedDays` * 2) - ROUND(`usedDays` * 2)) < 0.000000001
            THEN CAST(ROUND(`usedDays` * 2) AS SIGNED)
        ELSE NULL
    END;

-- CHECK ทำให้ migration หยุดแน่นอนเมื่อมีค่าที่แปลงไม่ได้
-- โดยไม่ขึ้นกับการตั้งค่า SQL mode ของฐานข้อมูล
ALTER TABLE `leave_quotas`
    ADD CONSTRAINT `leave_quotas_half_day_values_valid`
    CHECK (`totalHalfDays` IS NOT NULL AND `usedHalfDays` IS NOT NULL);

ALTER TABLE `leave_quotas`
    MODIFY `totalHalfDays` INTEGER NOT NULL,
    MODIFY `usedHalfDays` INTEGER NOT NULL DEFAULT 0,
    DROP COLUMN `totalDays`,
    DROP COLUMN `usedDays`,
    DROP CHECK `leave_quotas_half_day_values_valid`;

ALTER TABLE `leave_requests`
    ADD COLUMN `durationHalfDays` INTEGER NULL,
    ADD COLUMN `overQuotaHalfDays` INTEGER NULL;

UPDATE `leave_requests`
SET
    `durationHalfDays` = CASE
        WHEN `durationDays` > 0
            AND ABS((`durationDays` * 2) - ROUND(`durationDays` * 2)) < 0.000000001
            THEN CAST(ROUND(`durationDays` * 2) AS SIGNED)
        ELSE NULL
    END,
    `overQuotaHalfDays` = CASE
        WHEN `overQuotaDays` >= 0
            AND ABS((`overQuotaDays` * 2) - ROUND(`overQuotaDays` * 2)) < 0.000000001
            THEN CAST(ROUND(`overQuotaDays` * 2) AS SIGNED)
        ELSE NULL
    END;

ALTER TABLE `leave_requests`
    ADD CONSTRAINT `leave_requests_half_day_values_valid`
    CHECK (`durationHalfDays` IS NOT NULL AND `overQuotaHalfDays` IS NOT NULL);

ALTER TABLE `leave_requests`
    MODIFY `durationHalfDays` INTEGER NOT NULL,
    MODIFY `overQuotaHalfDays` INTEGER NOT NULL DEFAULT 0,
    DROP COLUMN `durationDays`,
    DROP COLUMN `overQuotaDays`,
    DROP CHECK `leave_requests_half_day_values_valid`;
