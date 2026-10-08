import { HttpClient } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { produce } from 'immer';
import { exhaustMap, firstValueFrom, pipe, switchMap, tap } from 'rxjs';
import { HlmDialogService } from '@spartan-ng/helm/dialog';
import type { SessionView } from '../lib/cart-schema';
import { settled } from '../lib/settled';
import { CartStore } from './cart.store';

type SessionState = SessionView & {
  // 'idle' is also what the server renders: the session is client-only, so
  // SSR output (signed-out header) always matches the first client render.
  status: 'idle' | 'loading' | 'ready';
};

const initialState: SessionState = { userName: null, status: 'idle' };

// Client mirror of the server session (server/lib/cart-session.ts) - the
// pseudo login. The server is the source of truth; nothing here runs during
// SSR, callers trigger `load` from afterNextRender.
//
// Same split as CartStore: `load` and `signOut` are fire-and-forget rxMethods
// whose outcome lives in `status`/`userName`; `signIn` and `ensureSignedIn`
// are commands whose callers need the outcome, so they return promises.
export const SessionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (
      store,
      http = inject(HttpClient),
      dialog = inject(HlmDialogService),
      cart = inject(CartStore),
      injector = inject(Injector),
    ) => {
      const setUser = (userName: string | null): void =>
        patchState(
          store,
          produce<SessionState>((state) => {
            state.userName = userName;
            state.status = 'ready';
          }),
        );

      const signIn = async (userName: string): Promise<void> => {
        const view = await firstValueFrom(http.post<SessionView>('/api/session', { userName }));
        setUser(view.userName);
      };

      const load = rxMethod<void>(
        pipe(
          tap(() =>
            patchState(
              store,
              produce<SessionState>((state) => {
                state.status = 'loading';
              }),
            ),
          ),
          switchMap(() =>
            http.get<SessionView>('/api/session').pipe(
              tapResponse({
                next: (view) => setUser(view.userName),
                error: () => setUser(null),
              }),
            ),
          ),
        ),
      );

      // Starts the initial load if nobody has yet, and resolves once the
      // server's answer is in.
      const ensureLoaded = async (): Promise<void> => {
        if (store.status() === 'idle') {
          load();
        }
        if (store.status() !== 'ready') {
          await settled(store.status, ['ready'], injector);
        }
      };

      return {
        load,
        ensureLoaded,
        signIn,

        // Opens the login dialog (unless already signed in) and resolves with
        // whether the user ended up signed in - false if they dismissed it.
        // Callers just `await` this, so "sign in, then continue what I was
        // doing" needs no pending-intent state.
        async ensureSignedIn(): Promise<boolean> {
          // Submitted before the layout's initial load finished: ask the
          // server first, so a signed-in user isn't shown the dialog.
          await ensureLoaded();
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

        // The server session is gone (expired, or the server restarted):
        // mirror that locally without another round trip.
        markSignedOut(): void {
          setUser(null);
          cart.reset();
        },

        // Deletes the server session, and with it the cart and orders. Signed
        // out locally whether or not the request got through.
        signOut: rxMethod<void>(
          pipe(
            exhaustMap(() =>
              http.delete<void>('/api/session').pipe(
                tapResponse({
                  next: () => undefined,
                  error: () => undefined,
                  finalize: () => {
                    setUser(null);
                    cart.reset();
                  },
                }),
              ),
            ),
          ),
        ),
      };
    },
  ),
);
