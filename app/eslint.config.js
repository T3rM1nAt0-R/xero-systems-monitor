import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    plugins: { react, "react-hooks": hooks },
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.browser, ...globals.node }, parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: "18.3" } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      "react-hooks/rules-of-hooks": "error",
      // A few memos deliberately depend on a narrowed value (the minute, not the second). Each of those carries an eslint-disable-line with the reason.
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["error", { ignoreRestSiblings: true }],
      "react/prop-types": "off",
    },
  },
];
