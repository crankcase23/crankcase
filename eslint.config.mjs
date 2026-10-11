import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Guide Factory recovery: quarantined reconstruction + byte-frozen recovered
    // copies (scripts/visuals/factory-reconstructed/RECOVERY.md). Kept verbatim so
    // its hashes stay checkable; not linted to our app rules.
    "scripts/visuals/factory-reconstructed/**",
  ]),
]);

export default eslintConfig;
