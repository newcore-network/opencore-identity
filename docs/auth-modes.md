# Authentication Modes

The `auth.mode` option defines how players are identified and authenticated when they connect to the server.

Quick summary:

- local: identifies by license/steam/discord, no form.
- credentials: username/password stored on your server.
- api: delegates to an external HTTP service.

## 1. `local` Mode (Default)

What it is: authenticates using player identifiers (license, discord, steam, etc.).
Who it is for: servers that want automatic access without forms.

- **Workflow**:
  1. Player connects.
  2. Provider looks up the primary identifier (e.g., `license:123...`) in the `IdentityStore`.
  3. If not found and `autoCreate` is `true`, a new account is created automatically.
  4. The account is linked to the player.

```ts
Identity.install({
  auth: {
    mode: "local",
    primaryIdentifier: "license",
    autoCreate: true,
  },
  // ...
});
```

## 2. `credentials` Mode

What it is: login and registration with username/password stored on your server.
Who it is for: servers with custom UI or manual registration.

- **Workflow**:
  1. Player must call a registration command/event with `username` and `password`.
  2. Passwords are hashed using `bcrypt`.
  3. On next connection, the player must provide credentials to authenticate.

```ts
Identity.install({
  auth: {
    mode: "credentials",
  },
  // ...
});
```

## 3. `api` Mode

What it is: delegates all auth to an external HTTP service.
Who it is for: large networks with a centralized database or SSO.

- **Workflow**:
  1. The provider sends the player identifiers and any credentials to your API.
  2. Your API returns `{ success, accountId, account?, isNewAccount? }`.
  3. The account is linked to the player.

```ts
Identity.install({
  auth: {
    mode: "api",
    primaryIdentifier: "license",
    api: {
      baseUrl: "https://auth.example.com",
      authPath: "/auth",
      registerPath: "/register",
      sessionPath: "/session",
      logoutPath: "/logout",
    },
  },
  // ...
});
```

### API Payload (Simple)

Request example (authenticate/register/session/logout):

```json
{
  "action": "authenticate",
  "accountId": null,
  "primaryIdentifier": "license:abc123",
  "identifiers": [{ "type": "license", "value": "license:abc123" }],
  "credentials": { "username": "john", "password": "123" }
}
```

Response example:

```json
{
  "success": true,
  "accountId": "42",
  "isNewAccount": false,
  "account": { "id": 42, "identifier": "license:abc123" }
}
```

## 4. Implementation with TypeORM

If you use TypeORM, you must implement the `IdentityStore` contract.

```ts
import { IdentityStore, IdentityAccount } from "@open-core/identity";
import { Repository } from "typeorm";
import { PlayerEntity } from "./entities/player.entity"; // Your TypeORM entity

export class TypeORMIdentityStore extends IdentityStore {
  constructor(private readonly repo: Repository<PlayerEntity>) {
    super();
  }

  async findByIdentifier(identifier: string): Promise<IdentityAccount | null> {
    return await this.repo.findOneBy({ identifier });
  }

  async findByLinkedId(linkedId: string): Promise<IdentityAccount | null> {
    // linkedId is usually the primary key or a stable UUID
    return await this.repo.findOneBy({ id: linkedId });
  }

  async create(data: any): Promise<IdentityAccount> {
    const player = this.repo.create(data);
    return await this.repo.save(player);
  }

  async update(id: any, data: any): Promise<void> {
    await this.repo.update(id, data);
  }

  async setBan(id: any, banned: boolean, reason?: string, expiresAt?: Date): Promise<void> {
    await this.repo.update(id, { 
      isBanned: banned, 
      banReason: reason, 
      banExpiresAt: expiresAt 
    });
  }

  // Implement other abstract methods...
}
```

Then, register it before installing:

```ts
const playerRepo = dataSource.getRepository(PlayerEntity);
Identity.setIdentityStore(new TypeORMIdentityStore(playerRepo) as any);

Identity.install({
  auth: { mode: "local" },
  // ...
});
```

## Usage Example (Controller)

```ts
import { Server } from "@open-core/framework";
import { AuthService, AccountService } from "@open-core/identity";

@Server.Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly accountService: AccountService
  ) {}

  @Server.OnNet("auth:login")
  async login(player: Server.Player, payload: any) {
    const result = await this.auth.authenticate(player, payload);
    
    if (result.success) {
      console.log(`Player ${player.name} authenticated with ID ${result.accountID}`);
    }
    
    return result;
  }

  @Server.OnNet("admin:ban")
  async banPlayer(player: Server.Player, targetId: string, reason: string) {
    // Check if the executing player has permission (requires RoleStore or static roles)
    // This is handled via @Server.Guard(HasPermission('admin.ban')) usually
    await this.accountService.ban(targetId, { reason, durationMs: 3600000 });
  }
}
```
