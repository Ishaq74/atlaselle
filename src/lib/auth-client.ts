import { createAuthClient } from "better-auth/client";
import { usernameClient, adminClient } from "better-auth/client/plugins";
import { ac, adminRole, editorRole, userRole } from "@/lib/permissions";

export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    adminClient({
      ac,
      roles: {
        admin: adminRole,
        editor: editorRole,
        user: userRole,
      },
    }),
  ],
});
