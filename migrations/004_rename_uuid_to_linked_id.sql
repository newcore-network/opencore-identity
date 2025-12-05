-- Migration to rename uuid column to linked_id and add external_source
-- This migration is for existing installations that already have the accounts table

-- Rename uuid column to linked_id and increase length to support various ID formats
ALTER TABLE accounts CHANGE COLUMN uuid linked_id VARCHAR(255) UNIQUE NULL;

-- Add external_source column to track account origin
ALTER TABLE accounts ADD COLUMN external_source VARCHAR(32) NULL AFTER linked_id;

-- Update existing records to mark them as 'local' source
UPDATE accounts SET external_source = 'local' WHERE external_source IS NULL;

