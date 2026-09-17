import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

export type BreadcrumbItem = {
  label: string;
  // RouterLink commands, or null for the current page (not a link).
  link: string[] | null;
};

type BreadcrumbState = {
  // Home is rendered by <app-breadcrumb> itself; trail holds only the
  // page-specific segments after it, so pages don't need to know how Home
  // is spelled or linked.
  trail: BreadcrumbItem[];
};

const initialState: BreadcrumbState = { trail: [] };

// Shared across the layout (which renders it) and leaf page components
// (which set it) - the one piece of state in this app that's actually
// cross-component, so it's the exception to "signalState, not signalStore"
// in overall-goals-design.md §8.
export const BreadcrumbStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    setTrail(trail: BreadcrumbItem[]): void {
      patchState(store, { trail });
    },
    clear(): void {
      patchState(store, initialState);
    },
  })),
);
