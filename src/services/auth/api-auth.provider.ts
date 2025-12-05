import { injectable } from "tsyringe";
import { Server } from "@open-core/framework";

import { MemoryCacheService } from "../cache/memory-cache.service";
import type { AccountIdentifiers } from "../../types";
import type { ApiAuthConfig, ApiAuthResponse } from "../../types/auth.types";

/**
 * API-based authentication provider that delegates auth to external API.
 * Does NOT require local database (uses memory cache only).
 *
 * Features:
 * - POSTs credentials + identifiers to external API
 * - Receives linkedId from API (no local generation)
 * - Caches auth results in RAM with configurable TTL
 * - Optionally syncs to local DB if configured
 *
 * Expected API endpoint: POST {apiUrl}/auth
 * Request: { credentials: {...}, identifiers: {license, discord, steam} }
 * Response: { success: boolean, linkedId?: string, error?: string }
 */
@injectable()
export class ApiAuthProvider implements Server.AuthProviderContract {
  private apiConfig: ApiAuthConfig;
  private cacheTtl: number;

  constructor(
    private readonly config: Server.ConfigService,
    private readonly http: Server.HttpService,
    private readonly cache: MemoryCacheService,
  ) {
    // Load API configuration from convars
    this.apiConfig = {
      authUrl: this.config.get(
        "identity_api_auth_url",
        "http://localhost:3000/api/auth",
      ),
      headers: this.parseHeaders(this.config.get("identity_api_headers", "")),
      timeoutMs: this.config.getNumber("identity_api_timeout", 5000),
    };

    this.cacheTtl = this.config.getNumber("identity_cache_ttl", 300000); // 5 min default
  }

  async authenticate(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<Server.AuthResult> {
    const identifiers = this.extractFromPlayer(player);

    try {
      const response = await this.http.post<ApiAuthResponse>(
        this.apiConfig.authUrl,
        {
          credentials,
          identifiers,
        },
        {
          headers: this.apiConfig.headers,
          timeoutMs: this.apiConfig.timeoutMs,
        },
      );

      if (!response.success || !response.linkedId) {
        return {
          success: false,
          error: response.error ?? "Authentication failed",
        };
      }

      // Cache the auth result
      this.cache.set(
        `auth:${response.linkedId}`,
        { linkedId: response.linkedId, identifiers },
        this.cacheTtl,
      );

      // Link account
      player.linkAccount(response.linkedId);

      return {
        success: true,
        accountID: response.linkedId,
        isNewAccount: response.isNewAccount ?? false,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "API authentication failed",
      };
    }
  }

  async register(
    player: Server.Player,
    credentials: Record<string, unknown>,
  ): Promise<Server.AuthResult> {
    // Registration is the same as authentication for API-based auth
    // The external API decides if it's a new account or not
    return this.authenticate(player, credentials);
  }

  async validateSession(player: Server.Player): Promise<Server.AuthResult> {
    const linked = player.accountID;
    if (!linked) {
      return { success: false, error: "Not authenticated" };
    }

    // Check cache first
    const cached = this.cache.get<{
      linkedId: string;
      identifiers: AccountIdentifiers;
    }>(`auth:${linked}`);
    if (cached) {
      return { success: true, accountID: cached.linkedId };
    }

    // If not in cache, we could optionally validate with API
    // For now, we trust the linkedId if it exists
    return { success: true, accountID: String(linked) };
  }

  async logout(player: Server.Player): Promise<void> {
    const linked = player.accountID;
    if (linked) {
      this.cache.delete(`auth:${linked}`);
    }
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

  private parseHeaders(headersString?: string): Record<string, string> {
    if (!headersString) return {};

    try {
      return JSON.parse(headersString);
    } catch {
      return {};
    }
  }
}
