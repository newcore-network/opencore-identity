import { injectable } from "tsyringe";
import { Server, Utils } from "@open-core/framework";

import { MemoryCacheService } from "../cache/memory-cache.service";
import type {
  ApiAuthConfig,
  ApiPrincipalResponse,
} from "../../types/auth.types";

/**
 * API-based principal provider that fetches permissions from external API.
 * Does NOT require local database (uses memory cache only).
 *
 * Features:
 * - GETs principal data from external API by linkedId
 * - Caches results in RAM with configurable TTL
 * - Falls back to empty permissions if API fails
 * - Optionally syncs to local DB if configured
 *
 * Expected API endpoint: GET {principalUrl}/principals/{linkedId}
 * Response: { name?: string, rank?: number, permissions: string[], meta?: {...} }
 */
@injectable()
export class ApiPrincipalProvider implements Server.PrincipalProviderContract {
  private apiConfig: ApiAuthConfig;
  private cacheTtl: number;

  constructor(
    private readonly config: Server.ConfigService,
    private readonly http: Server.HttpService,
    private readonly cache: MemoryCacheService,
  ) {
    // Load API configuration from convars
    const principalUrl =
      this.config.get("identity_api_principal_url", "") ||
      this.config.get("identity_api_auth_url", "") ||
      "http://localhost:3000/api";

    this.apiConfig = {
      authUrl: principalUrl,
      principalUrl: principalUrl,
      headers: this.parseHeaders(this.config.get("identity_api_headers", "")),
      timeoutMs: this.config.getNumber("identity_api_timeout", 5000),
    };

    this.cacheTtl = this.config.getNumber("identity_cache_ttl", 300000); // 5 min default
  }

  async getPrincipal(player: Server.Player): Promise<Server.Principal | null> {
    const linked = player.accountID;
    if (!linked) {
      throw new Utils.AppError(
        "UNAUTHORIZED",
        "Player is not authenticated (no linked account)",
        "server",
      );
    }

    // Check cache first
    const cacheKey = `principal:${linked}`;
    const cached = this.cache.get<Server.Principal>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from API
    try {
      const url = `${this.apiConfig.principalUrl}/principals/${linked}`;
      const response = await this.http.get<ApiPrincipalResponse>(url, {
        headers: this.apiConfig.headers,
        timeoutMs: this.apiConfig.timeoutMs,
      });

      const principal: Server.Principal = {
        id: String(linked),
        name: response.name,
        rank: response.rank,
        permissions: response.permissions ?? [],
        meta: response.meta ?? {},
      };

      // Cache the result
      this.cache.set(cacheKey, principal, this.cacheTtl);

      return principal;
    } catch (error) {
      // If API fails, return empty principal or throw based on config
      const allowFallback = this.config.getBoolean(
        "identity_api_allow_fallback",
        false,
      );

      if (allowFallback) {
        return {
          id: String(linked),
          permissions: [],
          meta: {},
        };
      }

      throw new Utils.AppError(
        "UNAUTHORIZED",
        `Failed to fetch principal from API: ${error instanceof Error ? error.message : "Unknown error"}`,
        "server",
      );
    }
  }

  async refreshPrincipal(player: Server.Player): Promise<void> {
    const linked = player.accountID;
    if (linked) {
      // Clear cache to force refresh
      this.cache.delete(`principal:${linked}`);
    }

    const principal = await this.getPrincipal(player);
    player.setMeta("identity:principal", principal);
  }

  async getPrincipalByLinkedID(
    linkedID: string,
  ): Promise<Server.Principal | null> {
    // Check cache first
    const cacheKey = `principal:${linkedID}`;
    const cached = this.cache.get<Server.Principal>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from API
    try {
      const url = `${this.apiConfig.principalUrl}/principals/${linkedID}`;
      const response = await this.http.get<ApiPrincipalResponse>(url, {
        headers: this.apiConfig.headers,
        timeoutMs: this.apiConfig.timeoutMs,
      });

      const principal: Server.Principal = {
        id: linkedID,
        name: response.name,
        rank: response.rank,
        permissions: response.permissions ?? [],
        meta: response.meta ?? {},
      };

      // Cache the result
      this.cache.set(cacheKey, principal, this.cacheTtl);

      return principal;
    } catch {
      return null;
    }
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
