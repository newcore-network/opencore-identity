import { injectable, inject } from "tsyringe";
import { Server } from "@open-core/framework";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { IDENTITY_OPTIONS } from "../../tokens";
import { IdentityStore } from "../../contracts";
import type { IdentityOptions, IdentityAccount } from "../../types";

/**
 * Authentication provider for username and password credentials.
 * 
 * This provider implements the framework's {@link Server.AuthProviderContract} using 
 * bcrypt for password hashing and validation. It requires an implementation 
 * of {@link IdentityStore} that supports username-based lookups.
 * 
 * @injectable
 * @public
 */
@injectable()
export class CredentialsAuthProvider extends Server.AuthProviderContract {
  /** Cost factor for bcrypt hashing */
  private readonly saltRounds = 10;

  /**
   * Initializes a new instance of the CredentialsAuthProvider.
   * 
   * @param options - Identity system configuration options.
   * @param store - Persistence layer for account and credential data.
   */
  constructor(
    @inject(IDENTITY_OPTIONS) private readonly options: IdentityOptions,
    private readonly store: IdentityStore
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
    credentials: Record<string, unknown>
  ): Promise<Server.AuthResult> {
    const username = credentials.username as string | undefined;
    const password = credentials.password as string | undefined;

    if (!username || !password) {
      return { success: false, error: "Username and password are required" };
    }

    const account = await this.store.findByUsername(username);
    if (!account) {
      return { success: false, error: "Invalid credentials" };
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
      return { success: false, error: account.banReason ?? "Account is banned" };
    }

    player.linkAccount(account.linkedId);
    return { success: true, accountID: account.linkedId };
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
    credentials: Record<string, unknown>
  ): Promise<Server.AuthResult> {
    const username = credentials.username as string | undefined;
    const password = credentials.password as string | undefined;

    if (!username || !password) {
      return { success: false, error: "Username and password are required" };
    }

    const existing = await this.store.findByUsername(username);
    if (existing) {
      return { success: false, error: "Username already taken" };
    }

    const passwordHash = await bcrypt.hash(password, this.saltRounds);
    
    const identifiers = player.getIdentifiers();
    const primaryIdentifier = identifiers[0] || `internal:${username}`;

    const account = await this.store.create({
      username,
      passwordHash,
      identifier: primaryIdentifier,
      linkedId: uuidv4(),
      roleName: this.options.principal.defaultRole || "user",
    });

    player.linkAccount(account.linkedId);
    return { success: true, accountID: account.linkedId, isNewAccount: true };
  }

  /**
   * Validates if the player's current linked account session is still active.
   * 
   * @param player - The framework player entity.
   * @returns A promise resolving to the validation result.
   */
  async validateSession(player: Server.Player): Promise<Server.AuthResult> {
    const accountId = player.accountID;
    if (!accountId) return { success: false, error: "Not authenticated" };

    const account = await this.store.findByLinkedId(accountId);
    if (!account || this.isBanned(account)) {
      return { success: false, error: "Session invalid or account banned" };
    }

    return { success: true, accountID: account.linkedId };
  }

  /**
   * Performs logout logic for the player.
   * 
   * @param player - The framework player entity.
   */
  async logout(player: Server.Player): Promise<void> {
    // Session state is managed by the framework.
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
