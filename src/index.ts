import { Server } from "@open-core/framework";
import { IDENTITY_OPTIONS } from "./tokens";
import { LocalAuthProvider as LocalAuthImpl } from "./providers/auth/local-auth.provider";
import { CredentialsAuthProvider as CredentialsAuthImpl } from "./providers/auth/credentials-auth.provider";
import { ApiAuthProvider as ApiAuthImpl } from "./providers/auth/api-auth.provider";
import { IdentityPrincipalProvider as PrincipalProviderImpl } from "./providers/principal/local-principal.provider";
import { ApiPrincipalProvider as ApiPrincipalImpl } from "./providers/principal/api-principal.provider";
import { AccountService as AccountServiceImpl } from "./services/account.service";
import { RoleService as RoleServiceImpl } from "./services/role.service";
import { IdentityStore as IdentityStoreContract, RoleStore as RoleStoreContract } from "./contracts";
import type {
  IdentityOptions as OptionsType,
  IdentityRole as RoleType,
  IdentityAccount as AccountType,
  AuthMode as AuthModeType,
  PrincipalMode as PrincipalModeType,
} from "./types";

/**
 * OpenCore Identity Namespace
 *
 * Provides a centralized identity, authentication, and authorization system
 * designed to integrate seamlessly with the OpenCore Framework SPI.
 *
 * @public
 */
export namespace Identity {
  /**
   * Registers a custom identity store implementation.
   * Must be called before `Identity.install()`.
   * 
   * @param store - The class implementation of the IdentityStore contract.
   */
  export function setIdentityStore(store: { new (...args: any[]): IdentityStoreContract }): void {
    const container = (globalThis as any).oc_container;
    if (!container) throwContainerError();
    container.registerSingleton(IdentityStoreContract, store);
  }

  /**
   * Registers a custom role store implementation.
   * Required for 'db' principal mode. Must be called before `Identity.install()`.
   * 
   * @param store - The class implementation of the RoleStore contract.
   */
  export function setRoleStore(store: { new (...args: any[]): RoleStoreContract }): void {
    const container = (globalThis as any).oc_container;
    if (!container) throwContainerError();
    container.registerSingleton(RoleStoreContract, store);
  }

  function throwContainerError(): never {
    throw new Error(
      "[OpenCore-Identity] Global container (globalThis.oc_container) not found. " +
        "Ensure the framework is initialized before installing plugins.",
    );
  }

  /**
   * Installs the Identity plugin into the OpenCore Framework.
   *
   * This function registers the necessary Authentication and Principal providers
   * into the framework's SPI via `Server.setAuthProvider` and `Server.setPrincipalProvider`.
   *
   * @param options - Configuration options for the identity system.
   *
   * @example
   * ```ts
   * Identity.install({
   *   auth: { mode: 'local', autoCreate: true },
   *   principal: {
   *     mode: 'roles',
   *     roles: {
   *       admin: { name: 'admin', rank: 100, permissions: ['*'] },
   *       user: { name: 'user', rank: 0, permissions: ['chat.use'] }
   *     }
   *   }
   * });
   * ```
   */
  export function install(options: OptionsType): void {
    const container = (globalThis as any).oc_container;

    if (!container) {
      throwContainerError();
    }

    // Register options (interface requires manual token)
    container.registerInstance(IDENTITY_OPTIONS, options);

    // Register Internal Services (concrete classes as tokens)
    container.registerSingleton(AccountServiceImpl);
    container.registerSingleton(RoleServiceImpl);

    // Configure Auth SPI based on mode
    if (options.auth.mode === "api") {
      Server.setAuthProvider(ApiAuthImpl);
    } else if (options.auth.mode === "credentials") {
      Server.setAuthProvider(CredentialsAuthImpl);
    } else {
      Server.setAuthProvider(LocalAuthImpl);
    }

    // Configure Principal SPI based on mode
    if (options.principal.mode === "api") {
      Server.setPrincipalProvider(ApiPrincipalImpl);
    } else {
      Server.setPrincipalProvider(PrincipalProviderImpl);
    }
  }

  // Export Types
  export type IdentityOptions = OptionsType;
  export type IdentityRole = RoleType;
  export type IdentityAccount = AccountType;
  export type AuthMode = AuthModeType;
  export type PrincipalMode = PrincipalModeType;

  // Contracts
  /** Identity account persistence contract */
  export type IdentityStore = IdentityStoreContract;
  /** Role definition persistence contract */
  export type RoleStore = RoleStoreContract;

  // Services
  /** Service for managing identity accounts */
  export type AccountService = AccountServiceImpl;
  /** Service for managing security roles */
  export type RoleService = RoleServiceImpl;

  // Providers
  /** Local (identifier-based) authentication provider */
  export type LocalAuthProvider = LocalAuthImpl;
  /** Credentials (username/password) authentication provider */
  export type CredentialsAuthProvider = CredentialsAuthImpl;
  /** API-based authentication provider */
  export type ApiAuthProvider = ApiAuthImpl;
  /** Framework-integrated authorization provider */
  export type IdentityPrincipalProvider = PrincipalProviderImpl;
  /** API-based authorization provider */
  export type ApiPrincipalProvider = ApiPrincipalImpl;
}

// Re-export high-level API
export { AccountServiceImpl as AccountService };
export { RoleServiceImpl as RoleService };
export { IdentityStoreContract as IdentityStore, RoleStoreContract as RoleStore };

// Export types and tokens for consumers
export * from "./types";
export * from "./tokens";

// Default export
export default Identity;
