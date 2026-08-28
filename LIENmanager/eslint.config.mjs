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
    // Playwright Persistent Context(Chromeプロファイル)のキャッシュ・拡張機能等。
    // ブラウザ側が生成するファイルであり、プロジェクトのソースコードではない。
    "playwright/**",
  ]),
]);

export default eslintConfig;
