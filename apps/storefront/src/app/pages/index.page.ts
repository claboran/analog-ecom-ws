import type { RouteMeta } from '@analogjs/router';

// / -> /en (defaultLocale). See overall-goals-design.md §7/§13.
//
// Deliberately no default-exported component here: Analog's route
// generator always sets `component: m.default` on the route object and
// then spreads the redirect config on top, so a real component would
// collide with `redirectTo` (Angular rejects a route that has both -
// NG04014). Leaving `default` undefined keeps the route a pure redirect.
export const routeMeta: RouteMeta = {
  redirectTo: '/en',
  pathMatch: 'full',
};
