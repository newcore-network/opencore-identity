/**
 * Configuration for API-based authentication
 */
export interface ApiAuthConfig {
  /** Base URL for auth API */
  authUrl: string;
  /** Base URL for principal/permissions API */
  principalUrl?: string;
  /** Custom headers to include in all requests */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
}

/**
 * Response from API authentication endpoint
 */
export interface ApiAuthResponse {
  /** Whether authentication was successful */
  success: boolean;
  /** Linked ID from external system */
  linkedId?: string;
  /** Error message if authentication failed */
  error?: string;
  /** Whether this is a new account */
  isNewAccount?: boolean;
}

/**
 * Response from API principal/permissions endpoint
 */
export interface ApiPrincipalResponse {
  /** Display name of the role/principal */
  name?: string;
  /** Rank/weight for hierarchical checks */
  rank?: number;
  /** Array of permission strings */
  permissions: string[];
  /** Additional metadata */
  meta?: Record<string, unknown>;
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  /** TTL in milliseconds (default: 300000 = 5 min) */
  ttl?: number;
  /** Maximum number of entries to cache */
  maxEntries?: number;
}
