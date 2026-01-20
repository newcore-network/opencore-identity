import { injectable, inject } from "tsyringe";
import { Server } from "@open-core/framework/server";
import { IDENTITY_OPTIONS } from "../../tokens";
import { IdentityStore } from "../../contracts";
import type { IdentityOptions } from "../../types";
import { AuthResult, AuthService } from "../../auth.service";

/**
 * Local Authentication Provider for the OpenCore Identity System.
 * handles the logic for local (identifier-based) authentication strategies.
 */
@injectable()
export class LocalAuthProvider extends AuthService {
  /**
   * Initializes a new instance of the IdentityAuthProvider.
   *
   * @param options - Identity system configuration options.
   * @param store - Persistence layer for account data.
   */
  constructor(
    @inject(IDENTITY_OPTIONS) private readonly options: IdentityOptions,
    private readonly store: IdentityStore,
  ) {
    super();
  }

  /**
   * Authenticates a player based on the configured strategy.
   *
   * @param player - The player to authenticate.
   * @param credentials - Optional credentials (unused in local mode).
   * @returns A promise resolving to an {@link AuthResult}.
   */
  async authenticate(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<AuthResult> {
    try {
      return await this.authenticateLocally(player);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal authentication error",
      };
    }
  }

  /**
   * Registers a new player identity.
   *
   * @param player - The player to register.
   * @param credentials - Registration data.
   * @returns A promise resolving to an {@link AuthResult}.
   */
  async register(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<AuthResult> {
    return this.authenticate(player, credentials);
  }

  /**
   * Validates the current session for a player.
   *
   * @param player - The player whose session to validate.
   * @returns A promise resolving to an {@link AuthResult}.
   */
  async validateSession(player: Server.Player): Promise<AuthResult> {
    const accountId = player.accountID;
    if (!accountId) return { success: false, error: "No active session" };

    const account = await this.store.findByLinkedId(accountId);
    if (!account) return { success: false, error: "Account no longer exists" };

    if (
      account.isBanned &&
      (!account.banExpiresAt || new Date(account.banExpiresAt) > new Date())
    ) {
      return {
        success: false,
        error: account.banReason ?? "Account is banned",
      };
    }

    return { success: true, accountID: String(account.id), account };
  }

  /**
   * Clears the authentication state for a player.
   *
   * @param player - The player to log out.
   */
  async logout(player: Server.Player): Promise<void> {
    player.unlinkAccount();
  }

  /**
   * Internal implementation for local authentication strategy.
   *
   * @internal
   */
  private async authenticateLocally(
    player: Server.Player,
  ): Promise<AuthResult> {
    const primaryType = this.options.auth.primaryIdentifier || "license";
    const identifiers = player.getPlayerIdentifiers();
    const identifierFound = identifiers.find(
      (identifier) => identifier.type === primaryType,
    );

    if (!identifierFound) {
      return {
        success: false,
        error: `Missing required identifier: ${primaryType}`,
      };
    }

    let account = await this.store.findByIdentifier(identifierFound.value);
    let isNew = false;

    if (!account) {
      if (this.options.auth.autoCreate === false) {
        return {
          success: false,
          error: "Account not found and auto-create is disabled",
        };
      }

      account = await this.store.create({
        identifier: identifierFound.value,
        customPermissions: [],
        isBanned: false,
      });
      isNew = true;
    }

    if (account.isBanned) {
      if (account.banExpiresAt && new Date(account.banExpiresAt) < new Date()) {
        await this.store.setBan(account.id, false);
      } else {
        return {
          success: false,
          error: account.banReason ?? "Account is banned",
        };
      }
    }

    const accountIdStr = String(account.id);
    player.linkAccount(accountIdStr);
    return {
      success: true,
      accountID: accountIdStr,
      account,
      isNewAccount: isNew,
    };
  }
}
