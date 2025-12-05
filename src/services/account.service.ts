import { injectable } from "tsyringe";
import { Server } from "@open-core/framework";
import { randomUUID } from "crypto";

import type { Account } from "../entities/account.entity";
import type { Role } from "../entities/role.entity";
import type { AccountIdentifiers, BanOptions, IdentifierType } from "../types";
import { AccountRepository } from "../repositories/account.repository";
import { RoleService } from "./role.service";

@injectable()
export class AccountService {
  constructor(
    private readonly repo: AccountRepository,
    private readonly roleService: RoleService,
    private readonly config: Server.ConfigService,
  ) {}

  async findById(id: number): Promise<Account | null> {
    return this.repo.findById(id);
  }

  async findByLinkedId(linkedId: string): Promise<Account | null> {
    return this.repo.findByLinkedId(linkedId);
  }

  async findByIdentifier(
    type: IdentifierType,
    value: string,
  ): Promise<Account | null> {
    return this.repo.findByIdentifier(type, value);
  }

  async findOrCreate(
    identifiers: AccountIdentifiers,
  ): Promise<{ account: Account; isNew: boolean }> {
    const existing = await this.lookupExisting(identifiers);
    if (existing) {
      return { account: existing, isNew: false };
    }

    // Get default role for new accounts
    const defaultRole = await this.roleService.getDefaultRole();

    // Auto-generate linkedId by default (UUID format for local accounts)
    const created = await this.repo.createAccount({
      linkedId: randomUUID(),
      externalSource: "local",
      license: identifiers.license ?? null,
      discord: identifiers.discord ?? null,
      steam: identifiers.steam ?? null,
      username: null,
      roleId: defaultRole?.id ?? null,
    });

    return { account: created, isNew: true };
  }

  async ban(accountId: number, options: BanOptions): Promise<void> {
    const expires = options.durationMs
      ? new Date(Date.now() + options.durationMs)
      : null;
    await this.repo.setBan(
      accountId,
      true,
      options.reason ?? "Banned",
      expires,
    );
  }

  async unban(accountId: number): Promise<void> {
    await this.repo.setBan(accountId, false, null, null);
  }

  isBanExpired(account: Account): boolean {
    if (!account.banned) return false;
    if (!account.banExpires) return false;
    return account.banExpires.getTime() <= Date.now();
  }

  /**
   * Add a custom permission to an account (override/additional to role).
   *
   * @param accountId - Account ID
   * @param permission - Permission string to add
   */
  async addCustomPermission(
    accountId: number,
    permission: string,
  ): Promise<void> {
    const account = await this.repo.findById(accountId);
    if (!account) return;

    const permissions = new Set(account.customPermissions ?? []);
    permissions.add(permission);
    await this.repo.updateCustomPermissions(accountId, Array.from(permissions));
  }

  /**
   * Remove a custom permission from an account.
   *
   * @param accountId - Account ID
   * @param permission - Permission string to remove
   */
  async removeCustomPermission(
    accountId: number,
    permission: string,
  ): Promise<void> {
    const account = await this.repo.findById(accountId);
    if (!account) return;

    const filtered = (account.customPermissions ?? []).filter(
      (p) => p !== permission && p !== `-${permission}`,
    );
    await this.repo.updateCustomPermissions(accountId, filtered);
  }

  /**
   * Get effective permissions for an account (role + custom).
   *
   * @param accountId - Account ID
   * @returns Combined permissions array
   */
  async getEffectivePermissions(accountId: number): Promise<string[]> {
    const result = await this.repo.findByIdWithRole(accountId);
    if (!result) return [];

    return this.combinePermissions(
      result.role,
      result.account.customPermissions,
    );
  }

  /**
   * Assign a role to an account.
   *
   * @param accountId - Account ID
   * @param roleId - Role ID to assign (null to remove role)
   */
  async assignRole(accountId: number, roleId: number | null): Promise<void> {
    await this.repo.updateRole(accountId, roleId);
  }

  /**
   * Combine role permissions with account custom permissions.
   * Custom permissions starting with '-' negate the base permission.
   *
   * @param role - Role with base permissions
   * @param customPerms - Account custom permissions
   * @returns Combined permissions array
   */
  private combinePermissions(
    role: Role | null,
    customPerms: string[],
  ): string[] {
    const base = new Set(role?.permissions ?? []);

    for (const perm of customPerms) {
      if (perm.startsWith("-")) {
        // Negation: remove the base permission
        base.delete(perm.slice(1));
      } else {
        // Addition: add custom permission
        base.add(perm);
      }
    }

    return Array.from(base);
  }

  async touchLastLogin(
    accountId: number,
    date: Date = new Date(),
  ): Promise<void> {
    await this.repo.updateLastLogin(accountId, date);
  }

  private async lookupExisting(
    identifiers: AccountIdentifiers,
  ): Promise<Account | null> {
    const ordered = this.identifierPriority();
    for (const key of ordered) {
      const value = identifiers[key];
      if (!value) continue;
      const found = await this.repo.findByIdentifier(key, value);
      if (found) return found;
    }
    // Fallback: try any provided identifiers
    for (const [key, value] of Object.entries(identifiers)) {
      if (!value) continue;
      const found = await this.repo.findByIdentifier(
        key as IdentifierType,
        value,
      );
      if (found) return found;
    }
    return null;
  }

  private identifierPriority(): IdentifierType[] {
    const fromConfig = this.config.get(
      "identity_primary_identifier",
      "license",
    ) as IdentifierType;
    const base: IdentifierType[] = ["license", "discord", "steam"];
    return [fromConfig, ...base.filter((id) => id !== fromConfig)];
  }

  /**
   * Find account by username (for credentials auth)
   * Note: This is a basic implementation. For production, add an index on username.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findByUsername(_username: string): Promise<Account | null> {
    // TODO: Add findByUsername method to AccountRepository for better performance
    // For now, this is a placeholder that credentials auth will need
    throw new Error(
      "findByUsername not implemented - add to AccountRepository for credentials auth",
    );
  }

  /**
   * Update account identifiers (for credentials auth identifier merging)
   */
  async updateIdentifiers(): Promise<void> {
    // This is a placeholder - in production you'd want a proper update method
    // For now, credentials auth can work without this
    console.warn(
      "updateIdentifiers not fully implemented - identifiers not merged",
    );
  }

  /**
   * Create account with credentials (for CredentialsAuthProvider)
   */
  async createWithCredentials(input: {
    username: string;
    passwordHash: string;
    identifiers: AccountIdentifiers;
  }): Promise<Account> {
    const defaultRole = await this.roleService.getDefaultRole();

    // Note: This creates an account without password_hash field
    // You'll need to add password_hash to Account entity and migration 005
    return this.repo.createAccount({
      linkedId: randomUUID(),
      externalSource: "credentials",
      username: input.username,
      license: input.identifiers.license ?? null,
      discord: input.identifiers.discord ?? null,
      steam: input.identifiers.steam ?? null,
      roleId: defaultRole?.id ?? null,
    });
  }
}
