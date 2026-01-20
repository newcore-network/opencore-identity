import { injectable, inject } from "tsyringe";
import { Server } from "@open-core/framework/server";
import { IDENTITY_OPTIONS } from "../../tokens";
import type { IdentityOptions } from "../../types";

/**
 * Principal provider that resolves roles and permissions from an external HTTP API.
 * 
 * This provider implements the framework's {@link Server.PrincipalProviderContract} by 
 * performing network requests to a remote service. It includes an in-memory cache 
 * to optimize frequent authorization checks.
 * 
 * @injectable
 * @public
 */
@injectable()
export class ApiPrincipalProvider extends Server.PrincipalProviderContract {
  /** 
   * In-memory cache for resolved principals.
   * Key: clientId (number)
   */
  private readonly cache = new Map<number, { principal: Server.Principal; expiresAt: number }>();
  
  /** Cache TTL in milliseconds */
  private readonly cacheTtl: number;

  /**
   * Initializes a new instance of the ApiPrincipalProvider.
   * 
   * @param options - Identity system configuration options.
   * @param http - Framework HTTP service for remote communication.
   */
  constructor(
    @inject(IDENTITY_OPTIONS) private readonly options: IdentityOptions,
  ) {
    super();
    this.cacheTtl = options.principal.cacheTtl ?? 300000;
  }

  /**
   * Resolves the Principal for a connected player via external API.
   * 
   * @param player - The framework player entity.
   * @returns A promise resolving to the {@link Server.Principal} or null if not authenticated.
   */
  async getPrincipal(player: Server.Player): Promise<Server.Principal | null> {
    const cached = this.cache.get(player.clientID);
    if (cached && cached.expiresAt > Date.now()) return cached.principal;

    const linkedId = player.accountID;
    if (!linkedId) return null;

    const principal = await this.fetchPrincipal({ linkedId, accountId: linkedId });
    if (!principal) return null;

    this.cache.set(player.clientID, {
      principal,
      expiresAt: Date.now() + this.cacheTtl,
    });

    return principal;
  }

  /**
   * Forces a refresh of the cached principal data from the API.
   * 
   * @param player - The player whose principal should be refreshed.
   */
  async refreshPrincipal(player: Server.Player): Promise<void> {
    this.cache.delete(player.clientID);
    await this.getPrincipal(player);
  }

  /**
   * Resolves a principal for offline workflows using a stable account ID via API.
   * 
   * @param linkedID - The linked account identifier.
   * @returns A promise resolving to the principal or null.
   */
  async getPrincipalByLinkedID(linkedID: string): Promise<Server.Principal | null> {
    return this.fetchPrincipal({ linkedId: linkedID, accountId: linkedID });
  }

  private async fetchPrincipal(payload: {
    linkedId: string;
    accountId?: string | null;
  }): Promise<Server.Principal | null> {
    const config = this.options.principal.api;
    if (!config?.baseUrl) {
      console.warn("[OpenCore-Identity] API principal mode enabled but baseUrl is missing.");
      return null;
    }

    try {
      const url = this.resolveUrl(config);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...config.headers,
        },
        body: JSON.stringify(payload),
        signal: this.getAbortSignal(config.timeoutMs),
      });

      if (!response.ok) {
        console.error(`[OpenCore-Identity] Principal API returned error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = (await response.json()) as {
        success?: boolean;
        principal?: Server.Principal;
        id?: string;
        name?: string;
        rank?: number;
        permissions?: string[];
        meta?: Record<string, unknown>;
        error?: string;
      };

      if (data.success === false) {
        console.warn(`[OpenCore-Identity] Principal API rejected request: ${data.error ?? 'Unknown error'}`);
        return null;
      }

      const principal = this.normalizePrincipal(data);
      if (!principal) {
        console.error("[OpenCore-Identity] Principal API returned invalid data structure", data);
      }

      return principal;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(`[OpenCore-Identity] Principal API request timed out after ${config.timeoutMs}ms`);
      } else {
        console.error("[OpenCore-Identity] Failed to fetch principal from API:", err);
      }
      return null;
    }
  }

  private normalizePrincipal(
    data: {
      principal?: Server.Principal;
      id?: string;
      name?: string;
      rank?: number;
      permissions?: string[];
      meta?: Record<string, unknown>;
    }
  ): Server.Principal | null {
    if (data.principal) return data.principal;

    if (!data.id || !Array.isArray(data.permissions)) return null;

    return {
      id: data.id,
      name: data.name ?? String(data.id),
      rank: data.rank ?? 0,
      permissions: data.permissions,
      meta: data.meta,
    };
  }

  private resolveUrl(config: NonNullable<IdentityOptions["principal"]["api"]>): string {
    const base = config.baseUrl.replace(/\/$/, "");
    const path = config.principalPath ?? "/principal";
    return `${base}${path}`;
  }

  private getAbortSignal(timeoutMs?: number): AbortSignal | undefined {
    if (!timeoutMs || timeoutMs <= 0) return undefined;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }
}
