import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

// eslint-config-next 16 ships flat configs directly, so FlatCompat is no longer
// needed — and passing these through it crashes ESLint 10 during validation.
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "drizzle/**", "next-env.d.ts"],
  },
]

export default eslintConfig
