-- Add password_hash column for credentials-based authentication
-- This is optional and only needed if using CredentialsAuthProvider

ALTER TABLE accounts ADD COLUMN password_hash VARCHAR(255) NULL AFTER username;

-- Note: For existing systems, passwords can be set via AccountService.setPassword()

