# Installation

Learn how to configure Better Auth in your project.

## Install the Package

```bash
npm install better-auth
```

## Set Environment Variables

Create a `.env` file in the root of your project and add the following environment variables:

```txt
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:4321
```

## Create A Better Auth Instance

Create a file named `auth.ts` in your project and import Better Auth:

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  // ...options
});
```
