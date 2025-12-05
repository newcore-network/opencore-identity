-- Migration 003: Alter accounts table to use role-based permissions
-- IMPORTANT: Run this AFTER creating roles and inserting at least a default role.

-- Add role_id foreign key column
ALTER TABLE accounts 
  ADD COLUMN role_id INT NULL AFTER username;

-- Add custom_permissions column for per-account overrides
ALTER TABLE accounts 
  ADD COLUMN custom_permissions JSON DEFAULT '[]' AFTER role_id;

-- Drop old flat permissions column
ALTER TABLE accounts 
  DROP COLUMN IF EXISTS permissions;

-- Add foreign key constraint to roles
ALTER TABLE accounts 
  ADD CONSTRAINT fk_accounts_role
  FOREIGN KEY (role_id) REFERENCES roles(id) 
  ON DELETE SET NULL;

-- Add index for faster role lookups
CREATE INDEX idx_role_id ON accounts(role_id);

