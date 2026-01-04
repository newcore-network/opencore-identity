# Authentication Modes

The `auth.mode` option defines how players are identified and authenticated when they connect to the server.

## 1. `local` Mode (Default)

Automatically identifies players using their FiveM connection identifiers (license, discord, steam, etc.).

- **Workflow**: 
    1. Player connects.
    2. Provider looks up the primary identifier (e.g., `license:123...`) in the `IdentityStore`.
    3. If not found and `autoCreate` is `true`, a new account is created automatically.
    4. The account is linked to the player.
- **Best for**: Standard FiveM servers where you want a seamless entry experience.

## 2. `credentials` Mode

Requires manual registration and login using a username and password.

- **Workflow**:
    1. Player must call a registration command/event with `username` and `password`.
    2. Passwords are hashed using `bcrypt`.
    3. On next connection, the player must provide credentials to authenticate.
- **Best for**: Servers with external web dashboards or those requiring a unique "in-character" account system.

## 3. `api` Mode

Delegates all authentication logic to an external HTTP service.

- **Workflow**:
    1. The provider sends the player identifiers or credentials to your API.
    2. Your API returns whether the player is allowed and their account data.
- **Best for**: Large networks with a centralized player database.

## Configuration Example

```ts
Identity.install({
  auth: {
    mode: 'credentials',
    primaryIdentifier: 'license', // Used as fallback or link
    autoCreate: false
  },
  // ...
});
```
