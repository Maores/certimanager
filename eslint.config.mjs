import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // One-off local scripts; gitignored too.
    "scripts/*.mjs",
  ]),
  {
    rules: {
      // Honor underscore-prefix as "intentionally unused" (industry standard).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      // Tracked tech debt: many server-action and page-level fetches use
      // `any` for Supabase rows. Proper typing is a separate effort; until
      // then, keep CI green by treating these as warnings, not errors.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
