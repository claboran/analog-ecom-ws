import { HttpClient } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import type { Locale } from '@analog-ecom-ws/product-schema/locales';
import type { AddToCartInput, CartLine, CartView, OrderView } from '../lib/cart-schema';

type CartState = CartView & {
  // 'idle' is also what the server renders: the cart is client-only, so SSR
  // output (empty badge, skeleton cart page) always matches the first client
  // render and hydration has nothing to mismatch.
  status: 'idle' | 'loading' | 'ready' | 'error';
};

const initialState: CartState = { lines: [], status: 'idle' };

// Client mirror of the server-side session cart (server/lib/cart-session.ts).
// The server is the source of truth; every method replaces local state with
// the CartView it returns. Nothing here runs during SSR - callers trigger
// `load` from afterNextRender.
export const CartStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ lines }) => ({
    count: computed(() => lines().reduce((sum: number, line: CartLine) => sum + line.quantity, 0)),
    total: computed(() => lines().reduce((sum: number, line: CartLine) => sum + line.quantity * line.unitPrice, 0)),
  })),
  withMethods((store, http = inject(HttpClient)) => ({
    async load(locale: Locale): Promise<void> {
      patchState(store, { status: 'loading' });
      try {
        const view = await firstValueFrom(http.get<CartView>('/api/cart', { params: { locale } }));
        patchState(store, { ...view, status: 'ready' });
      } catch {
        patchState(store, { status: 'error' });
      }
    },
    // Rejects on failure so the calling form can show it as a submit error.
    async add(input: AddToCartInput): Promise<void> {
      const view = await firstValueFrom(http.post<CartView>('/api/cart/items', input));
      patchState(store, { ...view, status: 'ready' });
    },
    // Signed out: the server deleted the session, so the cart is gone too.
    reset(): void {
      patchState(store, { lines: [], status: 'ready' });
    },
    // The server prices and freezes the order, then empties the cart; the
    // local mirror follows. Rejects on failure so the page can show it.
    async checkout(locale: Locale): Promise<OrderView> {
      const order = await firstValueFrom(http.post<OrderView>('/api/checkout', { locale }));
      patchState(store, { lines: [], status: 'ready' });
      return order;
    },
  })),
);
