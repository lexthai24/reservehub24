import eslint from "@eslint/js";
import tsParser from "@typescript-eslint/parser";

export default [
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "**/drizzle/**"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser: tsParser },
    rules: {},
  },
  { files: ["**/*.js", "**/*.mjs", "**/*.cjs"], ...eslint.configs.recommended },
];
