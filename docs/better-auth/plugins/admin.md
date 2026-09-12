# Admin

Le plugin Admin fournit des fonctions d’administration pour la gestion des utilisateurs : création, rôles, bannissement, impersonation, sessions, etc.

## Installation

### Ajouter le plugin à la config

```ts
import { betterAuth } from "better-auth"
import { admin } from "better-auth/plugins"

export const auth = betterAuth({
  plugins: [
    admin()
  ]
})
```

### Migration de la base de données

Ajoutez les champs suivants :

| Table   | Champ              | Type    | Description                                      |
|---------|--------------------|---------|--------------------------------------------------|
| user    | role               | string  | Rôle de l’utilisateur (défaut : user)            |
| user    | banned             | boolean | Indique si l’utilisateur est banni               |
| user    | banReason          | string  | Raison du bannissement                           |
| user    | banExpires         | date    | Date d’expiration du bannissement                |
| session | impersonatedBy     | string  | ID de l’admin qui impersonate la session         |

Ou utilisez la CLI :

```bash
npx @better-auth/cli migrate
```

Ou :

```bash
npx @better-auth/cli generate
```

### Ajouter le plugin côté client

```ts
import { createAuthClient } from "better-auth/client"
import { adminClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [
    adminClient()
  ]
})
```

## Usage

### Créer un utilisateur

```ts
const { data } = await authClient.admin.createUser({
  email: "user@example.com",
  password: "secure-password",
  name: "James Smith",
  role: "user"
})
```

### Lister les utilisateurs

```ts
const { data } = await authClient.admin.listUsers({
  searchValue: "James",
  limit: 10,
  offset: 0
})
```

### Changer le rôle d’un utilisateur

```ts
const { data } = await authClient.admin.setRole({
  userId: "user-id",
  role: "admin"
})
```

### Bannir/débannir un utilisateur

```ts
await authClient.admin.banUser({ userId: "user-id", banReason: "Spamming" })
await authClient.admin.unbanUser({ userId: "user-id" })
```

### Impersonate (se connecter en tant qu’un autre utilisateur)

```ts
await authClient.admin.impersonateUser({ userId: "user-id" })
await authClient.admin.stopImpersonating({})
```

### Supprimer un utilisateur

```ts
await authClient.admin.removeUser({ userId: "user-id" })
```

## Accès et permissions

- Rôles par défaut : `admin`, `user` (un utilisateur peut avoir plusieurs rôles)
- Permissions par défaut : créer, lister, bannir, impersonate, supprimer, changer mot de passe, etc.
- Possibilité de définir des permissions personnalisées avec `createAccessControl` et de passer les rôles au plugin.

Exemple :

```ts
import { createAccessControl } from "better-auth/plugins/access"
const statement = { project: ["create", "update", "delete"] } as const
const ac = createAccessControl(statement)
const admin = ac.newRole({ project: ["create", "update"] })
export const auth = betterAuth({ plugins: [admin({ ac, roles: { admin } })] })
```

## Schéma

| Table   | Champ              | Type    | Description                                      |
|---------|--------------------|---------|--------------------------------------------------|
| user    | role               | string  | Rôle de l’utilisateur (défaut : user)            |
| user    | banned             | boolean | Indique si l’utilisateur est banni               |
| user    | banReason          | string  | Raison du bannissement                           |
| user    | banExpires         | date    | Date d’expiration du bannissement                |
| session | impersonatedBy     | string  | ID de l’admin qui impersonate la session         |

## Options

- `defaultRole` : rôle par défaut (défaut : user)
- `adminRoles` : rôles considérés comme admin (défaut : ["admin"])
- `adminUserIds` : liste d’IDs considérés comme admin
- `impersonationSessionDuration` : durée de la session d’impersonation (défaut : 1h)
- `defaultBanReason` : raison par défaut du bannissement
- `defaultBanExpiresIn` : durée par défaut du bannissement
- `bannedUserMessage` : message affiché à l’utilisateur banni

---

Documentation officielle : <[better-auth.com/llms.txt/docs/plugins/admin.md](https://www.better-auth.com/llms.txt/docs/plugins/admin.md)>
