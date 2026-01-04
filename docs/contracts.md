# Implementing Contracts (Stores)

To persist player accounts and roles, you must implement the `IdentityStore` and optionally the `RoleStore` contracts.

## IdentityStore

The `IdentityStore` is the most important contract. It handles looking up and saving account data.

### Example: Prisma Implementation

```ts
import { IdentityStore, IdentityAccount } from "@open-core/identity";
import { PrismaClient } from "@prisma/client";

export class PrismaIdentityStore extends IdentityStore {
  constructor(private readonly prisma: PrismaClient) {
    super();
  }

  async findByIdentifier(identifier: string): Promise<IdentityAccount | null> {
    const user = await this.prisma.user.findUnique({ where: { identifier } });
    return user ? this.mapToAccount(user) : null;
  }

  async findByLinkedId(linkedId: string): Promise<IdentityAccount | null> {
    const user = await this.prisma.user.findUnique({ where: { linkedId } });
    return user ? this.mapToAccount(user) : null;
  }

  async create(data: any): Promise<IdentityAccount> {
    const user = await this.prisma.user.create({ data });
    return this.mapToAccount(user);
  }

  // ... Implement update, findByUsername, and setBan ...

  private mapToAccount(dbUser: any): IdentityAccount {
    return {
      id: dbUser.id.toString(),
      linkedId: dbUser.linkedId,
      identifier: dbUser.identifier,
      roleName: dbUser.roleName,
      customPermissions: dbUser.permissions || [],
      isBanned: dbUser.banned,
      // ...
    };
  }
}
```

## Registering your Store

You must register your store **before** calling `Identity.install()`.

```ts
import { Identity } from "@open-core/identity";
import { PrismaIdentityStore } from "./stores/prisma-identity.store";

// Use the helper function to register the singleton
Identity.setIdentityStore(PrismaIdentityStore);

Identity.install({
  // ... configuration
});
```

## RoleStore

Only required if `principal.mode` is set to `db`. It follows the same pattern as `IdentityStore`.

```ts
import { Identity, RoleStore } from "@open-core/identity";

class MyRoleStore extends RoleStore {
    // ... Implement findByName, getDefaultRole, save, delete ...
}

Identity.setRoleStore(MyRoleStore);
```
