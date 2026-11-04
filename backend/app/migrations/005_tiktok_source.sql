ALTER TABLE recipe DROP CONSTRAINT recipe_source_platform_check;
ALTER TABLE recipe ADD CONSTRAINT recipe_source_platform_check
    CHECK (source_platform IN ('instagram', 'facebook', 'www', 'tiktok'));

ALTER TABLE import_job DROP CONSTRAINT import_job_platform_check;
ALTER TABLE import_job ADD CONSTRAINT import_job_platform_check
    CHECK (platform IN ('instagram', 'facebook', 'tiktok'));
