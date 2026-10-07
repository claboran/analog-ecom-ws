import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import type { Locale } from '@analog-ecom-ws/product-schema';

// Purely presentational - locale comes in as a signal input (derived from
// the route by whoever hosts this), switching goes out as an output. No
// local state to manage here, so there's nothing to own; see the note in
// app-layout.component.ts for where that line actually gets drawn.
//
// The locale switcher is a spartan single-select toggle group: it's a
// "pick exactly one" control, which is what gives it roving keyboard focus
// and aria-pressed state for free instead of hand-rolled button styling.
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HlmBadge, HlmButton, HlmToggleGroupImports],
  template: `
    <header class="border-b border-border">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <a [routerLink]="['/', locale()]" class="text-lg font-semibold tracking-tight" i18n="@@site.name">
          Analog Goods
        </a>
        <nav class="flex items-center gap-6 text-sm">
          <a [routerLink]="['/', locale(), 'products']" class="hover:text-primary" i18n="@@nav.products">Products</a>
          <a [routerLink]="['/', locale(), 'cart']" class="hover:text-primary">
            <ng-container i18n="@@nav.cart">Cart</ng-container>
            @if (cartCount() > 0) {
              <span hlmBadge variant="secondary" class="ml-1">{{ cartCount() }}</span>
            }
          </a>
          @if (userName(); as name) {
            <span class="text-muted-foreground">{{ name }}</span>
            <button hlmBtn variant="ghost" size="sm" type="button" (click)="signOut.emit()" i18n="@@nav.signOut">
              Sign out
            </button>
          } @else {
            <button hlmBtn variant="outline" size="sm" type="button" (click)="signIn.emit()" i18n="@@nav.signIn">
              Sign in
            </button>
          }
          <hlm-toggle-group
            type="single"
            variant="outline"
            size="sm"
            aria-label="Language"
            [nullable]="false"
            [value]="locale()"
            (valueChange)="select($event)"
          >
            @for (loc of locales(); track loc) {
              <button hlmToggleGroupItem [value]="loc">{{ loc.toUpperCase() }}</button>
            }
          </hlm-toggle-group>
        </nav>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  readonly locale = input.required<Locale>();
  readonly locales = input<readonly Locale[]>([]);
  // Always 0 on the server and on the first client render; the layout fills
  // it in once the client-only cart has loaded.
  readonly cartCount = input(0);
  // null while signed out - and on the server / first client render, like
  // cartCount: the session is client-only.
  readonly userName = input<string | null>(null);
  readonly signIn = output<void>();
  readonly signOut = output<void>();
  readonly localeChange = output<Locale>();

  // The group emits whatever value type it was given; only act on an actual
  // change to one of our locales (switching is a full navigation, so a
  // no-op re-select shouldn't trigger one).
  protected select(value: unknown): void {
    const target = this.locales().find((loc) => loc === value);
    if (target && target !== this.locale()) {
      this.localeChange.emit(target);
    }
  }
}
