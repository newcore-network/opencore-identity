import { injectable } from "tsyringe";
import { Server, Utils } from "@open-core/framework";

import { AccountService } from "../account.service";
import { AccountRepository } from "../../repositories/account.repository";
import type { Account } from "../../entities/account.entity";
import type { Role } from "../../entities/role.entity";

/**
 * Local principal provider that reads roles and permissions from local database.
 * This is the default/traditional principal provider for FiveM servers.
 *
 * Features:
 * - Reads from local database (accounts + roles tables)
 * - Combines role permissions with custom account permissions
 * - Supports permission negation (e.g., "-admin.ban")
 * - Caches in player metadata
 */
@injectable()
export class LocalPrincipalProvider
  implements Server.PrincipalProviderContract
{
  constructor(
    private readonly accounts: AccountService,
    private readonly repo: AccountRepository,
  ) {}

  async getPrincipal(player: Server.Player): Promise<Server.Principal | null> {
    const linked = player.accountID;
    if (!linked) {
      throw new Utils.AppError(
        "UNAUTHORIZED",
        "Player is not authenticated (no linked account)",
        "server",
      );
    }

    const result = await this.repo.findByLinkedIdWithRole(String(linked));
    if (!result) {
      throw new Utils.AppError(
        "UNAUTHORIZED",
        "Linked account not found",
        "server",
      );
    }

    const { account, role } = result;

    if (this.accounts.isBanExpired(account)) {
      await this.accounts.unban(account.id);
      account.banned = false;
    }

    if (account.banned) {
      throw new Utils.AppError(
        "PERMISSION_DENIED",
        "Account is banned",
        "server",
        {
          banReason: account.banReason,
          banExpires: account.banExpires,
        },
      );
    }

    return this.toPrincipal(account, role);
  }

  async refreshPrincipal(player: Server.Player): Promise<void> {
    const principal = await this.getPrincipal(player);
    player.setMeta("identity:principal", principal);
  }

  async getPrincipalByLinkedID(
    linkedID: string,
  ): Promise<Server.Principal | null> {
    const result = await this.repo.findByLinkedIdWithRole(linkedID);
    if (!result || result.account.banned) return null;
    return this.toPrincipal(result.account, result.role);
  }

  /**
   * Builds a Principal from account and role.
   * Combines role permissions with account custom permissions.
   *
   * @param account - Account entity
   * @param role - Role entity (or null if no role assigned)
   * @returns Principal with combined permissions
   */
  private toPrincipal(account: Account, role: Role | null): Server.Principal {
    const effectivePermissions = this.combinePermissions(
      role,
      account.customPermissions,
    );

    return {
      id: account.linkedId ?? String(account.id),
      name: role?.displayName ?? undefined,
      rank: role?.rank ?? undefined,
      permissions: effectivePermissions,
      meta: {
        accountId: account.id,
        roleId: role?.id,
        roleName: role?.name,
      },
    };
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
}
