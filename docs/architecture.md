# Architecture & Dependency Injection

The OpenCore Identity system is built on top of the **OpenCore Framework**'s dependency injection system (powered by `tsyringe`).

## Constructor Injection (Recommended)

Instead of manually resolving services, you should always prefer constructor injection. The framework will automatically provide the requested services.

### Example: Using AccountService in a Controller

```ts
import { Server } from "@open-core/framework";
import { AccountService } from "@open-core/identity";
import { injectable } from "tsyringe";

@injectable()
@Server.Controller()
export class MyController {
  // The service is automatically injected by the framework
  constructor(private readonly accountService: AccountService) {}

  @Server.OnNet("player:checkBan")
  async check(player: Server.Player) {
    const account = await this.accountService.findByLinkedId(player.accountID);
    if (account?.isBanned) {
      // Logic here
    }
  }
}
```

## Why Dependency Injection?

1.  **Testability**: You can easily swap real services with mocks during testing.
2.  **Decoupling**: Your logic doesn't depend on a specific implementation, only on the class/interface.
3.  **Lifecycle Management**: The framework handles singletons and instances for you.

## Internal Flow

1.  **Initialization**: `Identity.install(options)` is called.
2.  **Registration**: 
    - Configuration is registered as `IDENTITY_OPTIONS`.
    - Internal services (`AccountService`, `RoleService`) are registered as singletons.
    - SPI Providers are set via `Server.setAuthProvider` and `Server.setPrincipalProvider`.
3.  **Consumption**: Any class decorated with `@injectable()` or `@Server.Controller()` can receive identity services in its constructor.
