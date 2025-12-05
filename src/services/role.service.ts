import { injectable } from "tsyringe";

import type { Role } from "../entities/role.entity";
import type { CreateRoleInput, UpdateRoleInput } from "../types";
import { RoleRepository } from "../repositories/role.repository";

/**
 * Service for managing roles and their permissions.
 * Handles CRUD operations and permission management for roles.
 */
@injectable()
export class RoleService {
  constructor(private readonly repo: RoleRepository) {}

  /**
   * Find a role by its ID.
   *
   * @param id - Role ID
   * @returns The role or null if not found
   */
  async findById(id: number): Promise<Role | null> {
    return this.repo.findById(id);
  }

  /**
   * Find a role by its internal name.
   *
   * @param name - Role name (e.g., 'admin', 'user')
   * @returns The role or null if not found
   */
  async findByName(name: string): Promise<Role | null> {
    return this.repo.findByName(name);
  }

  /**
   * Get all roles.
   *
   * @returns Array of all roles
   */
  async getAll(): Promise<Role[]> {
    const result = await this.repo.findMany();
    return result.data;
  }

  /**
   * Get the default role for new accounts.
   *
   * @returns The default role or null if none is configured
   */
  async getDefaultRole(): Promise<Role | null> {
    return this.repo.getDefaultRole();
  }

  /**
   * Create a new role.
   *
   * @param input - Role creation data
   * @returns The created role
   */
  async create(input: CreateRoleInput): Promise<Role> {
    const now = new Date();
    const role: Role = {
      id: 0, // Will be set by DB
      name: input.name,
      displayName: input.displayName,
      rank: input.rank,
      permissions: input.permissions ?? [],
      isDefault: input.isDefault ?? false,
      createdAt: now,
    };

    return this.repo.save(role);
  }

  /**
   * Update an existing role.
   *
   * @param id - Role ID
   * @param input - Update data
   * @returns The updated role or null if not found
   */
  async update(id: number, input: UpdateRoleInput): Promise<Role | null> {
    const existing = await this.repo.findById(id);
    if (!existing) return null;

    const updated: Role = {
      ...existing,
      ...(input.displayName !== undefined && {
        displayName: input.displayName,
      }),
      ...(input.rank !== undefined && { rank: input.rank }),
      ...(input.permissions !== undefined && {
        permissions: input.permissions,
      }),
    };

    if (input.isDefault !== undefined) {
      await this.repo.setDefault(id, input.isDefault);
      updated.isDefault = input.isDefault;
    }

    return this.repo.save(updated);
  }

  /**
   * Delete a role.
   *
   * @param id - Role ID
   * @returns true if deleted, false if not found
   */
  async delete(id: number): Promise<boolean> {
    return this.repo.delete(id);
  }

  /**
   * Add a permission to a role.
   *
   * @param roleId - Role ID
   * @param permission - Permission string to add
   */
  async addPermission(roleId: number, permission: string): Promise<void> {
    const role = await this.repo.findById(roleId);
    if (!role) return;

    const permissions = new Set<string>(role.permissions);
    permissions.add(permission);
    await this.repo.updatePermissions(roleId, Array.from(permissions));
  }

  /**
   * Remove a permission from a role.
   *
   * @param roleId - Role ID
   * @param permission - Permission string to remove
   */
  async removePermission(roleId: number, permission: string): Promise<void> {
    const role = await this.repo.findById(roleId);
    if (!role) return;

    const filtered = role.permissions.filter((p: string) => p !== permission);
    await this.repo.updatePermissions(roleId, filtered);
  }
}
