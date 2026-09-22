import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideFileRouter, requestContextInterceptor } from '@analogjs/router';
import { provideI18n } from '@analogjs/router/i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // zone.js was never a dependency here (checked: not in package.json,
    // not in node_modules) - the app was already running on Angular's
    // implicit no-zone fallback. Declaring it explicitly opts into the
    // real zoneless change-detection scheduler instead of that fallback
    // path, matching the OnPush-everywhere/signals architecture already
    // in use (see README's "UI architecture").
    provideZonelessChangeDetection(),
    provideFileRouter(),
    provideClientHydration(),
    provideHttpClient(withFetch(), withInterceptors([requestContextInterceptor])),
    provideI18n({
      loader: (locale) => import(`../i18n/${locale}.json`).then((m) => m.default),
    }),
  ],
};
