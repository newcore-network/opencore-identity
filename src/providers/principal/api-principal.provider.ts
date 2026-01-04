import { injectable, inject } from "tsyringe";
import { Server } from "@open-core/framework";
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
    private readonly http: Server.HttpService
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

    // Placeholder: Implementation would use this.http.get(...) 
    return null;
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
    return null;
  }
}
