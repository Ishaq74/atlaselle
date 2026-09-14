# Astro Integration

Integrate Better Auth with Astro.

Better Auth comes with first class support for Astro. This guide will show you how to integrate Better Auth with Astro.

Before you start, make sure you have a Better Auth instance configured. If you haven't done that yet, check out the [installation](/docs/installation).

Mount the handler [#mount-the-handler]

Better Auth requests are handled by the catch-all API route `src/pages/api/auth/[...all].ts`:

```ts title="src/pages/api/auth/[...all].ts"
import { auth } from "@/lib/auth";
import type { APIRoute } from "astro";

export const ALL: APIRoute = async (ctx) => {
  return auth.handler(ctx.request);
};
```


Create a client [#create-a-client]

Astro supports multiple frontend frameworks, so you can easily import your client based on the framework you're using.

If you're not using a frontend framework, you can still import the vanilla client.

<Tabs
  items={[ "vanilla", "react", "vue", "svelte", "solid",
]}
  defaultValue="react"
>
  <Tab value="vanilla">
    ```ts title="lib/auth-client.ts"
    import { createAuthClient } from "better-auth/client"
    export const authClient =  createAuthClient()
    ```
  </Tab>

  <Tab value="react" title="lib/auth-client.ts">
    ```ts title="lib/auth-client.ts"
    import { createAuthClient } from "better-auth/react"
    export const authClient =  createAuthClient()
    ```
  </Tab>

  <Tab value="vue" title="lib/auth-client.ts">
    ```ts title="lib/auth-client.ts"
    import { createAuthClient } from "better-auth/vue"
    export const authClient =  createAuthClient()
    ```
  </Tab>

  <Tab value="svelte" title="lib/auth-client.ts">
    ```ts title="lib/auth-client.ts"
    import { createAuthClient } from "better-auth/svelte"
    export const authClient =  createAuthClient()
    ```
  </Tab>

  <Tab value="solid" title="lib/auth-client.ts">
    ```ts title="lib/auth-client.ts"
    import { createAuthClient } from "better-auth/solid"
    export const authClient =  createAuthClient()
    ```
  </Tab>
</Tabs>

Auth Middleware [#auth-middleware]

Astro Locals types [#astro-locals-types]

To have types for your Astro locals, you need to set it inside the `env.d.ts` file.

```ts title="env.d.ts"

/// <reference path="../.astro/types.d.ts" />

declare namespace App {
    // Note: 'import {} from ""' syntax does not work in .d.ts files.
    interface Locals {
        user: import("better-auth").User | null;
        session: import("better-auth").Session | null;
    }
}
```

Middleware [#middleware]

The project middleware (`src/middleware.ts`) resolves the session via `auth.api.getSession({ headers })` — without `x-forwarded-for`. It also calls `bootstrapModules()`, rejects invalid `[lang]` segments with a 404 locale-guard, and returns `503` (+ `Retry-After: 5`) if the session check exceeds a 5s timeout:

```ts title="src/middleware.ts"
import { auth } from "@/lib/auth";
import { LOCALES } from "@/i18n/config";
import { bootstrapModules } from "@/lib/cms/bootstrap";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
    bootstrapModules();

    // ─── Locale guard — reject invalid [lang] segments with 404 ─────
    const pathSegments = new URL(context.request.url).pathname.split('/').filter(Boolean);
    const maybeLang = pathSegments[0];
    if (maybeLang && /^[a-z]{2}$/.test(maybeLang) && !(LOCALES as readonly string[]).includes(maybeLang)) {
        return new Response('Not Found', { status: 404 });
    }

    let timedOut = false;
    let isAuthed: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
    const sessionPromise = auth.api.getSession({ headers: context.request.headers });

    try {
        isAuthed = await Promise.race([
            sessionPromise,
            new Promise<null>((resolve) => setTimeout(() => { timedOut = true; resolve(null); }, 5000)),
        ]);
    } catch (err) {
        console.error('[middleware] Session check failed:', err);
        isAuthed = null;
    }

    sessionPromise.catch((err) => {
        if (timedOut) console.warn('[middleware] Orphaned session check failed after timeout:', err);
    });

    if (timedOut) {
        console.warn('[middleware] Session check timed out (5s) — returning 503');
        return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
            status: 503,
            headers: { 'Retry-After': '5', 'Content-Type': 'application/json' },
        });
    }

    if (isAuthed) {
        context.locals.user = isAuthed.user;
        context.locals.session = isAuthed.session;
    } else {
        context.locals.user = null;
        context.locals.session = null;
    }

    return next();
});
```

Getting session on the server inside .astro file [#getting-session-on-the-server-inside-astro-file]

You can use `Astro.locals` to check if the user has session and get the user data from the server side. Here is an example of how you can get the session inside an `.astro` file:

```astro
---
import { UserCard } from "@components/user-card";

const session = () => {
    if (Astro.locals.session) {
        return Astro.locals.session;
    } else {
        // Redirect to login page if the user is not authenticated
        return Astro.redirect("/login");
    }
}

---

<UserCard initialSession={session} />
```
