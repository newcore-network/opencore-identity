import { Server } from "@open-core/framework";

import type { Account } from "../entities/account.entity";
import type { Role } from "../entities/role.entity";
import type { CreateAccountInput, IdentifierType } from "../types";

interface AccountRow {
  id?: number;
  linked_id: string | null;
  external_source: string | null;
  license: string | null;
  discord: string | null;
  steam: string | null;
  username: string | null;
  role_id: number | null;
  custom_permissions: string;
  created_at: Date;
  last_login_at: Date;
  banned: boolean;
  ban_reason: string | null;
  ban_expires: Date | null;
}

interface AccountWithRoleRow extends AccountRow {
  role_name?: string;
  role_display_name?: string;
  role_rank?: number;
  role_permissions?: string;
  role_is_default?: boolean;
  role_created_at?: Date;
}

/**
 * Repository for the accounts table.
 */
export class AccountRepository extends Server.Repository<Account> {
  protected tableName = "accounts";

  constructor(protected readonly db: Server.DatabaseContract) {
    super(db);
  }

  async findByLinkedId(linkedId: string): Promise<Account | null> {
    const row = await this.db.single<AccountRow>(
      `SELECT * FROM ${this.tableName} WHERE linked_id = ?`,
      [linkedId],
    );
    return row ? this.toEntity(row) : null;
  }

  async findByIdentifier(
    type: IdentifierType,
    value: string,
  ): Promise<Account | null> {
    const column = this.identifierColumn(type);
    const row = await this.db.single<AccountRow>(
      `SELECT * FROM ${this.tableName} WHERE ${column} = ?`,
      [value],
    );
    return row ? this.toEntity(row) : null;
  }

  async createAccount(input: CreateAccountInput): Promise<Account> {
    const now = new Date();
    const row: AccountRow = {
      linked_id: input.linkedId ?? null,
      external_source: input.externalSource ?? null,
      license: input.license ?? null,
      discord: input.discord ?? null,
      steam: input.steam ?? null,
      username: input.username ?? null,
      role_id: input.roleId ?? null,
      custom_permissions: JSON.stringify([]),
      created_at: now,
      last_login_at: now,
      banned: false,
      ban_reason: null,
      ban_expires: null,
    };

    const insertId = await this.insertRow(row);
    return this.toEntity({ ...row, id: insertId });
  }

  async updateLastLogin(accountId: number, date: Date): Promise<void> {
    await this.db.execute(
      `UPDATE ${this.tableName} SET last_login_at = ? WHERE id = ?`,
      [date, accountId],
    );
  }

  async setBan(
    accountId: number,
    banned: boolean,
    reason: string | null,
    expires: Date | null,
  ): Promise<void> {
    await this.db.execute(
      `UPDATE ${this.tableName} SET banned = ?, ban_reason = ?, ban_expires = ? WHERE id = ?`,
      [banned, reason, expires, accountId],
    );
  }

  async updateCustomPermissions(
    accountId: number,
    permissions: string[],
  ): Promise<void> {
    await this.db.execute(
      `UPDATE ${this.tableName} SET custom_permissions = ? WHERE id = ?`,
      [JSON.stringify(permissions), accountId],
    );
  }

  async updateRole(accountId: number, roleId: number | null): Promise<void> {
    await this.db.execute(
      `UPDATE ${this.tableName} SET role_id = ? WHERE id = ?`,
      [roleId, accountId],
    );
  }

  /**
   * Find account by ID with role data joined.
   *
   * @param id - Account ID
   * @returns Account with role or null if not found
   */
  async findByIdWithRole(
    id: number,
  ): Promise<{ account: Account; role: Role | null } | null> {
    const row = await this.db.single<AccountWithRoleRow>(
      `SELECT 
        a.*, 
        r.id as role_id,
        r.name as role_name,
        r.display_name as role_display_name,
        r.rank as role_rank,
        r.permissions as role_permissions,
        r.is_default as role_is_default,
        r.created_at as role_created_at
      FROM ${this.tableName} a
      LEFT JOIN roles r ON a.role_id = r.id
      WHERE a.id = ?`,
      [id],
    );

    if (!row) return null;

    const account = this.toEntity(row);
    const role = row.role_name
      ? {
          id: row.role_id!,
          name: row.role_name,
          displayName: row.role_display_name!,
          rank: row.role_rank!,
          permissions: JSON.parse(row.role_permissions!),
          isDefault: Boolean(row.role_is_default),
          createdAt: new Date(row.role_created_at!),
        }
      : null;

    return { account, role };
  }

  /**
   * Find account by linkedId with role data joined.
   *
   * @param linkedId - Account linkedId
   * @returns Account with role or null if not found
   */
  async findByLinkedIdWithRole(
    linkedId: string,
  ): Promise<{ account: Account; role: Role | null } | null> {
    const row = await this.db.single<AccountWithRoleRow>(
      `SELECT 
        a.*, 
        r.id as role_id,
        r.name as role_name,
        r.display_name as role_display_name,
        r.rank as role_rank,
        r.permissions as role_permissions,
        r.is_default as role_is_default,
        r.created_at as role_created_at
      FROM ${this.tableName} a
      LEFT JOIN roles r ON a.role_id = r.id
      WHERE a.linked_id = ?`,
      [linkedId],
    );

    if (!row) return null;

    const account = this.toEntity(row);
    const role = row.role_name
      ? {
          id: row.role_id!,
          name: row.role_name,
          displayName: row.role_display_name!,
          rank: row.role_rank!,
          permissions: JSON.parse(row.role_permissions!),
          isDefault: Boolean(row.role_is_default),
          createdAt: new Date(row.role_created_at!),
        }
      : null;

    return { account, role };
  }

  protected toEntity(row: AccountRow): Account {
    return {
      id: row.id ?? 0,
      linkedId: row.linked_id,
      externalSource: row.external_source ?? undefined,
      license: row.license,
      discord: row.discord,
      steam: row.steam,
      username: row.username,
      roleId: row.role_id,
      customPermissions: this.parsePermissions(row.custom_permissions),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : new Date(),
      banned: Boolean(row.banned),
      banReason: row.ban_reason,
      banExpires: row.ban_expires ? new Date(row.ban_expires) : null,
    };
  }

  protected toRow(entity: Account): Record<string, unknown> {
    return {
      id: entity.id,
      linked_id: entity.linkedId,
      external_source: entity.externalSource ?? null,
      license: entity.license ?? null,
      discord: entity.discord ?? null,
      steam: entity.steam ?? null,
      username: entity.username ?? null,
      role_id: entity.roleId,
      custom_permissions: JSON.stringify(entity.customPermissions ?? []),
      created_at: entity.createdAt,
      last_login_at: entity.lastLoginAt,
      banned: entity.banned,
      ban_reason: entity.banReason ?? null,
      ban_expires: entity.banExpires,
    };
  }

  private identifierColumn(type: IdentifierType): keyof AccountRow {
    switch (type) {
      case "discord":
        return "discord";
      case "steam":
        return "steam";
      case "license":
      default:
        return "license";
    }
  }

  private parsePermissions(
    raw: string | string[] | null | undefined,
  ): string[] {
    if (Array.isArray(raw)) return raw;
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}
