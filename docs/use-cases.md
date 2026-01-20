# Common Use Cases & Solutions

This guide provides practical solutions for the three main implementation scenarios in OpenCore Identity.

## 1. Traditional FiveM Server (Local + Roles)
*Automatic login based on identifiers, with roles defined in code.*

**Scenario**: You want players to just join and have their progress saved. You manage ranks (Admin, VIP, User) manually or via commands.

```ts
Identity.install({
  auth: {
    mode: 'local',
    autoCreate: true,
    primaryIdentifier: 'license'
  },
  principal: {
    mode: 'roles',
    defaultRole: 'user',
    roles: {
      admin: { name: 'admin', rank: 100, permissions: ['*'], displayName: 'Staff' },
      user: { name: 'user', rank: 0, permissions: ['chat.use'], displayName: 'Player' }
    }
  }
});
```

## 2. Integrated Web Dashboard (API + API)
*Auth and permissions managed by a central web service.*

**Scenario**: Your server is part of a network with a website. Players register on the site, and the site API tells the game server what rank they have.

```ts
Identity.install({
  auth: {
    mode: 'api',
    api: {
      baseUrl: 'https://api.mynetwork.com',
      timeoutMs: 5000,
      headers: { 'Authorization': 'Bearer internal-secret' }
    }
  },
  principal: {
    mode: 'api',
    api: {
      baseUrl: 'https://api.mynetwork.com',
      principalPath: '/v1/game/principal' // or roles/ranks whatever
    }
  }
});
```

## 3. Persistent Database System (Credentials + DB)
*Players create accounts with passwords, roles stored in SQL.*

**Scenario**: You want an extra layer of security where players must log in. Roles are edited via HeidiSQL/PostgreSQL/MySQL/phpMyAdmin or an in-game editor that saves to the database.

```ts
// 1. Implement and register your stores (e.g., using TypeORM)
Identity.setIdentityStore(MyCustomIdentityStore);
Identity.setRoleStore(MyCustomRoleStore);

// 2. Install Identity
Identity.install({
  auth: { mode: 'credentials' },
  principal: { 
    mode: 'db',
    defaultRole: '1' // ID of the default role in your database
  }
});
```

---

## Solving Common Problems

### Problem A: Overriding Role Permissions
**Goal**: Give a specific player access to a command without changing their whole role.

**Solution**:
```ts
// Using AccountService
await accountService.addCustomPermission(player.accountID, 'teleport.self');

// Or to explicitly DENY a permission the role provides
await accountService.addCustomPermission(player.accountID, '-chat.global');
```

### Problem B: Waiting for Database Connection
**Goal**: Ensure Identity doesn't try to query the database before the connection is ready.

**Solution**:
```ts
Identity.install({
  // ...
  hooks: {
    waitFor: [MyDatabase.connect()], // Promise
    onReady: async ({ roles }) => {
      console.log("Identity system ready!");
    }
  }
});
```

### Problem C: Syncing Principal Data
**Goal**: A player's rank changed in the database/API, and you want to apply it immediately.

**Solution**:
```ts
// The next time the framework checks permissions, it will fetch fresh data
await principalProvider.refreshPrincipal(player); // * principalProvider come from core framework server-side *
```
