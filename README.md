# @open-core/identity

Flexible identity and permission system for OpenCore. Provides multiple authentication strategies, role management, and permission-based authorization through the framework's Principal system.

## What It Solves

- **Flexible Authentication**: Choose between local (auto-create), credentials (username/password), or external API authentication
- **Account Management**: Create and lookup accounts via multiple identifiers (license/discord/steam)
- **Role-Based Permissions**: Assign roles with hierarchical ranks and base permissions
- **Custom Permissions**: Per-account permission overrides (additions or negations)
- **Authorization**: Expose `Principal` with combined permissions for `@Guard` decorators
- **Bans**: Temporary or permanent account bans with expiration tracking
- **Flexible Storage**: Use local database OR external API with RAM caching

## Installation

```bash
pnpm add @open-core/identity
```

## Authentication Strategies

### 1. Local Authentication (Default)

Auto-creates accounts based on FiveM identifiers. Best for traditional FiveM servers.

**Features:**
- Auto-creates accounts on first connection
- Uses FiveM identifiers (license/discord/steam)
- Stores everything in local database
- Generates UUID-based linkedId

**Setup:**

```ts
import { container } from "tsyringe";
import { Identity } from "@open-core/identity";

Identity.setup(container, {
  authProvider: "local",
  principalProvider: "local",
  useDatabase: true, // default
});
```

### 2. Credentials Authentication

Username/password authentication against local database.

**Features:**
- Validates username + password (bcrypt)
- Requires explicit registration (no auto-create)
- Stores accounts in local database
- Requires `password_hash` column (migration 005)

**Setup:**

```ts
Identity.setup(container, {
  authProvider: "credentials",
  principalProvider: "local",
  useDatabase: true,
});
```

**Note:** Requires implementing `findByUsername` in AccountRepository for production use.

### 3. API Authentication

Delegates authentication to external API. No local database required.

**Features:**
- POSTs credentials to external API
- Receives linkedId from API
- Caches auth results in RAM (configurable TTL)
- Optional: sync to local DB for offline fallback

**Setup:**

```ts
Identity.setup(container, {
  authProvider: "api",
  principalProvider: "api",
  useDatabase: false, // no DB needed
});
```

**Convars:**

```
set identity_api_auth_url "https://your-api.com/auth"
set identity_api_principal_url "https://your-api.com/principals"
set identity_api_headers '{"Authorization": "Bearer YOUR_TOKEN"}'
set identity_api_timeout 5000
set identity_cache_ttl 300000
```

## API Contracts

### POST /auth

**Request:**

```json
{
  "credentials": {
    "username": "player123",
    "password": "secret"
  },
  "identifiers": {
    "license": "license:abc123",
    "discord": "123456789",
    "steam": "steam:110000123456789"
  }
}
```

**Response:**

```json
{
  "success": true,
  "linkedId": "user_abc123",
  "isNewAccount": false
}
```

### GET /principals/:linkedId

**Response:**

```json
{
  "name": "Administrator",
  "rank": 100,
  "permissions": ["admin.*", "player.kick", "player.ban"],
  "meta": {
    "roleId": 1,
    "roleName": "admin"
  }
}
```

## Data Model

### Entities

- **Account**: User identity with identifiers, role assignment, custom permissions, and ban status
- **Role**: Named role (e.g., "admin", "moderator") with display name, rank weight, and base permissions

### linkedId vs UUID

The `linkedId` field replaces the old `uuid` field:

- **Local accounts**: Auto-generated UUID (e.g., `"550e8400-e29b-41d4-a716-446655440000"`)
- **API accounts**: ID from external system (e.g., `"user_123"`, `"discord:456789"`)
- **Nullable**: Can be `null` if not needed
- **Used in**: `player.accountID`, `Principal.id`

### Relationships

- An Account has **one** Role (FK `role_id`, nullable)
- Role provides **base permissions** and **rank**
- Account can have **custom permissions** (additions with `+perm` or negations with `-perm`)
- **Effective permissions** = Role permissions + Custom permissions (with negations applied)

## Migrations

Run SQL migrations in order:

