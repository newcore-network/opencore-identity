import { injectable, inject } from "tsyringe";
import { Server } from "@open-core/framework";
import { v4 as uuidv4 } from "uuid";
import { IDENTITY_OPTIONS } from "../../tokens";
import { IdentityStore } from "../../contracts";
import type { AuthMode, IdentityOptions } from "../../types";

/**
 * Result structure for authentication operations.
 * 
 * @public
 */
interface AuthResult {
  /** Indicates if the operation was successful */
  success: boolean;
  /** The unique identifier for the authenticated account */
  accountID?: string;
  /** Error message if the operation failed */
  error?: string;
  /** Indicates if a new account was created during the process */
  isNewAccount?: boolean;
}

/**
 * Local Authentication Provider for the OpenCore Identity System.
 * 
 * This provider implements the framework's {@link Server.AuthProviderContract} and
 * handles the logic for local (identifier-based) authentication strategies.
 * 
 * @injectable
 * @public
 */
@injectable()
export class LocalAuthProvider extends Server.AuthProviderContract {
  /**
   * Initializes a new instance of the IdentityAuthProvider.
   * 
   * @param options - Identity system configuration options.
   * @param store - Persistence layer for account data.
   * @param config - Framework configuration service.
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
   * @param credentials - Optional credentials (used in API or credentials mode).
   * @returns A promise resolving to an {@link AuthResult}.
   */
  async authenticate(
    player: Server.Player,
    credentials: Record<string, unknown>
  ): Promise<AuthResult> {
    try {
      if (this.options.auth.mode === "api") {
        return await this.authenticateViaApi(player, credentials);
      }

      return await this.authenticateLocally(player);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Internal authentication error",
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
    credentials: Record<string, unknown>
  ): Promise<AuthResult> {
    return { success: false, error: "Registration not implemented in current mode" };
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

    if (account.isBanned && (!account.banExpiresAt || account.banExpiresAt > new Date())) {
      return { success: false, error: account.banReason ?? "Account is banned" };
    }

    return { success: true, accountID: String(account.id) };
  }

  /**
   * Clears the authentication state for a player.
   * 
   * @param player - The player to log out.
   */
  async logout(player: Server.Player): Promise<void> {
    // Session state is managed by the framework's player entity.
  }

  /**
   * Internal implementation for local authentication strategy.
   * 
   * @internal
   */
  private async authenticateLocally(player: Server.Player): Promise<AuthResult> {
    const primaryType = this.options.auth.primaryIdentifier || "license";
    const identifiers = player.getIdentifiers();
    const identifierValue = identifiers.find(id => id.startsWith(`${primaryType}:`));

    if (!identifierValue) {
      return { success: false, error: `Missing required identifier: ${primaryType}` };
    }

    let account = await this.store.findByIdentifier(identifierValue);
    let isNew = false;

    if (!account) {
      if (this.options.auth.autoCreate === false) {
        return { success: false, error: "Account not found and auto-create is disabled" };
      }

      account = await this.store.create({
        identifier: identifierValue,
        roleId: "user",
        customPermissions: [],
        isBanned: false,
      });
      isNew = true;
    }

    if (account.isBanned) {
      if (account.banExpiresAt && account.banExpiresAt < new Date()) {
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
    return { success: true, accountID: accountIdStr, isNewAccount: isNew };
  }

  /**
   * Internal implementation for API-based authentication strategy.
   * 
   * @internal
   */
  private async authenticateViaApi(
    player: Server.Player,
    credentials: Record<string, unknown>
  ): Promise<AuthResult> {
    return { success: false, error: "API Auth Mode not yet fully implemented" };
  }
}
