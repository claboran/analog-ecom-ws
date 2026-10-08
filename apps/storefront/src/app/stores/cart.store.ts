import { HttpClient } from '@angular/common/http';
import { Injector, computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { produce } from 'immer';
import { firstValueFrom, pipe, switchMap, tap } from 'rxjs';
import type { Locale } from '@analog-ecom-ws/product-schema/locales';
import type { AddToCartInput, CartLine, CartView, OrderView } from '../lib/cart-schema';
import { settled } from '../lib/settled';

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
//
// Two shapes of method, on purpose: `load` is a fire-and-forget rxMethod whose
// outcome lives in `status` (use `whenSettled()` to wait for it), while `add`
// and `checkout` are commands whose callers need the outcome - they return a
// promise that rejects on failure.
export const CartStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ lines }) => ({
    count: computed(() => lines().reduce((sum: number, line: CartLine) => sum + line.quantity, 0)),
    total: computed(() => lines().reduce((sum: number, line: CartLine) => sum + line.quantity * line.unitPrice, 0)),
  })),
  withMethods((store, http = inject(HttpClient), injector = inject(Injector)) => ({
    load: rxMethod<Locale>(
      pipe(
        tap(() =>
          patchState(
            store,
            produce<CartState>((state) => {
              state.status = 'loading';
            }),
          ),
        ),
        switchMap((locale) =>
          http.get<CartView>('/api/cart', { params: { locale } }).pipe(
            tapResponse({
              next: (view) =>
                patchState(
                  store,
                  produce<CartState>((state) => {
                    state.lines = view.lines;
                    state.status = 'ready';
                  }),
                ),
              error: () =>
                patchState(
                  store,
                  produce<CartState>((state) => {
                    state.status = 'error';
                  }),
                ),
            }),
          ),
        ),
      ),
    ),
    // Resolves once a `load` has finished, successfully or not.
    whenSettled: (): Promise<unknown> => settled(store.status, ['ready', 'error'], injector),
    // Rejects on failure so the calling form can show it as a submit error.
    async add(input: AddToCartInput): Promise<void> {
      const view = await firstValueFrom(http.post<CartView>('/api/cart/items', input));
      patchState(
        store,
        produce<CartState>((state) => {
          state.lines = view.lines;
          state.status = 'ready';
        }),
      );
    },
    // Signed out: the server deleted the session, so the cart is gone too.
    reset(): void {
      patchState(
        store,
        produce<CartState>((state) => {
          state.lines = [];
          state.status = 'ready';
        }),
      );
    },
    // The server prices and freezes the order, then empties the cart; the
    // local mirror follows. Rejects on failure so the page can show it.
    async checkout(locale: Locale): Promise<OrderView> {
      const order = await firstValueFrom(http.post<OrderView>('/api/checkout', { locale }));
      patchState(
        store,
        produce<CartState>((state) => {
          state.lines = [];
          state.status = 'ready';
        }),
      );
      return order;
    },
  })),
);
