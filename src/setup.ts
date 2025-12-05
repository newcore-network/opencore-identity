import type { DependencyContainer } from "tsyringe";

import { AccountRepository } from "./repositories/account.repository";
import { RoleRepository } from "./repositories/role.repository";
import { AccountService } from "./services/account.service";
import { RoleService } from "./services/role.service";
import { MemoryCacheService } from "./services/cache/memory-cache.service";
import { LocalAuthProvider } from "./services/auth/local-auth.provider";
import { CredentialsAuthProvider } from "./services/auth/credentials-auth.provider";
import { ApiAuthProvider } from "./services/auth/api-auth.provider";
import { LocalPrincipalProvider } from "./services/principal/local-principal.provider";
import { ApiPrincipalProvider } from "./services/principal/api-principal.provider";
import { IdentityAuthProvider } from "./services/identity-auth.provider";
import { IdentityPrincipalProvider } from "./services/identity-principal.provider";

/**
 * Configuration options for Identity module setup
 */
export interface IdentitySetupOptions {
  /**
   * Authentication provider strategy
   * - 'local': Auto-create accounts by FiveM identifiers (default)
   * - 'credentials': Username/password authentication
   * - 'api': External API authentication
   */
  authProvider?: "local" | "credentials" | "api";

  /**
   * Principal provider strategy
   * - 'local': Read roles/permissions from local DB (default)
   * - 'api': Fetch roles/permissions from external API
   */
  principalProvider?: "local" | "api";

  /**
   * Whether to use local database for accounts/roles
   * - true: Use DB (default for 'local' strategies)
   * - false: Skip DB registration (only cache, for 'api' strategies)
   */
  useDatabase?: boolean;
}

/**
 * Register all Identity module singletons with the DI container.
 *
 * This function should be called once during server bootstrap to set up
 * the authentication and authorization providers.
 *
 * @param container - The tsyringe DependencyContainer instance
 * @param options - Configuration options for authentication and principal strategies
 *
 * @example
 * ```ts
 * import { container } from "tsyringe";
 * import { Identity } from "@open-core/identity";
 *
 * // Default setup (local auth + local principals + DB)
 * Identity.setup(container);
 *
 * // API-based setup (no DB required)
 * Identity.setup(container, {
 *   authProvider: 'api',
 *   principalProvider: 'api',
 *   useDatabase: false
 * });
 *
 * // Credentials setup (DB required)
 * Identity.setup(container, {
 *   authProvider: 'credentials',
 *   principalProvider: 'local',
 *   useDatabase: true
 * });
 * ```
 */
export function setupIdentity(
  container: DependencyContainer,
  options: IdentitySetupOptions = {},
): void {
  const {
    authProvider = "local",
    principalProvider = "local",
    useDatabase = authProvider !== "api" && principalProvider !== "api",
  } = options;

  // Always register cache service (needed for API providers)
  container.registerSingleton(MemoryCacheService);

  // Register database-dependent services only if needed
  if (useDatabase) {
    container.registerSingleton(AccountRepository);
    container.registerSingleton(RoleRepository);
    container.registerSingleton(AccountService);
    container.registerSingleton(RoleService);
  }

  // Register Auth Provider based on strategy
  switch (authProvider) {
    case "credentials":
      container.registerSingleton(
        "AuthProviderContract",
        CredentialsAuthProvider,
      );
      // Also register as IdentityAuthProvider for backward compatibility
      // Note: CredentialsAuthProvider is not compatible with IdentityAuthProvider interface
      // Users should use the new provider directly
      break;
    case "api":
      container.registerSingleton("AuthProviderContract", ApiAuthProvider);
      // Note: ApiAuthProvider is not compatible with IdentityAuthProvider interface
      // Users should use the new provider directly
      break;
    case "local":
    default:
      container.registerSingleton("AuthProviderContract", LocalAuthProvider);
      // Register LocalAuthProvider as the legacy IdentityAuthProvider for compatibility
      container.registerSingleton(
        IdentityAuthProvider,
        LocalAuthProvider as never,
      );
      break;
  }

  // Register Principal Provider based on strategy
  switch (principalProvider) {
    case "api":
      container.registerSingleton(
        "PrincipalProviderContract",
        ApiPrincipalProvider,
      );
      // Note: ApiPrincipalProvider is not compatible with IdentityPrincipalProvider interface
      // Users should use the new provider directly
      break;
    case "local":
    default:
      container.registerSingleton(
        "PrincipalProviderContract",
        LocalPrincipalProvider,
      );
      // Register LocalPrincipalProvider as the legacy IdentityPrincipalProvider for compatibility
      container.registerSingleton(
        IdentityPrincipalProvider,
        LocalPrincipalProvider as never,
      );
      break;
  }
}
