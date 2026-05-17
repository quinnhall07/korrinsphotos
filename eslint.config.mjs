import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "scripts/**",
      "styles/**",
      "tsconfig.tsbuildinfo",
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // react-hooks 7 introduced these strict rules; they flag legitimate auth/role
      // reset patterns and Date.now() usage in render across pre-existing code.
      // Surface as warnings rather than blocking lint until refactored.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default config;
