import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import type { Locale } from '@analog-ecom-ws/product-schema';

// Purely presentational - locale comes in as a signal input (derived from
// the route by whoever hosts this), switching goes out as an output. No
// local state to manage here, so there's nothing for signalState to do;
// see the note in app-layout.component.ts for where that line actually
// gets drawn.
//
// The locale switcher is a spartan single-select toggle group: it's a
// "pick exactly one" control, which is what gives it roving keyboard focus
// and aria-pressed state for free instead of hand-rolled button styling.
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HlmToggleGroupImports],
  template: `
    <header class="border-b border-border">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <a [routerLink]="['/', locale()]" class="text-lg font-semibold tracking-tight" i18n="@@site.name">
          Analog Goods
        </a>
        <nav class="flex items-center gap-6 text-sm">
          <a [routerLink]="['/', locale(), 'products']" class="hover:text-primary" i18n="@@nav.products">Products</a>
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
