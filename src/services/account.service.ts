import { injectable } from "tsyringe";
import { IdentityStore, RoleStore } from "../contracts";
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
export class AccountService<TId = any, TLinkedId = any, TRoleId = any> {
  constructor(
    public readonly store: IdentityStore<TId, TLinkedId, TRoleId>
  ) {}

  /**
   * Retrieves all accounts assigned to a specific role.
   * 
   * @param roleId - The role identifier.
   * @returns A promise resolving to an array of accounts.
   */
  async findByRole(roleId: TRoleId): Promise<IdentityAccount[]> {
    return this.store.findByRole(roleId);
  }

  /**
   * Retrieves all accounts that are currently prohibited from connecting.
   * 
   * @returns A promise resolving to an array of banned accounts.
   */
  async findBanned(): Promise<IdentityAccount[]> {
    return this.store.findBanned();
  }

  async assignRole(
    accountId: TId, 
    roleId: TRoleId,
    options: { clearCustomPermissions?: boolean } = {}
  ): Promise<void> {
    const updateData: Partial<IdentityAccount> = { roleId };
    
    if (options.clearCustomPermissions) {
      updateData.customPermissions = [];
    }

    await this.store.update(accountId, updateData);
  }

  /**
   * Checks if an account has a specific permission, considering both role and custom overrides.
   * 
   * @param accountId - The account identifier.
   * @param permission - The permission string to check.
   * @param roleStore - Required to resolve the role's base permissions.
   */
  async hasPermission(
    linkedID: TLinkedId, 
    permission: string,
    roleStore: RoleStore
  ): Promise<boolean> {
    const account = await this.store.findByLinkedId(linkedID);
    if (!account) return false;

    if (!account.roleId) return account.customPermissions.includes(permission);

    const role = await roleStore.findById(account.roleId);
    const basePermissions = role?.permissions || [];
    
    // Simple resolution logic (could be more complex with wildcards)
    const permissions = new Set(basePermissions);
    for (const override of account.customPermissions) {
      if (override === `+${permission}` || override === permission) return true;
      if (override === `-${permission}`) return false;
    }
    
    return permissions.has(permission) || permissions.has("*");
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
  async addCustomPermission(linkedID: TLinkedId, permission: string): Promise<void> {
    const account = await this.store.findByLinkedId(linkedID);
    if (!account) return;

    const permissions = new Set(account.customPermissions);
    permissions.add(permission);

    await this.store.update(account.id, {
      customPermissions: Array.from(permissions),
    });
  }

  /**
   * Revokes a custom permission override.
   * 
   * To explicitly deny a permission that a role might grant, use the `-` prefix 
   * (e.g., `-chat.use`).
   * 
   * @param linkedID - The linked ID of the account.
   * @param permission - The permission string to remove or revoke.
   */
  async removeCustomPermission(linkedID: TLinkedId, permission: string): Promise<void> {
    const account = await this.store.findByLinkedId(linkedID);
    if (!account) return;

    const permissions = new Set(account.customPermissions);
    permissions.delete(permission);

    await this.store.update(account.id, {
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
    accountId: TId,
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
  async unban(accountId: TId): Promise<void> {
    await this.store.setBan(accountId, false);
  }
}
