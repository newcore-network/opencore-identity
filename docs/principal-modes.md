# Principal Modes (Authorization)

The `principal.mode` option defines how the system resolves a player's roles and permissions.

## 1. `roles` Mode (Static)

The fastest and most common mode. Role definitions are provided directly in the code via `IdentityOptions`.

- **How it works**: When a player connects, the system looks up their `roleId` and matches it against the static roles object.

- **Best for**: Projects where roles are predefined and don't change frequently.

## 2. `db` Mode (Dynamic)

Fetches role definitions from a database using the `RoleStore` contract.

- **How it works**:
  1. You must register a `RoleStore` using `Identity.setRoleStore()`.
  2. The system queries the store every time a principal needs to be resolved (results are cached).
- **Best for**: Servers with dynamic ranks or those that manage permissions via a database UI.

## 3. `api` Mode (External)

Delegates principal resolution to an external HTTP service.

- **How it works**: The provider sends a request to your API with the `linkedId`. Your API returns the full principal data (rank, permissions, metadata).
- **Best for**: Integrated web ecosystems where roles are managed by a central portal.

## 4. Implementation with TypeORM (RoleStore)

To use `db` mode, implement the `RoleStore` contract:

```ts
import { RoleStore, IdentityRole } from "@open-core/identity";
import { Repository } from "typeorm";
import { RoleEntity } from "./entities/role.entity";

export class TypeORMRoleStore extends RoleStore {
  constructor(private readonly repo: Repository<RoleEntity>) {
    super();
  }

  async findById(id: any): Promise<IdentityRole | null> {
    return await this.repo.findOneBy({ id });
  }

  async findByRank(rank: number): Promise<IdentityRole | null> {
    return await this.repo.findOneBy({ rank });
  }

  async getDefaultRole(): Promise<IdentityRole> {
    return await this.repo.findOneBy({ isDefault: true }) || { 
      id: 'user', name: 'user', rank: 0, permissions: [] 
    };
  }
  
  // Implement other methods...
}
```

Register it:

```ts
Identity.setRoleStore(TypeORMRoleStore);
```

## Permission Resolution Logic

The system resolves permissions using the following priority:

1.  **Explicit Revocation**: If `customPermissions` contains `-permission`, access is **denied**, even if the role has it.
2.  **Explicit Grant**: If `customPermissions` contains `+permission` or `permission`, access is **granted**.
3.  **Custom Wildcard**: If `customPermissions` contains `*`, access is **granted**.
4.  **Role Permissions**: If not found in overrides, it checks the role's `permissions` array (supporting `*` as well).

## Configuration Example

```ts
Identity.install({
  principal: {
    mode: "roles",
    roles: {
      admin: { name: "admin", rank: 100, permissions: ["*"], displayName: "Administrator" },
      user: { name: "user", rank: 0, permissions: ["chat.message"], displayName: "Citizen" }
    },
    defaultRole: "user", // Or an object to auto-create it
    cacheTtl: 600000, // 10 minutes cache
  },
  // ...
});
```
