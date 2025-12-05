-- Migration 002: Create roles table
-- This table stores security roles/ranks with hierarchical permissions.

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(128) NOT NULL,
  rank INT NOT NULL DEFAULT 0,
  permissions JSON DEFAULT '[]',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_name (name),
  INDEX idx_is_default (is_default)
);

-- Insert default role for new accounts
INSERT INTO roles (name, display_name, rank, permissions, is_default) 
VALUES ('user', 'Player', 0, '[]', TRUE)
ON DUPLICATE KEY UPDATE name=name;

