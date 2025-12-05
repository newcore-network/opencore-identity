/**
 * Role entity representing a security role/rank in the system.
 * Roles define base permissions and hierarchy through rank.
 */
export interface Role {
  /**
   * Unique identifier for the role
   */
  id: number;

  /**
   * Internal name (e.g., 'admin', 'moderator', 'user')
   */
  name: string;

  /**
   * Display name for UI (e.g., 'Administrator', 'Moderator', 'Player')
   */
  displayName: string;

  /**
   * Numeric rank for hierarchy comparisons (higher = more privileged)
   * Example: 100 = admin, 50 = moderator, 0 = user
   */
  rank: number;

  /**
   * Base permissions granted by this role
   */
  permissions: string[];

  /**
   * Whether this is the default role for new accounts
   */
  isDefault: boolean;

  /**
   * Role creation timestamp
   */
  createdAt: Date;
}
