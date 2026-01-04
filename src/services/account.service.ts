import { injectable, inject } from "tsyringe";
import { IDENTITY_OPTIONS } from "../tokens";
import { IdentityStore } from "../contracts";
import type { IdentityAccount, IdentityOptions } from "../types";

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
    private readonly store: IdentityStore,
    @inject(IDENTITY_OPTIONS) private readonly options: IdentityOptions
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
   * Assigns a security role to an account.
   * 
   * @param accountId - The linked ID of the account.
   * @param roleName - Technical name of the role to assign.
   */
  async assignRole(accountId: string, roleName: string): Promise<void> {
    await this.store.update(accountId, { roleName });
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
