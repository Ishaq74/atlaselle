# Basic Usage

Getting started with Better Auth

Better Auth provides built-in authentication support for:

- Email and password
- Social provider (Google, GitHub, Apple, and more)

It can also be extended using plugins, such as username, magic link, passkey, email-otp, and more.

## Email & Password

To sign up a user, call the client method `signUp.email` with the user's information.

```ts
import { authClient } from "@lib/auth-client";

const { data, error } = await authClient.signUp.email({
    email,
    password,
    name,
    image, // optional
    callbackURL: "/dashboard" // optional
}, {
    onRequest: (ctx) => {
        // show loading
    },
    onSuccess: (ctx) => {
        // redirect to dashboard or sign in page
    },
    onError: (ctx) => {
        alert(ctx.error.message);
    },
});
```
