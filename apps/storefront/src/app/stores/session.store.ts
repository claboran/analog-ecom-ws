import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { HlmDialogService } from '@spartan-ng/helm/dialog';
import type { SessionView } from '../lib/cart-schema';
import { CartStore } from './cart.store';

type SessionState = SessionView & {
  // 'idle' is also what the server renders: the session is client-only, so
  // SSR output (signed-out header) always matches the first client render.
  status: 'idle' | 'ready';
};

const initialState: SessionState = { userName: null, status: 'idle' };

// Client mirror of the server session (server/lib/cart-session.ts) - the
// pseudo login. The server is the source of truth; nothing here runs during
// SSR, callers trigger `load` from afterNextRender.
export const SessionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, http = inject(HttpClient), dialog = inject(HlmDialogService), cart = inject(CartStore)) => {
    const signIn = async (userName: string): Promise<void> => {
      const view = await firstValueFrom(http.post<SessionView>('/api/session', { userName }));
      patchState(store, { ...view, status: 'ready' });
    };

    const load = async (): Promise<void> => {
      try {
        const view = await firstValueFrom(http.get<SessionView>('/api/session'));
        patchState(store, { ...view, status: 'ready' });
      } catch {
        patchState(store, { userName: null, status: 'ready' });
      }
    };

    return {
      load,

      // Opens the login dialog (unless already signed in) and resolves with
      // whether the user ended up signed in - false if they dismissed it.
      // Callers just `await` this, so "sign in, then continue what I was
      // doing" needs no pending-intent state.
      async ensureSignedIn(): Promise<boolean> {
        // Submitted before the layout's initial load finished: ask the server
        // first, so a signed-in user isn't shown the dialog.
        if (store.status() === 'idle') {
          await load();
        }
        if (store.userName()) {
          return true;
        }
        // Lazy: the dialog (and spartan's dialog code) only loads on demand,
        // and this store doesn't import the component statically.
        const { LoginDialogComponent } = await import('../components/login-dialog.component');
        const ref = dialog.open<boolean>(LoginDialogComponent, {
          context: { signIn },
          contentClass: 'sm:max-w-sm',
        });
        return (await firstValueFrom(ref.closed$)) === true;
      },

      // The server session is gone (expired, or the server restarted): mirror
      // that locally without another round trip.
      markSignedOut(): void {
        patchState(store, { userName: null, status: 'ready' });
        cart.reset();
      },

      // Deletes the server session, and with it the cart and orders.
      async signOut(): Promise<void> {
        await firstValueFrom(http.delete<void>('/api/session')).catch(() => undefined);
        patchState(store, { userName: null, status: 'ready' });
        cart.reset();
      },
    };
  }),
);
