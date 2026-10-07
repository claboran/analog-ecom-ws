// Values the client needs at runtime (form limits). Deliberately separate
// from cart-schema.ts: that file imports zod at module scope, so a value
// import from it would pull zod into the client bundle. Client code may only
// `import type` from cart-schema (enforced in eslint.config.mjs).
export const MAX_QUANTITY = 10;
export const MAX_USER_NAME_LENGTH = 40;
