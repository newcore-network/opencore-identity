import { injectable, inject } from "tsyringe";
import { IDENTITY_OPTIONS } from "../tokens";
import { RoleStore } from "../contracts";
import type { IdentityOptions, IdentityRole } from "../types";

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
  /**
   * Initializes a new instance of the RoleService.
   * 
   * @param store - Persistence layer for role definitions.
   * @param options - Identity system configuration options.
   */
  constructor(
    private readonly store: RoleStore,
    @inject(IDENTITY_OPTIONS) private readonly options: IdentityOptions
  ) {}

  /**
   * Persists a new security role definition.
   * 
   * @param role - The complete role definition to create.
   * @returns A promise that resolves when the role is saved.
   */
  async create(role: IdentityRole): Promise<void> {
    await this.store.save(role);
  }

  /**
   * Updates an existing role's rank or permissions.
   * 
   * @param name - The unique technical name of the role to update.
   * @param data - Partial object containing the fields to modify.
   * @returns A promise that resolves when the update is complete.
   */
  async update(name: string, data: Partial<Omit<IdentityRole, "name">>): Promise<void> {
    const existing = await this.store.findByName(name);
    if (!existing) return;

    await this.store.save({
      ...existing,
      ...data,
    });
  }

  /**
   * Permanently removes a role definition from the system.
   * 
   * @param name - The technical name of the role to delete.
   * @returns A promise that resolves when the role is deleted.
   */
  async delete(name: string): Promise<void> {
    await this.store.delete(name);
  }

  /**
   * Retrieves the full list of permissions granted to a specific role.
   * 
   * @param name - The technical name of the role.
   * @returns A promise resolving to an array of permission strings.
   */
  async getPermissions(name: string): Promise<string[]> {
    const role = await this.store.findByName(name);
    return role?.permissions || [];
  }
}
