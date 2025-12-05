import { Server } from "@open-core/framework";

import type { Role } from "../entities/role.entity";

interface RoleRow {
  id?: number;
  name: string;
  display_name: string;
  rank: number;
  permissions: string;
  is_default: boolean;
  created_at: Date;
}

/**
 * Repository for the roles table.
 * Manages CRUD operations for roles with custom queries for defaults and names.
 */
export class RoleRepository extends Server.Repository<Role> {
  protected tableName = "roles";

  constructor(protected readonly db: Server.DatabaseContract) {
    super(db);
  }

  /**
   * Find a role by its internal name.
   *
   * @param name - Role name (e.g., 'admin', 'user')
   * @returns The role or null if not found
   */
  async findByName(name: string): Promise<Role | null> {
    const row = await this.db.single<RoleRow>(
      `SELECT * FROM ${this.tableName} WHERE name = ?`,
      [name],
    );
    return row ? this.toEntity(row) : null;
  }

  /**
   * Get the default role for new accounts.
   *
   * @returns The default role or null if none is set
   */
  async getDefaultRole(): Promise<Role | null> {
    const row = await this.db.single<RoleRow>(
      `SELECT * FROM ${this.tableName} WHERE is_default = TRUE LIMIT 1`,
    );
    return row ? this.toEntity(row) : null;
  }

  /**
   * Update role permissions.
   *
   * @param roleId - Role ID
   * @param permissions - New permissions array
   */
  async updatePermissions(
    roleId: number,
    permissions: string[],
  ): Promise<void> {
    await this.db.execute(
      `UPDATE ${this.tableName} SET permissions = ? WHERE id = ?`,
      [JSON.stringify(permissions), roleId],
    );
  }

  /**
   * Set or unset a role as default.
   *
   * @param roleId - Role ID
   * @param isDefault - Whether this should be the default role
   */
  async setDefault(roleId: number, isDefault: boolean): Promise<void> {
    if (isDefault) {
      // Unset all other defaults first
      await this.db.execute(
        `UPDATE ${this.tableName} SET is_default = FALSE WHERE id != ?`,
        [roleId],
      );
    }
    await this.db.execute(
      `UPDATE ${this.tableName} SET is_default = ? WHERE id = ?`,
      [isDefault, roleId],
    );
  }

  protected toEntity(row: RoleRow): Role {
    return {
      id: row.id!,
      name: row.name,
      displayName: row.display_name,
      rank: row.rank,
      permissions: JSON.parse(row.permissions),
      isDefault: row.is_default,
      createdAt: new Date(row.created_at),
    };
  }

  protected toRow(entity: Role): Record<string, unknown> {
    return {
      id: entity.id,
      name: entity.name,
      display_name: entity.displayName,
      rank: entity.rank,
      permissions: JSON.stringify(entity.permissions ?? []),
      is_default: entity.isDefault,
      created_at: entity.createdAt,
    };
  }
}
