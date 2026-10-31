-- SYSTEM defaults have explicit dataset provenance, without a synthetic User.
-- Existing ADMIN snapshots and all leave/quota history remain unchanged.
ALTER TABLE holiday_calendar_versions
    MODIFY createdById INTEGER NULL,
    ADD COLUMN defaultDatasetRevision VARCHAR(100) NULL;

-- MySQL CHECK cannot reference columns participating in cascading User FKs.
CREATE TRIGGER holiday_version_provenance_insert BEFORE INSERT ON holiday_calendar_versions
FOR EACH ROW BEGIN
    IF NOT ((NEW.createdById IS NOT NULL AND NEW.defaultDatasetRevision IS NULL)
        OR (NEW.createdById IS NULL AND NEW.defaultDatasetRevision IS NOT NULL AND NEW.publishedById IS NULL)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Holiday version requires ADMIN or SYSTEM dataset provenance';
    END IF;
END;

CREATE TRIGGER holiday_version_provenance_update BEFORE UPDATE ON holiday_calendar_versions
FOR EACH ROW BEGIN
    IF NOT ((NEW.createdById IS NOT NULL AND NEW.defaultDatasetRevision IS NULL)
        OR (NEW.createdById IS NULL AND NEW.defaultDatasetRevision IS NOT NULL AND NEW.publishedById IS NULL)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Holiday version requires ADMIN or SYSTEM dataset provenance';
    END IF;
END;
