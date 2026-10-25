ALTER TABLE recipe DROP CONSTRAINT recipe_source_platform_check;
ALTER TABLE recipe ADD CONSTRAINT recipe_source_platform_check
    CHECK (source_platform IN ('instagram', 'facebook', 'www'));