1. `migrations/001_accounts_table.sql` - Create accounts table
2. `migrations/002_roles_table.sql` - Create roles table and insert default "user" role
3. `migrations/003_alter_accounts_add_role.sql` - Add `role_id` and `custom_permissions` to accounts
4. `migrations/004_rename_uuid_to_linked_id.sql` - Rename `uuid` to `linked_id`, add `external_source`
5. `migrations/005_add_password_hash.sql` - Add `password_hash` (optional, only for credentials auth)

**Important**: Execute migrations in order. Migrations 4 and 5 are for upgrading existing installations.

## Convars

### General

- `identity_primary_identifier` (default: `"license"`): Priority identifier for account lookup/creation
- `identity_auto_create` (default: `true`): Auto-create account on authentication if not found (local auth only)
- `identity_default_role` (default: `"user"`): Name of the default role assigned to new accounts

### API Authentication

- `identity_api_auth_url`: URL for authentication API endpoint
- `identity_api_principal_url`: URL for principal/permissions API endpoint
- `identity_api_headers`: JSON string of custom headers (e.g., `'{"Authorization": "Bearer TOKEN"}'`)
- `identity_api_timeout` (default: `5000`): Request timeout in milliseconds
- `identity_cache_ttl` (default: `300000`): Cache TTL in milliseconds (5 minutes)
- `identity_api_allow_fallback` (default: `false`): Allow empty permissions if API fails

### Credentials Authentication

- `identity_merge_identifiers` (default: `false`): Merge FiveM identifiers after credentials auth

## Quick Start

### Example: Local Auth (Auto-Create)

```ts
// server/bootstrap.ts
import { container } from "tsyringe";
import { Identity } from "@open-core/identity";

// Setup Identity with local auth
Identity.setup(container, {
  authProvider: "local",
  principalProvider: "local",
  useDatabase: true,
});
```

```ts
// server/controllers/auth.controller.ts
import { Server, Utils } from "@open-core/framework";
import { Identity } from "@open-core/identity";

@Server.Controller()
export class AuthController {
  constructor(
    private readonly auth: Identity.LocalAuthProvider,
    private readonly players: Server.PlayerService,
  ) {}

  @Server.OnCoreEvent("core:playerSessionCreated")
  async handlePlayerSession({
    clientId,
  }: Server.PlayerSessionCreatedPayload): Promise<void> {
    const player = this.players.getByClient(clientId);
    if (!player) {
      throw new Utils.AppError(
        "PLAYER_NOT_FOUND",
        `Player ${clientId} not found during session creation`,
        "server",
      );
    }

    // Authenticate automatically using FiveM identifiers
    const result = await this.auth.authenticate(player, {});

    if (!result.success) {
      player.kick(result.error ?? "Authentication failed");
      return;
    }

    // Player is now authenticated and linked
    player.emit("auth:success", {
      linkedId: result.accountID,
      isNewAccount: result.isNewAccount,
    });
  }
}
```

### Example: Credentials Auth (Username/Password)

```ts
// server/bootstrap.ts
import { container } from "tsyringe";
import { Identity } from "@open-core/identity";

Identity.setup(container, {
  authProvider: "credentials",
  principalProvider: "local",
  useDatabase: true,
});
```

```ts
// server/controllers/auth.controller.ts
import { Server, Utils } from "@open-core/framework";
import { Identity } from "@open-core/identity";

@Server.Controller()
export class AuthController {
  constructor(
    private readonly auth: Identity.CredentialsAuthProvider,
    private readonly players: Server.PlayerService,
  ) {}

  @Server.OnCoreEvent("core:playerSessionCreated")
  async handlePlayerSession({
    clientId,
  }: Server.PlayerSessionCreatedPayload): Promise<void> {
    const player = this.players.getByClient(clientId);
    if (!player) return;

    // Show login UI to player
    player.emit("auth:showLogin");
  }

  @Server.OnNet("auth:loginAttempt")
  async handleLoginAttempt(
    player: Server.Player,
    username: string,
    password: string,
  ): Promise<void> {
    const result = await this.auth.authenticate(player, {
      username,
      password,
    });

    if (!result.success) {
      player.emit("auth:loginFailed", result.error);
      return;
    }

    // Authentication successful
    player.emit("auth:loginSuccess", {
      linkedId: result.accountID,
    });

    // Spawn player
    player.emit("player:spawn", {
      position: { x: -1032.0, y: -2732.0, z: 13.8 },
      model: "mp_m_freemode_01",
    });
  }

  @Server.OnNet("auth:register")
  async handleRegister(
    player: Server.Player,
    username: string,
    password: string,
  ): Promise<void> {
    const result = await this.auth.register(player, {
      username,
      password,
    });

    if (!result.success) {
      player.emit("auth:registerFailed", result.error);
      return;
    }

    player.emit("auth:registerSuccess", {
      linkedId: result.accountID,
    });
  }
}
```

