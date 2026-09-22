import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import type { RouteMeta } from '@analogjs/router';
import { LOCALES } from '@analog-ecom-ws/product-schema/locales';

// Analog's [locale] segment doesn't reject unsupported values on its own
// (overall-goals-design.md §7's "Guard note") - without this, any unknown
// top-level path (/robots.txt, /favicon.ico, a bad crawler request, ...)
// gets matched as if "robots.txt" were the locale, and the landing page
// renders nested under it with broken links (found via a Lighthouse SEO
// audit requesting /robots.txt and getting the app shell back instead).
const validLocaleGuard: CanActivateFn = (route) => {
  const locale = route.paramMap.get('locale');
  if (locale && (LOCALES as readonly string[]).includes(locale)) {
    return true;
  }
  return inject(Router).parseUrl('/en');
};

export const routeMeta: RouteMeta = {
  canActivate: [validLocaleGuard],
};

// A named dynamic segment (`[locale]`) alongside a `[locale]/` folder acts
// as a layout, the same way Analog's pathless `(group)` convention does,
// except this one keeps its path segment (`:locale`) instead of stripping
// it. Every /:locale/* route renders inside AppLayoutComponent.
export { AppLayoutComponent as default } from '../layout/app-layout.component';
