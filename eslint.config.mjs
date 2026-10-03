import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // These effects intentionally synchronize UI state with browser-only
      // media, portal, and debounced-network state after hydration.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      // Source-level regression tests use controlled CommonJS cache injection.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["vendor/next-eslint-glob/*.cjs"],
    rules: {
      // The pinned Next ESLint caller loads this adapter through CommonJS.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    ".test-artifacts/**",
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "dist/**",
    "out/**",
  ]),
]);
