import { injectable } from "tsyringe";
import { IdentityStore } from "../contracts";
import type { IdentityAccount } from "../types";

/**
 * High-level service for managing identity accounts and security policies.
 * 
 * Provides a programmer-friendly API for account administration, including 
 * role assignment, permission overrides, and ban management.
 * 
 * @public
 * @injectable
 */
@injectable()
export class AccountService {
  constructor(
    private readonly store: IdentityStore
  ) {}

  /**
   * Retrieves an account by its unique numeric or internal ID.
   * 
   * @param id - The internal account identifier.
   * @returns A promise resolving to the account or null if not found.
   */
  async findById(id: string): Promise<IdentityAccount | null> {
    return this.store.findByLinkedId(id); // Using linkedId as the primary public handle
  }

  /**
   * Retrieves an account by its stable linked ID.
   * 
   * @param linkedId - The stable ID (UUID or external system ID).
   * @returns A promise resolving to the account or null if not found.
   */
  async findByLinkedId(linkedId: string): Promise<IdentityAccount | null> {
    return this.store.findByLinkedId(linkedId);
  }

  /**
   * Persists a new identity account.
   * 
   * @param data - Initial account properties. ID can be provided or left to the store.
   * @returns A promise resolving to the fully created account object.
   */
  async create(data: Omit<IdentityAccount, "id"> & { id?: string | number; passwordHash?: string }): Promise<IdentityAccount> {
    return this.store.create(data);
  }

  /**
   * Updates an existing account's metadata or status.
   * 
   * @param id - The internal account ID.
   * @param data - Partial object containing fields to update.
   * @returns A promise that resolves when the update is complete.
   */
  async update(id: string | number, data: Partial<Omit<IdentityAccount, "id">>): Promise<void> {
    await this.store.update(id, data);
  }

  /**
   * Assigns a security role to an account.
   * 
   * @param accountId - The unique ID of the account.
   * @param roleId - Technical identifier of the role to assign.
   */
  async assignRole(accountId: string | number, roleId: string | number): Promise<void> {
    await this.update(accountId, { roleId });
  }

  /**
   * Grants a custom permission override to an account.
   * 
   * This override takes precedence over role permissions. 
   * Use the `+` prefix for clarity (optional).
   * 
   * @param accountId - The linked ID of the account.
   * @param permission - The permission string to grant.
   */
  async addCustomPermission(accountId: string, permission: string): Promise<void> {
    const account = await this.store.findByLinkedId(accountId);
    if (!account) return;

    const permissions = new Set(account.customPermissions);
    permissions.add(permission);

    await this.store.update(accountId, {
      customPermissions: Array.from(permissions),
    });
  }

  /**
   * Revokes a custom permission override.
   * 
   * To explicitly deny a permission that a role might grant, use the `-` prefix 
   * (e.g., `-chat.use`).
   * 
   * @param accountId - The linked ID of the account.
   * @param permission - The permission string to remove or revoke.
   */
  async removeCustomPermission(accountId: string, permission: string): Promise<void> {
    const account = await this.store.findByLinkedId(accountId);
    if (!account) return;

    const permissions = new Set(account.customPermissions);
    permissions.delete(permission);

    await this.store.update(accountId, {
      customPermissions: Array.from(permissions),
    });
  }

  /**
   * Prohibits an account from connecting to the server.
   * 
   * @param accountId - The linked ID of the account.
   * @param options - Ban details including optional reason and duration.
   */
  async ban(
    accountId: string,
    options: { reason?: string; durationMs?: number } = {}
  ): Promise<void> {
    const expiresAt = options.durationMs
      ? new Date(Date.now() + options.durationMs)
      : null;

    await this.store.setBan(accountId, true, options.reason, expiresAt);
  }

  /**
   * Lifts an active ban from an account.
   * 
   * @param accountId - The linked ID of the account.
   */
  async unban(accountId: string): Promise<void> {
    await this.store.setBan(accountId, false);
  }
}
