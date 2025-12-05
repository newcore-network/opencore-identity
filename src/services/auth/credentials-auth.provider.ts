import { injectable } from "tsyringe";
import { Server } from "@open-core/framework";
import * as bcrypt from "bcrypt";

import type { Account } from "../../entities/account.entity";
import { AccountService } from "../account.service";
import type { AccountIdentifiers } from "../../types";

/**
 * Credentials-based authentication provider using username/password.
 * Requires password_hash column in accounts table (migration 005).
 *
 * Features:
 * - Validates username and password
 * - Uses bcrypt for password hashing
 * - Does NOT auto-create accounts (must be registered first)
 * - Can optionally merge FiveM identifiers after authentication
 */
@injectable()
export class CredentialsAuthProvider implements Server.AuthProviderContract {
  private readonly saltRounds = 10;

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
    const username = credentials.username as string | undefined;
    const password = credentials.password as string | undefined;

    if (!username || !password) {
      return {
        success: false,
        error: "Username and password are required",
      };
    }

    // Find account by username
    const account = await this.accounts.findByUsername(username);
    if (!account) {
      return {
        success: false,
        error: "Invalid credentials",
      };
    }

    // Validate password (requires password_hash in Account entity)
    const passwordHash = (account as Account & { passwordHash?: string })
      .passwordHash;
    if (!passwordHash) {
      return {
        success: false,
        error: "Account has no password set",
      };
    }

    const isValid = await bcrypt.compare(password, passwordHash);
    if (!isValid) {
      return {
        success: false,
        error: "Invalid credentials",
      };
    }

    // Check ban status
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

    // Link account and update last login
    const linkedId = this.getLinkedId(account);
    player.linkAccount(linkedId);
    await this.accounts.touchLastLogin(account.id);

    // Optionally merge FiveM identifiers
    const shouldMergeIdentifiers = this.config.getBoolean(
      "identity_merge_identifiers",
      false,
    );
    if (shouldMergeIdentifiers) {
      // TODO: Implement updateIdentifiers in AccountService
      // const identifiers = this.extractFromPlayer(player);
      // await this.accounts.updateIdentifiers(account.id, identifiers);
    }

    return {
      success: true,
      accountID: linkedId,
      isNewAccount: false,
    };
  }

  async register(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<Server.AuthResult> {
    const username = credentials.username as string | undefined;
    const password = credentials.password as string | undefined;

    if (!username || !password) {
      return {
        success: false,
        error: "Username and password are required",
      };
    }

    // Check if username already exists
    const existing = await this.accounts.findByUsername(username);
    if (existing) {
      return {
        success: false,
        error: "Username already taken",
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    // Create account with password
    const account = await this.accounts.createWithCredentials({
      username,
      passwordHash,
      identifiers: this.extractFromPlayer(player),
    });

    const linkedId = this.getLinkedId(account);
    player.linkAccount(linkedId);

    return {
      success: true,
      accountID: linkedId,
      isNewAccount: true,
    };
  }

  async validateSession(player: Server.Player): Promise<Server.AuthResult> {
    const linked = player.accountID;
    if (!linked) {
      return { success: false, error: "Not authenticated" };
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
    player.setMeta("identity:session", null);
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
