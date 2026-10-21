CREATE TABLE IF NOT EXISTS schema_version (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
);
