// Zod-free on purpose: LOCALES/CATEGORIES are imported as values (not just
// types) from client code (app-layout, [locale].page for route/locale
// handling). Keeping them out of product-schema.ts matters because that
// file does `import { z } from 'zod'` at module scope - a bundler can't
// prove z.object(...) is side-effect-free, so any value import from that
// module drags the whole zod schema graph into the client bundle even
// when only LOCALES is actually used there.
export const LOCALES = ['en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const CATEGORIES = ['apparel/shirts', 'apparel/shoes'] as const;
export type Category = (typeof CATEGORIES)[number];
