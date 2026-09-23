import { defineConfig, globalIgnores } from "eslint/config";
import nextTs from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "dist/**",
        "node_modules/**",
        "next-env.d.ts",
        "lib/generated/**",
        "*.config.js",
        "*.config.ts",
    ]),
    {
        rules: {
            // TypeScript - Strict Mode
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                },
            ],
            // "@typescript-eslint/explicit-module-boundary-types": [
            //     "warn",
            //     {
            //         allowArgumentsExplicitlyTypedAsAny: true,
            //     },
            // ],
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/ban-ts-comment": "error",
            "@typescript-eslint/no-non-null-assertion": "warn",
            "@typescript-eslint/consistent-type-imports": [
                "warn",
                {
                    prefer: "type-imports",
                    fixStyle: "inline-type-imports",
                },
            ],

            // Next.js
            "@next/next/no-html-link-for-pages": ["error", "app"],
            "@next/next/no-img-element": "error",

            // React Best Practices
            "react/self-closing-comp": "warn",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            "react-hooks/set-state-in-effect": "error",

            // Code Quality
            "no-console": ["warn", { allow: ["warn", "error"] }],
            "prefer-const": "warn",
            "no-debugger": "error",
            eqeqeq: ["error", "always"],
        },
    },
    // Phase A architecture guardrail. This applies only to the new shared/
    // boundary so legacy code can coexist during incremental migration.
    {
        files: ["shared/**/*.{js,jsx,ts,tsx}"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: [
                                "@/modules",
                                "@/modules/**",
                                "modules",
                                "modules/**",
                                "**/modules",
                                "**/modules/**",
                            ],
                            message: "shared/ must not depend on business modules. Keep the dependency in app/ or a module, or move only genuinely cross-domain capability into shared/.",
                        },
                    ],
                },
            ],
        },
    },
]);

export default eslintConfig;
