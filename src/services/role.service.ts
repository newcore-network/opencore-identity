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
    private readonly store: RoleStore
  ) {}

  /**
   * Persists a new security role definition.
   * 
   * @param role - The initial role properties (ID is optional).
   * @returns A promise resolving to the created role.
   */
  async create(role: Omit<IdentityRole, "id"> & { id?: string | number }): Promise<IdentityRole> {
    return this.store.create(role);
  }

  /**
   * Updates an existing role's rank or permissions.
   * 
   * @param id - The unique technical identifier of the role to update.
   * @param data - Partial object containing the fields to modify.
   * @returns A promise that resolves when the update is complete.
   */
  async update(id: string | number, data: Partial<Omit<IdentityRole, "id">>): Promise<void> {
    await this.store.update(id, data);
  }

  /**
   * Permanently removes a role definition from the system.
   * 
   * @param id - The technical identifier of the role to delete.
   * @returns A promise that resolves when the role is deleted.
   */
  async delete(id: string | number): Promise<void> {
    await this.store.delete(id);
  }

  /**
   * Retrieves the full list of permissions granted to a specific role.
   * 
   * @param id - The technical identifier of the role.
   * @returns A promise resolving to an array of permission strings.
   */
  async getPermissions(id: string | number): Promise<string[]> {
    const role = await this.store.findById(id);
    return role?.permissions || [];
  }
}
