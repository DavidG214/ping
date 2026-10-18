ALTER TABLE residents ADD COLUMN demo_key text;
CREATE UNIQUE INDEX resident_demo_key ON residents(workspace_id,demo_key) WHERE demo_key IS NOT NULL;
