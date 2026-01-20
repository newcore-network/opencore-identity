import { injectable } from "tsyringe";
import { Server } from "@open-core/framework/server";
import { IdentityStore, RoleStore } from "../../contracts";
import type { IdentityAccount } from "../../types";
import { AuthResult, AuthService } from "../../auth.service";
import bcrypt from "bcryptjs";

/**
 * Authentication provider for username and password credentials.
 *
 * This provider uses bcrypt for password hashing and validation. It requires
 * an implementation of {@link IdentityStore} that supports username lookups.
 *
 * @injectable
 * @public
 */
@injectable()
export class CredentialsAuthProvider extends AuthService {
  /** Cost factor for bcrypt hashing */
  private readonly saltRounds = 10;

  constructor(
    private readonly accountStore: IdentityStore,
    private readonly roleStore: RoleStore,
  ) {
    super();
  }

  /**
   * Authenticates a player using a username and password.
   *
   * @param player - The framework player entity.
   * @param credentials - Object containing `username` and `password` strings.
   * @returns A promise resolving to the authentication result.
   */
  async authenticate(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<AuthResult> {
    const username =
      typeof credentials.username === "string"
        ? credentials.username
        : undefined;
    const password =
      typeof credentials.password === "string"
        ? credentials.password
        : undefined;

    if (!username || !password) {
      return { success: false, error: "Username and password are required" };
    }

    const account = await this.accountStore.findByUsername(username);
    if (!account) {
      return { success: false, error: "Account not found" };
    }

    const passwordHash = account.passwordHash;
    if (!passwordHash) {
      return { success: false, error: "Account has no password set" };
    }

    const isValid = await bcrypt.compare(password, passwordHash);
    if (!isValid) {
      return { success: false, error: "Invalid credentials" };
    }

    if (this.isBanned(account)) {
      return {
        success: false,
        error: account.banReason ?? "Account is banned",
      };
    }

    const accountIdStr = String(account.id);
    player.linkAccount(accountIdStr);
    return { success: true, accountID: accountIdStr, account };
  }

  /**
   * Registers a new account with a username and password.
   *
   * @param player - The framework player entity.
   * @param credentials - Object containing `username` and `password` strings.
   * @returns A promise resolving to the registration result.
   */
  async register(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<AuthResult> {
    const username =
      typeof credentials.username === "string"
        ? credentials.username
        : undefined;
    const password =
      typeof credentials.password === "string"
        ? credentials.password
        : undefined;

    if (!username || !password) {
      return { success: false, error: "Username and password are required" };
    }

    const existing = await this.accountStore.findByUsername(username);
    if (existing) {
      return { success: false, error: "Username already taken" };
    }

    const passwordHash = await bcrypt.hash(password, this.saltRounds);
    const identifiers = player.getPlayerIdentifiers();
    const primaryIdentifier = identifiers.find(i => i.type === 'license')?.value || identifiers[0]?.value || `internal:${username}`;
    const defaultRole = await this.roleStore.getDefaultRole();

    const account = await this.accountStore.create({
      username,
      passwordHash,
      identifier: primaryIdentifier,
      roleId: defaultRole.id,
      customPermissions: [],
      isBanned: false,
    });

    const accountIdStr = String(account.id);
    player.linkAccount(accountIdStr);
    return {
      success: true,
      accountID: accountIdStr,
      account,
      isNewAccount: true,
    };
  }

  /**
   * Validates if the player's current linked account session is still active.
   *
   * @param player - The framework player entity.
   * @returns A promise resolving to the validation result.
   */
  async validateSession(player: Server.Player): Promise<AuthResult> {
    const accountId = player.accountID;
    if (!accountId) return { success: false, error: "Not authenticated" };

    const account = await this.accountStore.findByLinkedId(accountId);
    if (!account || this.isBanned(account)) {
      return { success: false, error: "Session invalid or account banned" };
    }

    return { success: true, accountID: String(account.id), account };
  }

  /**
   * Performs logout logic for the player.
   *
   * @param player - The framework player entity.
   */
  async logout(player: Server.Player): Promise<void> {
    player.unlinkAccount();
  }

  /**
   * Internal helper to determine if an account is currently prohibited.
   *
   * @param account - The account to check.
   * @returns True if the account is banned and the ban hasn't expired.
   * @internal
   */
  private isBanned(account: IdentityAccount): boolean {
    if (!account.isBanned) return false;
    if (account.banExpiresAt && account.banExpiresAt < new Date()) {
      return false;
    }
    return true;
  }
}
