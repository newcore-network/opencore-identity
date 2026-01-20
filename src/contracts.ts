import type { IdentityAccount, IdentityRole } from "./types";

/**
 * Persistence contract for identity accounts.
 *
 * Implement this interface to provide a storage backend (SQL, NoSQL, or API)
 * for account-related operations. The identity system depends on this contract
 * to lookup and manage persistent player state.
 *
 * @public
 */
export abstract class IdentityStore<TId = any, TLinkedId = any, TRoleId = any> {
  /**
   * Retrieves an account by its primary connection identifier.
   *
   * @param identifier - The unique identifier (e.g., 'license:123...').
   * @returns A promise resolving to the account or null if not found.
   */
  abstract findByIdentifier(identifier: string): Promise<IdentityAccount | null>;

  /**
   * Retrieves an account by its unique numeric or internal ID.
   *
   * @param id - The internal account identifier (database ID).
   * @returns A promise resolving to the account or null if not found.
   */
  abstract findById(id: TId): Promise<IdentityAccount | null>;

  /**
   * Retrieves an account by its linked stable ID.
   *
   * @param linkedId - The stable ID (e.g., a UUID).
   * @returns A promise resolving to the account or null if not found.
   */
  abstract findByLinkedId(linkedId: TLinkedId): Promise<IdentityAccount | null>;

  /**
   * Retrieves an account by its unique username.
   *
   * @param username - The technical username.
   * @returns A promise resolving to the account or null if not found.
   */
  abstract findByUsername(username: string): Promise<IdentityAccount | null>;

  /**
   * Retrieves all accounts that are currently banned.
   *
   * @returns A promise resolving to an array of banned accounts.
   */
  abstract findBanned(): Promise<IdentityAccount[]>;

  /**
   * Retrieves all accounts assigned to a specific role.
   *
   * @param roleId - The role identifier.
   * @returns A promise resolving to an array of accounts.
   */
  abstract findByRole(roleId: TRoleId): Promise<IdentityAccount[]>;

  /**
   * Persists a new identity account.
   *
   * @param data - Initial account properties (ID is optional as it's usually handled by the store).
   * @returns A promise resolving to the fully created account object.
   */
  abstract create(data: Omit<IdentityAccount, "id"> & { id?: TId; passwordHash?: string }): Promise<IdentityAccount>;

  /**
   * Updates an existing account's metadata or status.
   *
   * @param id - The internal account ID.
   * @param data - Partial object containing fields to update.
   */
  abstract update(id: TId, data: Partial<Omit<IdentityAccount, "id">>): Promise<void>;

  /**
   * Prohibits or allows an account from connecting.
   *
   * @param id - The internal account ID.
   * @param banned - Connection status (true to block).
   * @param reason - Optional explanation for the ban.
   * @param expiresAt - Optional expiration timestamp.
   */
  abstract setBan(
    id: TId,
    banned: boolean,
    reason?: string,
    expiresAt?: Date | null,
  ): Promise<void>;
}

/**
 * Persistence contract for security roles.
 *
 * Implement this interface if your system requires dynamic role management
 * from a database. If using code-first roles, this contract is optional.
 *
 * @public
 */
export abstract class RoleStore<TId = any> {
  /**
   * Retrieves a role definition by its technical identifier.
   *
   * @param id - Technical identifier (e.g., 'admin' or 1).
   * @returns A promise resolving to the role or null if not found.
   */
  abstract findById(id: TId): Promise<IdentityRole | null>;

  abstract findByName(name: string): Promise<IdentityRole | null>

  /**
   * Retrieves a role by its hierarchical rank.
   *
   * @param rank - The numeric rank to search for.
   * @returns A promise resolving to the role or null if not found.
   */
  abstract findByRank(rank: number): Promise<IdentityRole | null>;

  /**
   * Retrieves all roles that grant a specific permission.
   *
   * @param permission - The permission string to search for.
   * @returns A promise resolving to an array of roles.
   */
  abstract findByPermission(permission: string): Promise<IdentityRole[]>;

  /**
   * Retrieves all registered roles in the system.
   *
   * @returns A promise resolving to an array of all roles.
   */
  abstract findAll(): Promise<IdentityRole[]>;

  /**
   * Resolves the default role for newly connected accounts.
   *
   * @returns A promise resolving to the default role definition.
   */
  abstract getDefaultRole(): Promise<IdentityRole>;

  /**
   * Persists a new security role definition.
   *
   * @param role - Initial role properties. ID can be provided or left to the store.
   * @returns A promise resolving to the fully created role object.
   */
  abstract create(role: Omit<IdentityRole, "id"> & { id?: TId }): Promise<IdentityRole>;

  /**
   * Updates an existing role definition.
   *
   * @param id - Technical identifier of the role to update.
   * @param role - Partial role object containing the fields to modify.
   */
  abstract update(id: TId, role: Partial<Omit<IdentityRole, "id">>): Promise<void>;

  /**
   * Removes a role from the system.
   *
   * @param id - Technical identifier of the role to delete.
   */
  abstract delete(id: TId): Promise<void>;
}
