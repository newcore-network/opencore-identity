import { injectable, inject } from "tsyringe";
import { Server } from "@open-core/framework/server";
import { IDENTITY_OPTIONS } from "../../tokens";
import { IdentityStore, RoleStore } from "../../contracts";
import type { IdentityOptions, IdentityRole } from "../../types";

/**
 * Authorization provider implementation for the OpenCore Framework.
 * 
 * This provider resolves player principals (roles and permissions) by 
 * interacting with the configured {@link IdentityStore} and {@link RoleStore}.
 * It includes a high-performance in-memory cache to minimize database 
 * overhead during frequent security checks (e.g., in `@Guard` decorators).
 * 
 * @injectable
 * @public
 */
@injectable()
export class IdentityPrincipalProvider extends Server.PrincipalProviderContract {
  /** 
   * In-memory cache for resolved principals.
   * Key: clientId (number)
   */
  private readonly cache = new Map<number, { principal: Server.Principal; expiresAt: number }>();
  
  /** Cache TTL in milliseconds */
  private readonly cacheTtl: number;

  /**
   * Initializes a new instance of the IdentityPrincipalProvider.
   * 
   * @param options - Identity system configuration options.
   * @param accountStore - Persistence layer for account data.
   * @param roleStore - Optional persistence layer for dynamic roles.
   */
  constructor(
    @inject(IDENTITY_OPTIONS) private readonly options: IdentityOptions,
    private readonly accountStore: IdentityStore,
    private readonly roleStore?: RoleStore
  ) {
    super();
    this.cacheTtl = options.principal.cacheTtl ?? 300000; // 5 minutes default
  }

  /**
   * Resolves the security Principal for a connected player.
   * 
   * This method first checks the internal cache. If missing or expired, 
   * it resolves the account and its effective permissions.
   * 
   * @param player - The framework player entity.
   * @returns A promise resolving to the {@link Server.Principal} or null if not authenticated.
   */
  async getPrincipal(player: Server.Player): Promise<Server.Principal | null> {
    const clientId = player.clientID;
    const cached = this.cache.get(clientId);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.principal;
    }

    const linkedId = player.accountID;
    if (!linkedId) return null;

    const principal = await this.resolvePrincipal(linkedId);
    if (principal) {
      this.cache.set(clientId, {
        principal,
        expiresAt: Date.now() + this.cacheTtl,
      });
    }

    return principal;
  }

  /**
   * Invalidates the cache and re-resolves the principal for a player.
   * 
   * @param player - The player whose principal should be refreshed.
   */
  async refreshPrincipal(player: Server.Player): Promise<void> {
    this.cache.delete(player.clientID);
    await this.getPrincipal(player);
  }

  /**
   * Resolves a principal for offline workflows using a stable account ID.
   * 
   * @param linkedID - The linked account identifier.
   * @returns A promise resolving to the principal or null.
   */
  async getPrincipalByLinkedID(linkedID: string): Promise<Server.Principal | null> {
    return this.resolvePrincipal(linkedID);
  }

  /**
   * Internal logic to resolve effective permissions and construct the Principal.
   * 
   * @param linkedId - The stable account ID.
   * @returns Resolves the role, merges permissions, and returns the Principal.
   * @internal
   */
  private async resolvePrincipal(linkedId: string): Promise<Server.Principal | null> {
    const account = await this.accountStore.findByLinkedId(linkedId);
    if (!account) return null;

    let role: IdentityRole | undefined;
    const roleId = account.roleId;

    if (roleId !== undefined && roleId !== null && roleId !== "") {
      if (this.options.principal.mode === "roles") {
        role = this.options.principal.roles?.[roleId];
      } else if (this.roleStore) {
        const dbRole = await this.roleStore.findById(roleId);
        if (dbRole) role = dbRole;
      }
    }

    if (!role) {
      const defaultRoleOption = this.options.principal.defaultRole;
      if (defaultRoleOption !== undefined && defaultRoleOption !== null && defaultRoleOption !== "") {
        // 1. Try to resolve from static roles if it's an ID
        if (typeof defaultRoleOption === "string") {
          role = this.options.principal.roles?.[defaultRoleOption];
        } else {
          // It was an object that should have been registered as 'default_auto'
          role = this.options.principal.roles?.["default_auto"];
        }
        
        // 2. If still not found and in DB mode, ask the store
        if (!role && this.roleStore && this.options.principal.mode === "db") {
          role = await this.roleStore.getDefaultRole();
        }
      }
    }

    if (!role) return null;

    const effectivePermissions = this.mergePermissions(
      role.permissions,
      account.customPermissions
    );

    return {
      id: linkedId,
      name: role.displayName || String(role.id),
      rank: role.rank,
      permissions: effectivePermissions,
      meta: {
        accountId: account.id,
        roleId: role.id,
      },
    };
  }

  /**
   * Merges role-based permissions with account-specific overrides.
   * 
   * Overrides starting with '-' are removed, and those starting with '+' 
   * (or without prefix) are added to the final set.
   * 
   * @param base - Base permissions from the role.
   * @param overrides - Custom overrides from the account.
   * @returns The unified list of effective permissions.
   * @internal
   */
  private mergePermissions(base: string[], overrides: string[]): string[] {
    const perms = new Set(base);

    for (const override of overrides) {
      if (override.startsWith("-")) {
        perms.delete(override.substring(1));
      } else if (override.startsWith("+")) {
        perms.add(override.substring(1));
      } else {
        perms.add(override);
      }
    }

    return Array.from(perms);
  }
}
