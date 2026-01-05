import { injectable } from "tsyringe";
import { RoleStore } from "../contracts";
import type { IdentityRole } from "../types";

/**
 * High-level service for managing security roles and their associated permissions.
 * 
 * Provides a programmer-friendly API for role administration, including creation,
 * updates, and permission retrieval. This service interacts with the configured
 * {@link RoleStore}.
 * 
 * @public
 * @injectable
 */
@injectable()
export class RoleService {
  constructor(
    public readonly store: RoleStore
  ) {}

  /**
   * Retrieves all roles that grant a specific permission.
   * 
   * @param permission - The permission string to search for.
   * @returns A promise resolving to an array of roles.
   */
  async findByPermission(permission: string): Promise<IdentityRole[]> {
    return this.store.findByPermission(permission);
  }

  /**
   * Retrieves a role by its hierarchical rank.
   * 
   * @param rank - The numeric rank to search for.
   * @returns A promise resolving to the role or null if not found.
   */
  async findByRank(rank: number): Promise<IdentityRole | null> {
    return this.store.findByRank(rank);
  }

  /**
   * Checks if a role is higher or equal than another based on rank.
   * 
   * @param roleId - The role to check.
   * @param requiredRoleId - The required role.
   * @returns True if roleId has equal or higher rank.
   */
  async isHigherOrEqual(roleId: string | number, requiredRoleId: string | number): Promise<boolean> {
    const [role, required] = await Promise.all([
      this.store.findById(roleId),
      this.store.findById(requiredRoleId)
    ]);

    if (!role || !required) return false;
    return role.rank >= required.rank;
  }
}
