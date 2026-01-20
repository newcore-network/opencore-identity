# @open-core/identity

Enterprise-grade identity, authentication, and authorization plugin for the OpenCore Framework.

## Documentation Index

- [Architecture & Dependency Injection](./docs/architecture.md) - Learn about constructor injection and DI.
- [Authentication Modes](./docs/auth-modes.md) - Details on `local`, `credentials`, and `api` auth.
- [Principal Modes](./docs/principal-modes.md) - Details on `roles`, `db`, and `api` authorization.
- [Implementing Contracts](./docs/contracts.md) - How to build your own `IdentityStore` or `RoleStore`.

## Features

- **Multi-Strategy Authentication**: Support for `local`, `credentials`, and `api` strategies.
- **Hierarchical RBAC**: Rank-based authorization and permission merging.
- **Constructor Injection**: Services are automatically available in your classes via DI.
- **Stateless Architecture**: Decoupled persistence via implementable contracts.

## Quick Start (Constructor Injection)

The recommended way to use the identity system is through **Constructor Injection**. The framework handles the lifecycle for you.

```ts
import { Server } from "@open-core/framework";
import { AccountService } from "@open-core/identity";

@Server.Controller()
export class MyController {
  // AccountService is automatically injected
  constructor(private readonly accounts: AccountService) {}

  @Server.OnNet("admin:ban")
  async handleBan(player: Server.Player, targetId: string) {
    await this.accounts.ban(targetId, { reason: "Policy violation" });
  }
}
```

## Installation & Setup

1.  **Implement your Store** (See [Contracts](./docs/contracts.md)):

    ```ts
    import { Identity, IdentityStore } from "@open-core/identity";

    class MyStore extends IdentityStore {
      /* ... */
    }

    // Register it before installation
    Identity.setIdentityStore(MyStore);
    ```

2.  **Install the Plugin**:
    ```ts
    Identity.install({
      auth: { mode: "local", autoCreate: true, primaryIdentifier: "license" },
      principal: {
        mode: "roles",
        roles: {
          admin: { name: "admin", rank: 100, permissions: ["*"] },
          user: { name: "user", rank: 0, permissions: ["chat.use"] },
        },
      },
    });
    ```

## Auth Strategies

All strategies are resolved through `AuthService`. Configure one mode and the framework
will inject the correct provider.

Quick summary:

- local: identifies by license/steam/discord, no form.
- credentials: username/password stored on your server.
- api: delegates to an external HTTP service.

### Local (Identifiers)

What it is: authenticates using player identifiers (license/steam/discord).
Who it is for: servers that want automatic access without forms.

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

### Credentials (Username/Password)

What it is: login and registration with username/password stored on your server.
Who it is for: servers with custom UI or manual registration.

```ts
Identity.install({
  auth: {
    mode: "credentials",
  },
  // ...
});
```

### API (External Service)

What it is: delegates all auth to an external HTTP service.
Who it is for: large networks with a centralized database or SSO.

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

## Usage Example

```ts
import { Server } from "@open-core/framework";
import { AuthService } from "@open-core/identity";

@Server.Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Server.OnNet("auth:login")
  async login(
    player: Server.Player,
    payload: { username: string; password: string },
  ) {
    return this.auth.authenticate(player, payload);
  }

  @Server.OnNet("auth:register")
  async register(
    player: Server.Player,
    payload: { username: string; password: string },
  ) {
    return this.auth.register(player, payload);
  }
}
```

## Exports

The library only exports high-level components to keep your IDE suggestions clean:

- `Identity`: The main namespace for installation and registration.
- `AccountService`, `RoleService`: Public services for business logic.
- `IdentityStore`, `RoleStore`: Abstract contracts for persistence.
- `IDENTITY_OPTIONS`: Token for advanced DI usage.
- All relevant types and interfaces.

## License

MIT
