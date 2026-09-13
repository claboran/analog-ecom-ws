import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Locale } from '@analog-ecom-ws/product-schema';

// Purely presentational - locale comes in as a signal input (derived from
// the route by whoever hosts this), switching goes out as an output. No
// local state to manage here, so there's nothing for signalState to do;
// see the note in app-layout.component.ts for where that line actually
// gets drawn.
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <header class="border-b border-border">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <a [routerLink]="['/', locale()]" class="text-lg font-semibold tracking-tight" i18n="@@site.name">
          Analog Goods
        </a>
        <nav class="flex items-center gap-6 text-sm">
          <a [routerLink]="['/', locale(), 'products']" class="hover:text-primary" i18n="@@nav.products">Products</a>
          <div class="flex items-center gap-1 rounded-md border border-border p-0.5">
            @for (loc of locales(); track loc) {
              <button
                type="button"
                class="rounded px-2 py-1 text-xs font-medium transition-colors"
                [class.bg-primary]="loc === locale()"
                [class.text-primary-foreground]="loc === locale()"
                [class.text-muted-foreground]="loc !== locale()"
                (click)="localeChange.emit(loc)"
              >
                {{ loc.toUpperCase() }}
              </button>
            }
          </div>
        </nav>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  readonly locale = input.required<Locale>();
  readonly locales = input<readonly Locale[]>([]);
  readonly localeChange = output<Locale>();
}
