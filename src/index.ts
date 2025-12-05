// Imports for namespace
import * as Setup from "./setup";
import type * as Entities from "./entities/account.entity";
import type * as RoleEntities from "./entities/role.entity";
import * as AccountRepo from "./repositories/account.repository";
import * as RoleRepo from "./repositories/role.repository";
import * as AcctService from "./services/account.service";
import * as RService from "./services/role.service";
import * as CacheService from "./services/cache/memory-cache.service";
import * as LocalAuth from "./services/auth/local-auth.provider";
import * as CredentialsAuth from "./services/auth/credentials-auth.provider";
import * as ApiAuth from "./services/auth/api-auth.provider";
import * as LocalPrincipal from "./services/principal/local-principal.provider";
import * as ApiPrincipal from "./services/principal/api-principal.provider";
import * as AuthProvider from "./services/identity-auth.provider";
import * as PrincipalProvider from "./services/identity-principal.provider";
import type * as Types from "./types";
import type * as AuthTypes from "./types/auth.types";
import type * as Events from "./events/identity.events";

// Namespace for organized exports
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Identity {
  // Setup
  export const setup = Setup.setupIdentity;
  export type SetupOptions = Setup.IdentitySetupOptions;

  // Entities
  export type Account = Entities.Account;
  export type Role = RoleEntities.Role;

  // Repositories
  export import AccountRepository = AccountRepo.AccountRepository;
  export import RoleRepository = RoleRepo.RoleRepository;

  // Services
  export import AccountService = AcctService.AccountService;
  export import RoleService = RService.RoleService;
  export import MemoryCacheService = CacheService.MemoryCacheService;

  // Auth Providers
  export import LocalAuthProvider = LocalAuth.LocalAuthProvider;
  export import CredentialsAuthProvider = CredentialsAuth.CredentialsAuthProvider;
  export import ApiAuthProvider = ApiAuth.ApiAuthProvider;

  // Principal Providers
  export import LocalPrincipalProvider = LocalPrincipal.LocalPrincipalProvider;
  export import ApiPrincipalProvider = ApiPrincipal.ApiPrincipalProvider;

  // Legacy providers (for backward compatibility)
  export import IdentityAuthProvider = AuthProvider.IdentityAuthProvider;
  export import IdentityPrincipalProvider = PrincipalProvider.IdentityPrincipalProvider;

  // Types
  export type IdentifierType = Types.IdentifierType;
  export type AccountIdentifiers = Types.AccountIdentifiers;
  export type CreateAccountInput = Types.CreateAccountInput;
  export type BanOptions = Types.BanOptions;
  export type AuthSession = Types.AuthSession;
  export type CreateRoleInput = Types.CreateRoleInput;
  export type UpdateRoleInput = Types.UpdateRoleInput;

  // API Types
  export type ApiAuthConfig = AuthTypes.ApiAuthConfig;
  export type ApiAuthResponse = AuthTypes.ApiAuthResponse;
  export type ApiPrincipalResponse = AuthTypes.ApiPrincipalResponse;
  export type CacheOptions = AuthTypes.CacheOptions;

  // Events
  export type AccountCreatedEvent = Events.AccountCreatedEvent;
  export type AccountBannedEvent = Events.AccountBannedEvent;
  export type AccountUnbannedEvent = Events.AccountUnbannedEvent;
  export type AccountLoggedInEvent = Events.AccountLoggedInEvent;
  export type IdentityEventMap = Events.IdentityEventMap;
}

// Top-level exports for backward compatibility
export { setupIdentity, type IdentitySetupOptions } from "./setup";

export * from "./entities/account.entity";
export * from "./entities/role.entity";
export * from "./repositories/account.repository";
export * from "./repositories/role.repository";
export * from "./services/account.service";
export * from "./services/role.service";
export * from "./services/cache/memory-cache.service";

// Auth providers
export * from "./services/auth/local-auth.provider";
export * from "./services/auth/credentials-auth.provider";
export * from "./services/auth/api-auth.provider";

// Principal providers
export * from "./services/principal/local-principal.provider";
export * from "./services/principal/api-principal.provider";

// Legacy providers
export * from "./services/identity-auth.provider";
export * from "./services/identity-principal.provider";

export * from "./events/identity.events";
export * from "./types";
export * from "./types/auth.types";
