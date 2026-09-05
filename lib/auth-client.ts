"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

// Keep authentication requests on this origin and inside the HTTP rate limiter.
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [twoFactorClient()],
  fetchOptions: { credentials: "same-origin", cache: "no-store" },
});