### Example: API Auth (External System)

```ts
// server/bootstrap.ts
import { container } from "tsyringe";
import { Identity } from "@open-core/identity";

Identity.setup(container, {
  authProvider: "api",
  principalProvider: "api",
  useDatabase: false, // No local DB needed
});
```

```ts
// server/controllers/auth.controller.ts
import { Server, Utils } from "@open-core/framework";
import { Identity } from "@open-core/identity";

@Server.Controller()
export class AuthController {
  constructor(
    private readonly auth: Identity.ApiAuthProvider,
    private readonly players: Server.PlayerService,
  ) {}

  @Server.OnCoreEvent("core:playerSessionCreated")
  async handlePlayerSession({
    clientId,
  }: Server.PlayerSessionCreatedPayload): Promise<void> {
    const player = this.players.getByClient(clientId);
    if (!player) return;

    // Show login UI - API will validate
    player.emit("auth:showLogin");
  }

  @Server.OnNet("auth:loginAttempt")
  async handleLoginAttempt(
    player: Server.Player,
    token: string,
  ): Promise<void> {
    // API provider will POST to external API
    const result = await this.auth.authenticate(player, { token });

    if (!result.success) {
      player.emit("auth:loginFailed", result.error);
      return;
    }

    // linkedId comes from external API
    player.emit("auth:loginSuccess", {
      linkedId: result.accountID,
    });

    player.emit("player:spawn", {
      position: { x: -1032.0, y: -2732.0, z: 13.8 },
      model: "mp_m_freemode_01",
    });
  }
}
```

### Example: Protect Handlers with Permissions

The framework **secures all handlers by default**. Use `@Guard` for permission/rank checks:

```ts
import { Server } from "@open-core/framework";
import { Identity } from "@open-core/identity";

@Server.Controller()
export class AdminController {
  constructor(private readonly accounts: Identity.AccountService) {}

  @Server.OnNet("admin:banPlayer")
  @Server.Guard({ permission: "admin.ban" })
  async banPlayer(player: Server.Player, targetId: number): Promise<void> {
    // player.accountID is guaranteed to exist (authenticated)
    const target = await this.accounts.findById(targetId);
    if (!target) {
      player.emit("error", "Target not found");
      return;
    }

    await this.accounts.ban(targetId, {
      reason: "Banned by admin",
      durationMs: 86400000, // 24 hours
    });

    player.emit("success", `Player ${targetId} banned successfully`);
  }

  @Server.OnNet("admin:givePermission")
  @Server.Guard({ rank: 100 }) // Only rank 100+ (super admin)
  async givePermission(
    player: Server.Player,
    targetId: number,
    permission: string,
  ): Promise<void> {
    await this.accounts.addCustomPermission(targetId, permission);
    player.emit("success", `Permission ${permission} granted`);
  }

  @Server.OnNet("chat:moderate")
  @Server.Guard({ rank: 50 }) // Moderator rank or higher
  async moderateChat(player: Server.Player, message: string): Promise<void> {
    // Moderation logic here
    player.emit("chat:moderated", message);
  }
}
```

**Note**: Use `@Server.Public()` to allow unauthenticated access to specific handlers.

## Services

### RoleService

Manage roles and their permissions:

```ts
const roleService = container.resolve(Identity.RoleService);

// Create a role
await roleService.create({
  name: "moderator",
  displayName: "Moderator",
  rank: 50,
  permissions: ["chat.moderate", "player.kick"],
});

// Add permission to role
await roleService.addPermission(roleId, "player.mute");

// Get default role
const defaultRole = await roleService.getDefaultRole();
```

### AccountService

Manage accounts and custom permissions:

