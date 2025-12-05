export type IdentifierType = "license" | "discord" | "steam";

export interface AccountIdentifiers {
  license?: string | null;
  discord?: string | null;
  steam?: string | null;
}

export interface CreateAccountInput extends AccountIdentifiers {
  linkedId?: string | null;
  externalSource?: string;
  username?: string | null;
  roleId?: number | null;
}

export interface BanOptions {
  /**
   * Ban duration in milliseconds. When omitted, the ban is permanent.
   */
  durationMs?: number;
  reason?: string;
}

export interface AuthSession {
  accountId: string;
  isNew: boolean;
}

export interface CreateRoleInput {
  name: string;
  displayName: string;
  rank: number;
  permissions?: string[];
  isDefault?: boolean;
}

export interface UpdateRoleInput {
  displayName?: string;
  rank?: number;
  permissions?: string[];
  isDefault?: boolean;
}
