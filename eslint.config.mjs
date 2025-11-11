import typescriptEslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-plugin-prettier";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [{
  ignores: ["**/webpack.config.js", "**/tsconfig.json"],
}, ...compat.extends(
  "eslint:recommended",
  "plugin:@typescript-eslint/recommended",
  "plugin:prettier/recommended",
  "prettier",
), {
  plugins: {
    "@typescript-eslint": typescriptEslint,
    prettier,
  },

  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
    },

    parser: tsParser,
    ecmaVersion: "latest",
    sourceType: "module",

    parserOptions: {
      project: "./tsconfig.json",
    },
  },

  rules: {
    "no-console": 0,
    semi: ["error", "always"],
    "@typescript-eslint/no-explicit-any": 2,
    "no-case-declarations": "off",
    "@typescript-eslint/no-use-before-define": "off",
  },
}];