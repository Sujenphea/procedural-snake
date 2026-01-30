import js from "@eslint/js"
import tseslint from "typescript-eslint"
import parserTs from "@typescript-eslint/parser"

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["**/node_modules/**", "**/dist/**", "*.config.js", "eslint.config.js"],
  },
  {
    files: ["**/*.{js,ts,jsx,tsx}"],
    languageOptions: { parser: parserTs },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error"],
    },
  },
]
