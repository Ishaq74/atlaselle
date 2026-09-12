# Email & Password

Implementing email and password authentication with Better Auth.

Email and password authentication is a common method used by many applications. Better Auth provides a built-in email and password authenticator that you can easily integrate into your project.

## Enable Email and Password

To enable email and password authentication, set the `emailAndPassword.enabled` option to `true` in the `auth` configuration.

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
});
```

## Usage

### Sign Up

Client Side:

```ts
const { data, error } = await authClient.signUp.email({
    name: "John Doe",
    email: "john.doe@example.com",
    password: "password1234",
    image: "https://example.com/image.png", // optional
    callbackURL: "https://example.com/callback", // optional
});
```

Server Side:

```ts
const data = await auth.api.signUpEmail({
    body: {
      name: "John Doe",
      email: "john.doe@example.com",
      password: "password1234",
      image: "https://example.com/image.png", // optional
      callbackURL: "https://example.com/callback", // optional
    }
});
```

### Sign In

Client Side:

```ts
const { data, error } = await authClient.signIn.email({
    email: "john.doe@example.com",
    password: "password1234",
    rememberMe: true, // optional
    callbackURL: "https://example.com/callback", // optional
});
```

Server Side:

```ts
const data = await auth.api.signInEmail({
    body: {
      email: "john.doe@example.com",
      password: "password1234",
      rememberMe: true, // optional
      callbackURL: "https://example.com/callback", // optional
    },
    headers: await headers()
});
```

### Sign Out

Client Side:

```ts
const { data, error } = await authClient.signOut({});
```

Server Side:

```ts
await auth.api.signOut({
    headers: await headers()
});
```

### Email Verification

To enable email verification, pass a function that sends a verification email with a link. The `sendVerificationEmail` function takes a data object with the following properties:

- `user`: The user object.
- `url`: The URL to send to the user which contains the token.
- `token`: A verification token used to complete the email verification.

```ts
import { betterAuth } from "better-auth";
import { sendEmail } from "./email";

export const auth = betterAuth({
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email address",
        text: `Click the link to verify your email: ${url}`,
      });
    },
  },
});
```
