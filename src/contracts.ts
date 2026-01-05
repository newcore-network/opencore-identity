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
export abstract class IdentityStore {
  /**
   * Retrieves an account by its primary connection identifier.
   * 
   * @param identifier - The unique identifier (e.g., 'license:123...').
   * @returns A promise resolving to the account or null if not found.
   */
  abstract findByIdentifier(identifier: string): Promise<IdentityAccount | null>;

  /**
   * Retrieves an account by its linked stable ID.
   * 
   * @param linkedId - The stable ID (e.g., a UUID).
   * @returns A promise resolving to the account or null if not found.
   */
  abstract findByLinkedId(linkedId: string): Promise<IdentityAccount | null>;

  /**
   * Retrieves an account by its unique username.
   * 
   * @param username - The technical username.
   * @returns A promise resolving to the account or null if not found.
   */
  abstract findByUsername(username: string): Promise<IdentityAccount | null>;

  /**
   * Persists a new identity account.
   * 
   * @param data - Initial account properties.
   * @returns A promise resolving to the fully created account object.
   */
  abstract create(data: Partial<IdentityAccount> & { passwordHash?: string }): Promise<IdentityAccount>;

  /**
   * Updates an existing account's metadata or status.
   * 
   * @param id - The internal account ID.
   * @param data - Partial object containing fields to update.
   */
  abstract update(id: string | number, data: Partial<IdentityAccount>): Promise<void>;

  /**
   * Prohibits or allows an account from connecting.
   * 
   * @param id - The internal account ID.
   * @param banned - Connection status (true to block).
   * @param reason - Optional explanation for the ban.
   * @param expiresAt - Optional expiration timestamp.
   */
  abstract setBan(
    id: string | number,
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
export abstract class RoleStore {
  /**
   * Retrieves a role definition by its technical identifier.
   * 
   * @param id - Technical identifier (e.g., 'admin' or 1).
   * @returns A promise resolving to the role or null if not found.
   */
  abstract findById(id: string | number): Promise<IdentityRole | null>;

  /**
   * Resolves the default role for newly connected accounts.
   * 
   * @returns A promise resolving to the default role definition.
   */
  abstract getDefaultRole(): Promise<IdentityRole>;

  /**
   * Creates or updates a role definition.
   * 
   * @param role - The complete role object.
   */
  abstract save(role: IdentityRole): Promise<void>;

  /**
   * Removes a role from the system.
   * 
   * @param id - Technical identifier of the role to delete.
   */
  abstract delete(id: string | number): Promise<void>;
}
