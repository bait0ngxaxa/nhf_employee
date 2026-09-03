import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

const eslintConfig = [
    ...compat.extends("next/core-web-vitals", "next/typescript"),
    {
        ignores: [
            ".next/**",
            "out/**",
            "build/**",
            "dist/**",
            "node_modules/**",
            "next-env.d.ts",
            "lib/generated/**",
            "*.config.js",
            "*.config.ts",
        ],
    },
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
];

export default eslintConfig;
