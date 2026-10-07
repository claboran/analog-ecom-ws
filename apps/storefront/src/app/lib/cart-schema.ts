import { z } from 'zod';
import { LOCALES } from '@analog-ecom-ws/product-schema/locales';
import { MAX_QUANTITY, MAX_USER_NAME_LENGTH } from './cart-constants';

// Single source of truth for the cart/checkout contract: the server
// validates requests against these schemas, and the client's types are
// derived from them with z.infer.
//
// Client code must only `import type` from this file - a value import would
// drag zod into the client bundle (see README's "Lessons learned" on the
// product-schema barrel). Types are erased at compile time, so type-only
// imports cost nothing; eslint.config.mjs enforces it.

export const localeSchema = z.enum(LOCALES);

// --- Requests (validated on the server) ---

export const addItemSchema = z.object({
  sku: z.string().min(1),
  size: z.string().min(1),
  color: z.string().min(1),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  locale: localeSchema,
  // Required only while the session has no user yet; the handler enforces that.
  userName: z.string().trim().min(1).max(MAX_USER_NAME_LENGTH).optional(),
});
export type AddToCartInput = z.infer<typeof addItemSchema>;

export const checkoutSchema = z.object({ locale: localeSchema });

// --- Responses (typed on the server, consumed as types on the client) ---

// One line per sku+size+color; adding the same combination again bumps qty.
export const cartLineSchema = z.object({
  sku: z.string(),
  size: z.string(),
  color: z.string(),
  quantity: z.number().int(),
  // Resolved for the requested locale at read time, never stored.
  title: z.string(),
  unitPrice: z.number(),
  currency: z.string(),
});
export type CartLine = z.infer<typeof cartLineSchema>;

export const cartViewSchema = z.object({
  // null until the first add-to-cart attaches a name to the session.
  userName: z.string().nullable(),
  lines: z.array(cartLineSchema),
});
export type CartView = z.infer<typeof cartViewSchema>;

// Snapshot taken at checkout: lines and prices are frozen from then on.
export const orderViewSchema = z.object({
  id: z.string(),
  userName: z.string(),
  lines: z.array(cartLineSchema),
  total: z.number(),
  currency: z.string(),
  placedAt: z.string(),
});
export type OrderView = z.infer<typeof orderViewSchema>;
