import { injectable, inject } from "tsyringe";
import { Server } from "@open-core/framework/server";
import { IDENTITY_OPTIONS } from "../../tokens";
import type { IdentityAccount, IdentityOptions } from "../../types";
import { AuthResult, AuthService } from "../../auth.service";

/**
 * Authentication provider that delegates logic to an external HTTP API.
 *
 * This provider performs HTTP requests to a remote authentication service.
 * It is suitable for environments with a centralized user database or SSO.
 *
 * @injectable
 * @public
 */
@injectable()
export class ApiAuthProvider extends AuthService {
  /**
   * Initializes a new instance of the ApiAuthProvider.
   *
   * @param options - Identity system configuration options.
   */
  constructor(
    @inject(IDENTITY_OPTIONS) private readonly options: IdentityOptions,
  ) {
    super();
  }

  /**
   * Authenticates a player by sending credentials to the external API.
   *
   * @param player - The framework player entity.
   * @param credentials - Authentication data (e.g., tokens, external IDs).
   * @returns A promise resolving to the remote authentication result.
   */
  async authenticate(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<AuthResult> {
    return this.requestAuth("authenticate", player, credentials);
  }

  /**
   * Registers a player identity via the external API.
   *
   * @param player - The player to register.
   * @param credentials - Registration data.
   * @returns A promise resolving to the remote registration result.
   */
  async register(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<AuthResult> {
    return this.requestAuth("register", player, credentials);
  }

  /**
   * Validates the player's remote session.
   *
   * @param player - The framework player entity.
   * @returns A promise resolving to the remote session validation result.
   */
  async validateSession(player: Server.Player): Promise<AuthResult> {
    return this.requestAuth("session", player, {});
  }

  /**
   * Notifies the external API that the player has logged out.
   *
   * @param player - The framework player entity.
   */
  async logout(player: Server.Player): Promise<void> {
    const result = await this.requestAuth("logout", player, {});
    if (result.success) {
      player.unlinkAccount();
    }
  }

  private async requestAuth(
    action: "authenticate" | "register" | "session" | "logout",
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<AuthResult> {
    const config = this.options.auth.api;
    if (!config?.baseUrl) {
      return { success: false, error: "API auth is not configured" };
    }

    const identifiers = player.getPlayerIdentifiers();
    const primaryIdentifier = this.options.auth.primaryIdentifier || "license";
    const primary = identifiers.find(
      (identifier) => identifier.type === primaryIdentifier,
    );

    const payload = {
      action,
      accountId: player.accountID ?? null,
      primaryIdentifier: primary?.value ?? null,
      identifiers: identifiers.map((identifier) => ({
        type: identifier.type,
        value: identifier.value,
      })),
      credentials,
    };

    try {
      const response = await fetch(this.resolveUrl(config, action), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...config.headers,
        },
        body: JSON.stringify(payload),
        signal: this.getAbortSignal(config.timeoutMs),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `API auth failed (${response.status})`,
        };
      }

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        accountId?: string;
        isNewAccount?: boolean;
        account?: IdentityAccount;
      };

      if (!data.success || !data.accountId) {
        return {
          success: false,
          error: data.error ?? "Authentication rejected",
        };
      }

      if (action !== "logout") {
        player.linkAccount(String(data.accountId));
      }

      return {
        success: true,
        accountID: String(data.accountId),
        isNewAccount: data.isNewAccount,
        account: data.account,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "API auth error",
      };
    }
  }

  private resolveUrl(
    config: NonNullable<IdentityOptions["auth"]["api"]>,
    action: "authenticate" | "register" | "session" | "logout",
  ): string {
    const base = config.baseUrl.replace(/\/$/, "");
    const pathMap: Record<typeof action, string> = {
      authenticate: config.authPath ?? "/auth",
      register: config.registerPath ?? "/register",
      session: config.sessionPath ?? "/session",
      logout: config.logoutPath ?? "/logout",
    };

    return `${base}${pathMap[action]}`;
  }

  private getAbortSignal(timeoutMs?: number): AbortSignal | undefined {
    if (!timeoutMs || timeoutMs <= 0) return undefined;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }
}
