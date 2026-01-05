/**
 * Authentication strategy modes.
 * 
 * - `local`: Automatic authentication based on FiveM connection identifiers (e.g., license, discord).
 *   Ideal for traditional FiveM servers where account creation should be transparent.
 * - `credentials`: Manual authentication using username and password.
 *   Suitable for servers with an integrated registration system.
 * - `api`: Delegation of authentication to an external HTTP API.
 *   Useful for servers integrated with a web dashboard or external auth service.
 * 
 * @public
 */
export type AuthMode = "local" | "credentials" | "api";

/**
 * Authorization and principal resolution modes.
 * 
 * - `roles`: Uses a static role hierarchy defined in the application code.
 *   Provides the best performance and version control for role definitions.
 * - `db`: Fetches roles and permissions dynamically from a persistent store.
 * - `api`: Fetches principal data from an external HTTP API on demand.
 * 
 * @public
 */
export type PrincipalMode = "roles" | "db" | "api";

/**
 * Represents a security role within the identity system.
 * 
 * Roles define base permissions and a rank hierarchy used by the framework's `@Guard` decorator.
 * 
 * @public
 */
export interface IdentityRole<TId = any> {
  /** 
   * Technical identifier for the role (e.g., 'admin', 1, 'uuid').
   */
  id: TId;

  /** 
   * Hierarchical weight. 
   * 
   * Used for rank-based authorization. 
   * Logic: UserRank >= RequiredRank.
   */
  rank: number;

  /** 
   * List of permission strings granted to this role by default.
   * 
   * Supports '*' wildcard for full framework access.
   */
  permissions: string[];

  /** 
   * Human-readable label for UI display or chat prefix.
   */
  displayName?: string;
}

/**
 * Global configuration options for the OpenCore Identity System.
 * 
 * @public
 */
export interface IdentityOptions {
  /** 
   * Authentication configuration.
   */
  auth: {
    /** 
     * The strategy to use for authenticating players.
     */
    mode: AuthMode;

    /** 
     * Whether to automatically create a new account when a player connects 
     * with valid identifiers that are not yet registered.
     * 
     * Only applicable when mode is 'local'.
     * @defaultValue true
     */
    autoCreate?: boolean;

    /** 
     * The primary FiveM identifier used to unique-link an account.
     * @defaultValue 'license'
     */
    primaryIdentifier?: string;
  };

  /** 
   * Authorization and permissions configuration.
   */
  principal: {
    /** 
     * The strategy to use for resolving roles and permissions.
     */
    mode: PrincipalMode;

    /** 
     * Static role definitions.
     * 
     * Required when mode is 'roles'.
     */
    roles?: Record<string | number, IdentityRole>;

    /** 
     * The ID of the role assigned to newly created accounts.
     * @defaultValue 'user'
     */
    defaultRole?: string | number;

    /** 
     * Time-to-live in milliseconds for cached principal data.
     * 
     * Since principal resolution is a high-frequency operation, caching is 
     * critical for performance.
     * @defaultValue 300000 (5 minutes)
     */
    cacheTtl?: number;
  };
}

/**
 * Represents a persistent identity account.
 * 
 * This object links a FiveM player to their persistent roles, permissions, 
 * and operational status (e.g., bans).
 * 
 * @public
 */
export interface IdentityAccount<TId = any, TRoleId = any> {
  /** 
   * Internal unique database/store ID.
   */
  id: TId;

  /** 
   * Primary connection identifier (e.g., 'license:123...').
   */
  identifier?: string;

  /** 
   * Current technical role ID assigned to this account.
   */
  roleId?: TRoleId;

  /** 
   * Optional technical username for credentials-based authentication.
   */
  username?: string | null;

  /** 
   * Hashed password for credentials-based authentication.
   * 
   * @internal
   */
  passwordHash?: string | null;

  /** 
   * List of specific permission overrides for this account.
   * 
   * - `+perm`: Explicitly grant a permission.
   * - `-perm`: Explicitly revoke a permission (even if granted by role).
   */
  customPermissions: string[];

  /** 
   * Whether the account is currently prohibited from connecting.
   */
  isBanned: boolean;

  /** 
   * The reason provided for the current ban.
   */
  banReason?: string;

  /** 
   * Timestamp when the ban expires.
   * 
   * If null and isBanned is true, the ban is permanent.
   */
  banExpiresAt?: Date | null;
}
