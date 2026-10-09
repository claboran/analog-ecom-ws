import { createError, deleteCookie, getCookie, setCookie, type H3Event } from 'h3';
import { randomUUID } from 'node:crypto';
import { getProduct } from '@analog-ecom-ws/s3-client';
import type { Locale } from '@analog-ecom-ws/product-schema';
import type { CartLine, CartView, OrderView } from '../../app/lib/cart-schema';

// Demo-grade session: a random id in an httpOnly cookie, state in a
// module-level Map. Lost on restart and not shared across instances - fine
// for the demo, and the reason this file is the only place that touches the
// Map (swap in Nitro's useStorage() here if that ever matters).
const COOKIE = 'sid';
const TTL_MS = 2 * 60 * 60 * 1000;
const MAX_SESSIONS = 1000;

type StoredItem = { sku: string; size: string; color: string; quantity: number };
// Orders live on the session too: an order is only ever readable by the
// session that placed it, and goes away with it.
type Session = { userName: string; items: StoredItem[]; orders: OrderView[]; lastSeen: number };

const sessions = new Map<string, Session>();

const sweep = (): void => {
  const cutoff = Date.now() - TTL_MS;
  Array.from(sessions.entries()).forEach(([id, session]) => {
    if (session.lastSeen < cutoff) {
      sessions.delete(id);
    }
  });
  // Map iterates in insertion order, so the oldest go first.
  for (const id of sessions.keys()) {
    if (sessions.size < MAX_SESSIONS) {
      break;
    }
    sessions.delete(id);
  }
};

const writeCookie = (event: H3Event, id: string): void => {
  setCookie(event, COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: TTL_MS / 1000,
  });
};

// Sliding expiry, on both sides: every lookup that finds a live session
// bumps `lastSeen` (server TTL) and re-sends the cookie (browser max-age), so
// the two always expire together after 2h of inactivity. A fixed cookie
// max-age would drop the cookie while the server still held the session.
export const findSession = (event: H3Event): Session | undefined => {
  const id = getCookie(event, COOKIE);
  const session = id ? sessions.get(id) : undefined;
  if (id && session) {
    session.lastSeen = Date.now();
    writeCookie(event, id);
  } else if (id) {
    deleteCookie(event, COOKIE); // stale cookie from before a restart/TTL
  }
  return session;
};

// The pseudo login. Signing in again while a session exists just renames it
// (keeps the cart); there is no password and nothing to verify.
export const signIn = (event: H3Event, userName: string): Session => {
  const existing = findSession(event);
  if (existing) {
    existing.userName = userName;
    return existing;
  }
  sweep();
  const id = randomUUID();
  const session: Session = { userName, items: [], orders: [], lastSeen: Date.now() };
  sessions.set(id, session);
  writeCookie(event, id);
  return session;
};

// Deletes the session outright: cart and orders go with it.
export const signOut = (event: H3Event): void => {
  const id = getCookie(event, COOKIE);
  if (id) {
    sessions.delete(id);
    deleteCookie(event, COOKIE);
  }
};

export const addItem = (session: Session, item: StoredItem): void => {
  const same = session.items.find(
    (i) => i.sku === item.sku && i.size === item.size && i.color === item.color,
  );
  if (same) {
    same.quantity += item.quantity;
  } else {
    session.items.push({ ...item });
  }
};

// Titles/prices come from the product source at read time, never from the
// client or from what was stored when the item was added.
export const toCartView = async (session: Session | undefined, locale: Locale): Promise<CartView> => {
  if (!session) {
    return { lines: [] };
  }
  const lines = await Promise.all(
    session.items.map(async (item): Promise<CartLine | null> => {
      const product = await getProduct(item.sku, locale).catch(() => null);
      return product
        ? { ...item, title: product.title, unitPrice: product.price, currency: product.currency }
        : null;
    }),
  );
  return { lines: lines.filter((line): line is CartLine => line !== null) };
};

export const requireProduct = async (sku: string) => {
  const product = await getProduct(sku, 'en').catch(() => null);
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: `Unknown product ${sku}` });
  }
  return product;
};

// Stock is tracked per sku (not per size/color), so lines of the same sku
// are summed. Checked again here because add-to-cart only guarantees
// "at least one" and stock can change in between. The demo never decrements
// stock (the product source is read-only), so this guards the cart against
// the catalog, not orders against each other.
const assertInStock = async (lines: CartLine[]): Promise<void> => {
  const wanted = new Map<string, { title: string; quantity: number }>();
  for (const line of lines) {
    const entry = wanted.get(line.sku);
    wanted.set(line.sku, { title: line.title, quantity: (entry?.quantity ?? 0) + line.quantity });
  }
  for (const [sku, { title, quantity }] of wanted) {
    const product = await requireProduct(sku);
    if (product.stock < quantity) {
      throw createError({
        statusCode: 409,
        statusMessage:
          product.stock > 0 ? `Only ${product.stock} of "${title}" in stock` : `"${title}" is out of stock`,
      });
    }
  }
};

// Prices the order from the product source (never from the client), freezes
// it on the session and empties the cart. Returns null for an empty cart.
export const placeOrder = async (session: Session, locale: Locale): Promise<OrderView | null> => {
  const { lines } = await toCartView(session, locale);
  if (lines.length === 0) {
    return null;
  }
  await assertInStock(lines);
  const order: OrderView = {
    id: randomUUID(),
    userName: session.userName,
    lines,
    total: Math.round(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) * 100) / 100,
    currency: lines[0].currency,
    placedAt: new Date().toISOString(),
  };
  session.orders.push(order);
  session.items = [];
  return order;
};
