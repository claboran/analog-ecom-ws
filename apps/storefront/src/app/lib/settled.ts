import type { Injector, Signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';

// rxMethods are fire-and-forget. The few callers that must wait for a load to
// finish (the WebMCP tools, SessionStore.ensureSignedIn) wait for the store's
// status to reach one of the `done` values instead - the one place in the
// stores that turns an observable into a promise for that purpose.
export const settled = <S extends string>(status: Signal<S>, done: readonly S[], injector: Injector): Promise<S> =>
  firstValueFrom(toObservable(status, { injector }).pipe(filter((value) => done.includes(value))));
