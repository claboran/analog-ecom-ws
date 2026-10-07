import nx from "@nx/eslint-plugin";
import baseConfig from "../../eslint.config.mjs";

export default [
    ...nx.configs["flat/angular"],
    ...nx.configs["flat/angular-template"],
    ...baseConfig,
    {
        files: [
            "**/*.ts"
        ],
        rules: {
            "@angular-eslint/directive-selector": [
                "error",
                {
                    type: "attribute",
                    prefix: "app",
                    style: "camelCase"
                }
            ],
            "@angular-eslint/component-selector": [
                "error",
                {
                    type: "element",
                    prefix: "app",
                    style: "kebab-case"
                }
            ]
        }
    },
    {
        // cart-schema.ts imports zod at module scope: client code may only
        // `import type` from it (erased at compile time), never import values.
        files: [
            "**/src/app/**/*.ts"
        ],
        ignores: [
            "**/src/app/lib/cart-schema.ts"
        ],
        rules: {
            "@typescript-eslint/no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            regex: "(^|/)cart-schema$",
                            allowTypeImports: true,
                            message: "cart-schema pulls zod into the client bundle - use `import type`, and keep runtime values in cart-constants.ts."
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            "**/*.html"
        ],
        // Override or add rules here
        rules: {}
    }
];
