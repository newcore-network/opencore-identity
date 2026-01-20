import { Server } from "@open-core/framework/server";
import { IdentityAccount } from "./types";

/**
 * Result structure for authentication operations.
 */
export interface AuthResult {
  /** Indicates if the operation was successful */
  success: boolean;
  /** The unique identifier for the authenticated account */
  accountID?: string;
  /** Error message if the operation failed */
  error?: string;
  /** Indicates if a new account was created during the process */
  isNewAccount?: boolean;
  /** Generic account Data type  */
  account?: IdentityAccount;
}

export abstract class AuthService {
  /**
   * Authenticates a player using the selected strategy.
   *
   * @param player - The framework player entity.
   * @param credentials - Strategy-specific credentials.
   * @returns A promise resolving to the authentication result.
   */
  abstract authenticate(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<AuthResult>;

  /**
   * Registers a new account for the player.
   *
   * @param player - The framework player entity.
   * @param credentials - Strategy-specific registration data.
   * @returns A promise resolving to the registration result.
   */
  abstract register(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<AuthResult>;

  /**
   * Validates if the player's current linked account session is still active.
   *
   * @param player - The framework player entity.
   * @returns A promise resolving to the validation result.
   */
  abstract validateSession(player: Server.Player): Promise<AuthResult>;

  /**
   * Clears authentication state for the player.
   *
   * @param player - The framework player entity.
   */
  abstract logout(player: Server.Player): Promise<void>;
}
