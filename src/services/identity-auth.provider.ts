import { injectable } from "tsyringe";
import { Server } from "@open-core/framework";

import type { Account } from "../entities/account.entity";
import { AccountService } from "./account.service";
import type { AccountIdentifiers } from "../types";

@injectable()
export class IdentityAuthProvider implements Server.AuthProviderContract {
  constructor(
    private readonly accounts: AccountService,
    private readonly config: Server.ConfigService,
  ) {}

  /**
   * Get the linked account ID (linkedId or numeric ID as fallback)
   */
  private getLinkedId(account: Account): string {
    return account.linkedId ?? String(account.id);
  }

  async authenticate(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<Server.AuthResult> {
    const identifiers = this.mergeIdentifiers(credentials, player);
    const { account, isNew } = await this.accounts.findOrCreate(identifiers);

    if (this.accounts.isBanExpired(account)) {
      await this.accounts.unban(account.id);
      account.banned = false;
      account.banExpires = null;
      account.banReason = null;
    }

    if (account.banned) {
      return {
        success: false,
        error: account.banReason ?? "Account banned",
        accountID: this.getLinkedId(account),
      };
    }

    const linkedId = this.getLinkedId(account);
    player.linkAccount(linkedId);
    await this.accounts.touchLastLogin(account.id);

    return {
      success: true,
      accountID: linkedId,
      isNewAccount: isNew,
    };
  }

  async register(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<Server.AuthResult> {
    // Registration flow is equivalent to authenticate with auto-create.
    return this.authenticate(player, credentials);
  }

  async validateSession(player: Server.Player): Promise<Server.AuthResult> {
    const linked = player.accountID;
    if (!linked) {
      // Attempt implicit authentication using identifiers if auto-create is enabled.
      const autoCreate = this.config.getBoolean("identity_auto_create", true);
      if (!autoCreate) {
        return { success: false, error: "Not authenticated" };
      }
      return this.authenticate(player, {});
    }

    const account = await this.accounts.findByLinkedId(String(linked));
    if (!account) {
      return { success: false, error: "Account not found", accountID: linked };
    }

    if (this.accounts.isBanExpired(account)) {
      await this.accounts.unban(account.id);
      account.banned = false;
    }

    if (account.banned) {
      return {
        success: false,
        error: account.banReason ?? "Account banned",
        accountID: this.getLinkedId(account),
      };
    }

    return { success: true, accountID: this.getLinkedId(account) };
  }

  async logout(player: Server.Player): Promise<void> {
    // The framework session holds the account binding; clearing meta is enough for now.
    player.setMeta("identity:session", null);
  }

  private mergeIdentifiers(
    credentials: Record<string, unknown>,
    player: Server.Player,
  ): AccountIdentifiers {
    const fromCredentials = this.extractIdentifiers(credentials);
    const fromPlayer = this.extractFromPlayer(player);
    return {
      license: fromCredentials.license ?? fromPlayer.license ?? null,
      discord: fromCredentials.discord ?? fromPlayer.discord ?? null,
      steam: fromCredentials.steam ?? fromPlayer.steam ?? null,
    };
  }

  private extractIdentifiers(
    input: Record<string, unknown>,
  ): AccountIdentifiers {
    return {
      license: typeof input.license === "string" ? input.license : null,
      discord: typeof input.discord === "string" ? input.discord : null,
      steam: typeof input.steam === "string" ? input.steam : null,
    };
  }

  private extractFromPlayer(player: Server.Player): AccountIdentifiers {
    const identifiers = player.getIdentifiers();
    const result: AccountIdentifiers = {
      license: null,
      discord: null,
      steam: null,
    };

    for (const raw of identifiers) {
      if (raw.startsWith("license:"))
        result.license = raw.slice("license:".length);
      if (raw.startsWith("discord:"))
        result.discord = raw.slice("discord:".length);
      if (raw.startsWith("steam:")) result.steam = raw.slice("steam:".length);
    }

    return result;
  }
}