```ts
const accountService = container.resolve(Identity.AccountService);

// Find account by linkedId
const account = await accountService.findByLinkedId(linkedId);

// Or find by ID
const accountById = await accountService.findById(accountId);

// Assign role
await accountService.assignRole(accountId, roleId);

// Add custom permission (override)
await accountService.addCustomPermission(accountId, "special.feature");

// Negate a role permission
await accountService.addCustomPermission(accountId, "-chat.moderate");

// Get effective permissions (role + custom)
const permissions = await accountService.getEffectivePermissions(accountId);

// Ban account
await accountService.ban(accountId, {
  reason: "Violation of rules",
  durationMs: 86400000, // 24 hours
});
```

### MemoryCacheService

Cache service used by API providers:

```ts
const cache = container.resolve(Identity.MemoryCacheService);

// Set with TTL
cache.set("key", { data: "value" }, 60000); // 1 minute

// Get
const value = cache.get<{ data: string }>("key");

// Delete
cache.delete("key");

// Clear all
cache.clear();
```

## Permission System

### How Effective Permissions Work

1. **Base**: Start with role's base permissions
2. **Additions**: Custom permissions without `-` prefix are added
3. **Negations**: Custom permissions with `-` prefix remove base permissions

Example:

- Role "moderator" has: `["chat.moderate", "player.kick"]`
- Account custom permissions: `["admin.view", "-player.kick"]`
- **Effective**: `["chat.moderate", "admin.view"]` (kick negated)

### Principal Structure

When a player is authenticated, the Principal Provider returns a `Principal`:

```ts
{
  id: account.linkedId ?? String(account.id), // linkedId or numeric ID
  name: role.displayName,                      // e.g., "Administrator"
  rank: role.rank,                             // e.g., 100
  permissions: effectivePerms,                 // combined array
  meta: {
    accountId: account.id,
    roleId: role.id,
    roleName: role.name
  }
}
```

## Error Handling

The module throws `AppError` for security violations:

- **No linked account**: `AppError('UNAUTHORIZED', 'Player is not authenticated')`
- **Account not found**: `AppError('UNAUTHORIZED', 'Linked account not found')`
- **Account banned**: `AppError('PERMISSION_DENIED', 'Account is banned', { banReason, banExpires })`

Handle these in your error handlers or let the framework's default handler catch them.

## Migration Guide

### From uuid to linkedId

If you're upgrading from an earlier version:

1. Run migration 004: `migrations/004_rename_uuid_to_linked_id.sql`
2. Update code: `findByUuid()` → `findByLinkedId()`
3. Update code: `account.uuid` → `account.linkedId`
4. Everything else works the same

### Adding API Authentication

1. Set up your external API with the contracts above
2. Configure convars
3. Update setup:

```ts
Identity.setup(container, {
  authProvider: "api",
  principalProvider: "api",
  useDatabase: false,
});
```

## Advanced Usage

### Hybrid Setup (API Auth + Local Permissions)

```ts
Identity.setup(container, {
  authProvider: "api",
  principalProvider: "local", // Use local DB for permissions
  useDatabase: true, // Keep DB for roles/permissions
});
```

### Custom Provider

You can create your own auth/principal provider:

```ts
@injectable()
class CustomAuthProvider implements Server.AuthProviderContract {
  async authenticate(player, credentials) {
    // Your custom logic
  }
  // ... implement other methods
}

// Register manually
container.registerSingleton("AuthProviderContract", CustomAuthProvider);
```

## Namespace Exports

All exports are available under the `Identity` namespace:

```ts
import { Identity } from "@open-core/identity";

// Types
Identity.Account;
Identity.Role;
Identity.SetupOptions;

// Services
Identity.AccountService;
Identity.RoleService;
Identity.MemoryCacheService;

// Auth Providers
Identity.LocalAuthProvider;
Identity.CredentialsAuthProvider;
Identity.ApiAuthProvider;

// Principal Providers
Identity.LocalPrincipalProvider;
Identity.ApiPrincipalProvider;

// Setup
Identity.setup(container, options);
```

## Scripts

```bash
# Build
pnpm build

# Lint
pnpm lint

# Lint and fix
pnpm lint:fix

# Clean build artifacts
pnpm clean
```

## License

MIT
