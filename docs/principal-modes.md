# Principal Modes (Authorization)

The `principal.mode` option defines how the system resolves a player's roles and permissions.

## 1. `roles` Mode (Static)

The fastest and most common mode. Role definitions are provided directly in the code via `IdentityOptions`.

- **How it works**: When a player connects, the system looks up their `roleName` and matches it against the static roles object.
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

## Configuration Example

```ts
Identity.install({
  principal: {
    mode: 'roles',
    roles: {
      admin: { name: 'admin', rank: 100, permissions: ['*'] }
    },
    cacheTtl: 600000 // 10 minutes cache
  },
  // ...
});
```
